'use strict';

require('dotenv').config();
const axios = require('axios');

/**
 * ============================================================================
 * AI PROVIDER DIAGNOSTIC  —  npm run check-ai
 * ============================================================================
 * Answers one question: why isn't generation working?
 *
 * It runs the cheap checks first, in the order that isolates the cause:
 *
 *   1. Is a key even set, and does it LOOK like the right kind of key?
 *   2. Does it authenticate?  (ListModels — a GET that costs no generation
 *      quota, so a rate limit here means something quite different from a
 *      rate limit on a generate call)
 *   3. Does the model you configured actually exist for this key?
 *   4. Does a real generate call work?
 *
 * Step 2 is the one that matters. A bad key fails there instantly, which
 * distinguishes "your key is wrong" from "you're being throttled" — two
 * problems that can surface as the same 429 and have completely different fixes.
 *
 * Your key is never printed.
 * ============================================================================
 */

const GREEN = '\x1b[32m', RED = '\x1b[31m', YELLOW = '\x1b[33m', DIM = '\x1b[2m', RESET = '\x1b[0m';
const ok = (m) => console.log(`${GREEN}  PASS${RESET}  ${m}`);
const bad = (m) => console.log(`${RED}  FAIL${RESET}  ${m}`);
const warn = (m) => console.log(`${YELLOW}  WARN${RESET}  ${m}`);
const info = (m) => console.log(`${DIM}        ${m}${RESET}`);
const head = (m) => console.log(`\n${m}\n${'-'.repeat(m.length)}`);

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const describeAxiosError = (err) => {
  if (err.response) {
    const d = err.response.data?.error || {};
    return {
      status: err.response.status,
      message: d.message || JSON.stringify(err.response.data).slice(0, 300),
      reason: d.status || d.code,
      details: d.details,
    };
  }
  if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') {
    return { status: 0, message: 'DNS lookup failed — no internet, or a proxy/firewall is blocking it.' };
  }
  if (err.code === 'ECONNABORTED') return { status: 0, message: 'Request timed out.' };
  return { status: 0, message: err.message };
};

async function checkGemini(key, model) {
  // ---------------------------------------------------------------- 1. shape
  head('1. Key format');

  info(`length ${key.length}, starts with "${key.slice(0, 4)}"`);

  // AI Studio has issued at least two formats: AIza… (older, 39 chars) and
  // AQ.… (current). Both are valid, so this check stays deliberately narrow —
  // an earlier, stricter version confidently rejected a perfectly good key.
  // Step 2 asks Google, which is the only answer that actually counts.
  if (/^ya29\./.test(key)) {
    bad('This is a short-lived OAuth ACCESS TOKEN (ya29.…), not an API key');
    info('These come from gcloud or a Google sign-in flow, expire in ~1 hour,');
    info('and are scoped to a user rather than a project.');
    info('Get an API key at https://aistudio.google.com/apikey');
  } else if (key.length < 30) {
    bad(`Only ${key.length} characters — almost certainly a truncated paste`);
  } else {
    ok('Nothing obviously wrong with the key format');
    info('Format alone proves nothing — step 2 is the real test.');
  }

  // ------------------------------------------------------- 2. authentication
  head('2. Authentication (ListModels — costs no generation quota)');

  let models;
  try {
    const res = await axios.get(`${GEMINI_BASE}/models`, {
      params: { key },
      timeout: 20_000,
    });
    models = res.data.models || [];
    ok(`Key authenticates. ${models.length} models visible.`);
  } catch (err) {
    const e = describeAxiosError(err);
    bad(`ListModels failed with HTTP ${e.status}`);
    info(e.message);

    if (e.status === 400 && /API key not valid/i.test(e.message)) {
      info('');
      info('=> The key is not a valid Generative Language API key.');
      info('   Create one at https://aistudio.google.com/apikey');
    } else if (e.status === 403) {
      info('');
      info('=> Authenticated, but not authorised. Usually one of:');
      info('   - the Generative Language API is not enabled on the project');
      info('   - the key has API restrictions that exclude this API');
    } else if (e.status === 429) {
      info('');
      info('=> Throttled on a call that consumes no generation quota, which');
      info('   points at a project-level quota of zero rather than you being');
      info('   too fast. A fresh AI Studio key is the usual fix.');
    }
    return false;
  }

  // --------------------------------------------------------- 3. model exists
  head(`3. Is "${model}" available to this key?`);

  const usable = models
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''));

  if (usable.includes(model)) {
    ok(`${model} is available`);
  } else {
    bad(`${model} is NOT available to this key`);
    info('Models this key CAN use for generateContent:');
    usable.slice(0, 12).forEach((m) => info(`  - ${m}`));
    const suggestion = usable.find((m) => /flash/.test(m)) || usable[0];
    if (suggestion) {
      info('');
      info(`Set this in backend/.env:   GEMINI_MODEL=${suggestion}`);
    }
    return false;
  }

  // ------------------------------------------------------- 4. real generation
  head('4. A real generateContent call');

  try {
    const res = await axios.post(
      `${GEMINI_BASE}/models/${model}:generateContent`,
      {
        contents: [{ role: 'user', parts: [{ text: 'Reply with the single word: OK' }] }],
        generationConfig: { maxOutputTokens: 10, temperature: 0 },
      },
      { params: { key }, timeout: 30_000 }
    );

    const text = res.data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    ok(`Generation works. Model replied: ${JSON.stringify(text.trim())}`);

    const u = res.data.usageMetadata;
    if (u) info(`tokens in=${u.promptTokenCount} out=${u.candidatesTokenCount}`);
    return true;
  } catch (err) {
    const e = describeAxiosError(err);
    bad(`generateContent failed with HTTP ${e.status}`);
    info(e.message);

    if (e.status === 429) {
      const retry = (e.details || []).find((d) => d.retryDelay)?.retryDelay;
      info('');
      info('=> Rate limited. The key works; you are just going too fast.');
      if (retry) info(`   Google asks you to wait ${retry}.`);
      if (/per ?day|PerDay/i.test(e.message)) {
        info('   This is the DAILY cap — it resets at midnight Pacific time.');
      } else {
        info('   Free tier allows ~15 requests/minute on gemini-2.0-flash.');
        info('   GEMINI_MODEL=gemini-2.0-flash-lite doubles that to 30/min.');
      }
    }
    return false;
  }
}

async function checkOpenAI(key, model) {
  head('OpenAI');
  try {
    await axios.get('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      timeout: 20_000,
    });
    ok('Key authenticates');
  } catch (err) {
    const e = describeAxiosError(err);
    bad(`HTTP ${e.status}: ${e.message}`);
    if (e.status === 429) info('=> Usually means no credit on the account, not throughput.');
    return false;
  }
  info(`Configured model: ${model}`);
  return true;
}

(async () => {
  console.log('\n=== Velora AI provider check ===');

  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!geminiKey && !openaiKey) {
    head('No provider configured');
    bad('Neither GEMINI_API_KEY nor OPENAI_API_KEY is set in backend/.env');
    info('The app still runs, but every itinerary is placeholder content.');
    info('Free Gemini key: https://aistudio.google.com/apikey');
    process.exit(1);
  }

  // Mirrors the precedence in src/ai/llm.js.
  const passed = geminiKey
    ? await checkGemini(geminiKey.trim(), process.env.GEMINI_MODEL || 'gemini-2.0-flash')
    : await checkOpenAI(openaiKey.trim(), process.env.OPENAI_MODEL || 'gpt-4o-2024-08-06');

  if (geminiKey && openaiKey) {
    console.log(`\n${DIM}Note: both keys are set. Gemini wins — see src/ai/llm.js.${RESET}`);
  }

  console.log(
    passed
      ? `\n${GREEN}All checks passed. Generation should work.${RESET}\n`
      : `\n${RED}Fix the failure above, then run this again.${RESET}\n`
  );
  process.exit(passed ? 0 : 1);
})();
