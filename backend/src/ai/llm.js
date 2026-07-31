'use strict';

/**
 * ============================================================================
 * WHAT THIS FILE DOES — the only file that talks to an AI provider
 * ============================================================================
 * Supports BOTH Google Gemini and OpenAI. It picks whichever key you've set:
 *
 *   GEMINI_API_KEY  -> Google Gemini   (generous free tier)
 *   OPENAI_API_KEY  -> OpenAI          (paid)
 *
 * Set neither and the app still runs end to end on clearly-labelled
 * placeholder content.
 *
 * Two public methods, identical whichever provider is active:
 *   generateStructured()  JSON constrained by a schema
 *   chat()                free text, for the assistant
 *
 * WHY ONE FILE
 * Everything else in the codebase calls these two methods and has no idea
 * which provider is behind them. Swapping providers touches nothing else.
 * ============================================================================
 */

const axios = require('axios');
const AppError = require('../utils/AppError');
const prompts = require('./prompts');
const mockData = require('./mockData');
const {
  DestinationIntelligenceSchema,
  GroundedItinerarySchema,
  DESTINATION_INTELLIGENCE_JSON_SCHEMA,
  ITINERARY_JSON_SCHEMA,
} = require('./schemas');

/** Rough USD per 1M tokens, for the cost log line only. Gemini flash is free-tier. */
const PRICING = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-2024-08-06': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gemini-2.0-flash': { input: 0, output: 0 },
  'gemini-1.5-flash': { input: 0, output: 0 },
  'gemini-1.5-pro': { input: 1.25, output: 5 },
};

const RETRYABLE = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * How long the provider itself says to wait, in ms, or null.
 *
 * Gemini returns a RetryInfo detail like `{ retryDelay: "34s" }`; OpenAI uses
 * the standard `Retry-After` header. Honouring either is far better than
 * guessing, because free-tier limits are per-MINUTE — an exponential backoff
 * that tops out at 8 seconds retries three times inside the same window and
 * fails all three, burning quota instead of waiting it out.
 */
const providerRetryDelayMs = (error) => {
  const header = error.response?.headers?.['retry-after'];
  if (header) {
    const secs = Number(header);
    if (Number.isFinite(secs)) return secs * 1000;
  }

  const details = error.response?.data?.error?.details || [];
  for (const d of details) {
    const m = /^(\d+(?:\.\d+)?)s$/.exec(d.retryDelay || '');
    if (m) return Math.ceil(Number(m[1]) * 1000);
  }
  return null;
};

/**
 * Converts our strict JSON Schema into Gemini's `responseSchema`.
 *
 * Gemini accepts an OpenAPI-subset, NOT full JSON Schema. Two differences
 * matter and both silently break the request if left alone:
 *   - `additionalProperties` is rejected outright
 *   - nullable fields must be `{ type: 'string', nullable: true }`, not the
 *     `anyOf: [{type:'string'}, {type:'null'}]` that Zod produces
 */
const toGeminiSchema = (node) => {
  if (Array.isArray(node)) return node.map(toGeminiSchema);
  if (node === null || typeof node !== 'object') return node;

  // Collapse Zod's nullable representation into Gemini's `nullable` flag.
  if (Array.isArray(node.anyOf)) {
    const nonNull = node.anyOf.find((x) => x.type !== 'null');
    const hasNull = node.anyOf.some((x) => x.type === 'null');
    if (nonNull) return { ...toGeminiSchema(nonNull), ...(hasNull ? { nullable: true } : {}) };
  }

  const out = {};
  for (const [key, value] of Object.entries(node)) {
    // Unsupported by Gemini — including it makes the whole call 400.
    if (key === 'additionalProperties' || key === '$schema') continue;
    out[key] = toGeminiSchema(value);
  }
  return out;
};

class LlmClient {
  constructor() {
    this.geminiKey = process.env.GEMINI_API_KEY;
    this.openaiKey = process.env.OPENAI_API_KEY;

    // Gemini wins when both are present — it's the one with a free tier.
    this.provider = this.geminiKey ? 'gemini' : this.openaiKey ? 'openai' : null;

    this.model = this.provider === 'gemini'
      ? (process.env.GEMINI_MODEL || 'gemini-2.0-flash')
      : (process.env.OPENAI_MODEL || 'gpt-4o-2024-08-06');

    this.maxAttempts = Number(process.env.AI_MAX_ATTEMPTS) || 3;
    this.timeoutMs = Number(process.env.AI_TIMEOUT_MS) || 90_000;

    // The longest we'll hold a worker slot waiting out a rate limit. Beyond
    // this it's better to fail fast and let the user press Retry than to block
    // the queue behind one job.
    this.rateLimitWaitMs = Number(process.env.AI_RATE_LIMIT_WAIT_MS) || 30_000;

    if (this.provider) {
      console.log(`[AI] Provider: ${this.provider} (${this.model})`);
    } else {
      console.warn('[AI] ⚠️  No GEMINI_API_KEY or OPENAI_API_KEY set — placeholder content only.');
    }
  }

  get isConfigured() {
    return Boolean(this.provider);
  }

  /** Human-readable name of whichever key is missing, for error messages. */
  get keyName() {
    return this.provider === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';
  }

  logCost(label, usage) {
    if (!usage) return;
    const p = PRICING[this.model] || { input: 0, output: 0 };
    const inTok = usage.prompt_tokens ?? usage.promptTokenCount ?? 0;
    const outTok = usage.completion_tokens ?? usage.candidatesTokenCount ?? 0;
    const cost = (inTok / 1e6) * p.input + (outTok / 1e6) * p.output;
    console.log(
      `[AI] ${label} ${this.provider} in=${inTok} out=${outTok} ` +
        (cost > 0 ? `cost≈$${cost.toFixed(4)}` : 'cost=free tier')
    );
  }

  // -------------------------------------------------------------- providers

  async _callGemini({ systemPrompt, userPrompt, jsonSchema, temperature, maxTokens }) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;

    const body = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens || 8192,
        ...(jsonSchema
          ? {
              responseMimeType: 'application/json',
              responseSchema: toGeminiSchema(jsonSchema.schema),
            }
          : {}),
      },
    };

    const res = await axios.post(url, body, {
      params: { key: this.geminiKey },
      headers: { 'Content-Type': 'application/json' },
      timeout: this.timeoutMs,
    });

    const candidate = res.data.candidates?.[0];
    if (!candidate) throw new Error('Gemini returned no candidates');
    if (candidate.finishReason === 'MAX_TOKENS') {
      throw new Error('Response was cut off by the token limit');
    }
    if (candidate.finishReason === 'SAFETY') {
      throw new AppError('The model declined this request on safety grounds.', 422);
    }

    this.logCost(arguments[0]?.label || 'call', res.data.usageMetadata);
    return candidate.content?.parts?.map((p) => p.text).join('') || '';
  }

  async _callOpenAI({ systemPrompt, userPrompt, jsonSchema, temperature, maxTokens }) {
    const res = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        ...(jsonSchema ? { response_format: { type: 'json_schema', json_schema: jsonSchema } } : {}),
        temperature,
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
      },
      {
        headers: { Authorization: `Bearer ${this.openaiKey}`, 'Content-Type': 'application/json' },
        timeout: this.timeoutMs,
      }
    );

    const choice = res.data.choices?.[0];
    if (choice?.message?.refusal) {
      throw new AppError(`The model declined this request: ${choice.message.refusal}`, 422);
    }
    if (choice?.finish_reason === 'length') {
      throw new Error('Response was cut off by the token limit');
    }

    this.logCost('call', res.data.usage);
    return choice.message.content;
  }

  // ------------------------------------------------------------------ core

  /** One call with bounded retry, whichever provider is active. */
  async _call({ label, systemPrompt, userPrompt, jsonSchema, zodSchema, temperature = 0.7, maxTokens }) {
    let lastError;
    let rateLimitWait = null;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        const raw = this.provider === 'gemini'
          ? await this._callGemini({ label, systemPrompt, userPrompt, jsonSchema, temperature, maxTokens })
          : await this._callOpenAI({ systemPrompt, userPrompt, jsonSchema, temperature, maxTokens });

        if (!jsonSchema) return raw.trim();

        // Zod still runs. The provider guarantees shape; this is the boundary
        // where a schema/prompt drift would otherwise reach the database.
        return zodSchema.parse(JSON.parse(raw));
      } catch (error) {
        lastError = error;
        if (error instanceof AppError) throw error;

        const status = error.response?.status;
        const retryable = RETRYABLE.has(status) || !status ||
          error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';

        // The provider's own error text is far more useful than a generic one.
        const detail = error.response?.data?.error?.message || error.message;
        console.warn(`[AI] ${label} attempt ${attempt}/${this.maxAttempts} failed (${status || error.code}): ${detail}`);

        if (attempt >= this.maxAttempts) break;
        if (!retryable && status >= 400 && status < 500) break;

        if (status === 429) {
          // A rate limit is not a transient network blip, and backing off by
          // 1s/2s/4s is actively harmful: free-tier quotas are per-minute, so
          // all three retries land inside the same window, fail, and each one
          // still counts against the quota. Wait exactly as long as the
          // provider asked — and if that's longer than we're willing to hold a
          // worker slot, stop now and let the user retry.
          const wait = providerRetryDelayMs(error) ?? this.rateLimitWaitMs;
          if (wait > this.rateLimitWaitMs) {
            rateLimitWait = wait;
            break;
          }
          console.warn(`[AI] ${label} rate limited — waiting ${Math.ceil(wait / 1000)}s as instructed`);
          await sleep(wait);
          continue;
        }

        await sleep(Math.min(1000 * 2 ** (attempt - 1), 8000));
      }
    }

    const status = lastError?.response?.status;
    const detail = lastError?.response?.data?.error?.message || lastError?.message;

    if (status === 401 || status === 403) {
      throw new AppError(`${this.keyName} was rejected by ${this.provider}. Check the key is valid.`, 502);
    }
    if (status === 429) {
      // Daily exhaustion and per-minute throttling need different advice —
      // "retry shortly" is wrong and frustrating if the quota resets tomorrow.
      const perDay = /per ?day|PerDay|daily/i.test(detail || '');
      if (perDay) {
        throw new AppError(
          `${this.provider}'s daily free-tier quota is used up. It resets at midnight Pacific time. ` +
            `Add OPENAI_API_KEY to .env to switch providers, or try again tomorrow.`,
          503
        );
      }
      const secs = Math.ceil((rateLimitWait ?? this.rateLimitWaitMs) / 1000);
      throw new AppError(
        `${this.provider}'s free tier is rate limited right now. Wait about ${secs} seconds and press Retry.`,
        503
      );
    }
    if (status === 400) {
      throw new AppError(`The AI provider rejected the request: ${detail}`, 502);
    }
    throw new AppError(`AI generation failed after ${this.maxAttempts} attempts: ${detail}`, 502);
  }

  // ----------------------------------------------------------------- public

  /** The 18 destination knowledge categories. Cached by the calling service. */
  async generateDestinationIntelligence({ destination, country }) {
    if (!this.isConfigured) {
      console.warn(`[AI] ⚠️  No API key — PLACEHOLDER briefing for ${destination}.`);
      return { data: mockData.destinationIntelligence({ destination, country }), isMock: true };
    }

    const data = await this._call({
      label: `briefing[${destination}]`,
      systemPrompt: prompts.destinationSystemPrompt(),
      userPrompt: prompts.destinationUserPrompt({ destination, country }),
      jsonSchema: DESTINATION_INTELLIGENCE_JSON_SCHEMA,
      zodSchema: DestinationIntelligenceSchema,
      temperature: 0.4,
    });

    return { data, isMock: false, promptVersion: prompts.PROMPT_VERSION };
  }

  /** The day-by-day plan, built from the catalogue of real MongoDB records. */
  async generateItinerary({ profile, catalog, catalogText, intelligence }) {
    if (!this.isConfigured) {
      console.warn(`[AI] ⚠️  No API key — PLACEHOLDER itinerary for ${profile.destination}.`);
      return { data: mockData.itinerary({ profile, catalog }), isMock: true };
    }

    const data = await this._call({
      label: `itinerary[${profile.destination}/${profile.days}d]`,
      systemPrompt: prompts.itinerarySystemPrompt(),
      userPrompt: prompts.itineraryUserPrompt({ profile, catalog, catalogText, intelligence }),
      jsonSchema: ITINERARY_JSON_SCHEMA,
      zodSchema: GroundedItinerarySchema,
      temperature: 0.7,
    });

    return { data, isMock: false, promptVersion: prompts.PROMPT_VERSION };
  }

  /** Free-text chat, for the assistant. */
  async chat({ label, messages, temperature = 0.5, maxTokens = 500 }) {
    // Both providers take a system instruction plus turns; flatten to that shape.
    const system = messages.find((m) => m.role === 'system')?.content || '';
    const turns = messages.filter((m) => m.role !== 'system');
    const userPrompt = turns
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    return this._call({
      label,
      systemPrompt: system,
      userPrompt,
      temperature,
      maxTokens,
    });
  }
}

module.exports = new LlmClient();
module.exports.toGeminiSchema = toGeminiSchema;
