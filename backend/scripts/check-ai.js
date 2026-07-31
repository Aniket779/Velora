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

/**
 * Tries a minimal call against every model the key can see, and reports which
 * ones actually have quota.
 *
 * Worth doing because quota is granted PER MODEL. "No free tier" is rarely
 * account-wide — Google moves the free allocation between models over time, so
 * gemini-2.0-flash returning limit:0 says nothing about gemini-2.5-flash.
 * Guessing which one works wastes more time than measuring it.
 *
 * Costs nothing where quota is zero, and stops at the first model that works.
 */
async function findWorkingModel(key, models) {
  head('5. Probing every available model for one with quota');

  // Cheapest and most likely to carry a free allocation first.
  const rank = (m) => {
    if (/flash-lite/.test(m)) return 0;
    if (/flash/.test(m) && !/thinking|exp|preview/.test(m)) return 1;
    if (/flash/.test(m)) return 2;
    if (/pro/.test(m) && !/exp|preview/.test(m)) return 3;
    return 4;
  };

  const candidates = models
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    // Tuned/legacy endpoints aren't useful here.
    .filter((m) => !/embedding|aqa|imagen|veo|tts|image-generation|native-audio|live-/.test(m))
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

  info(`${candidates.length} text models to try\n`);

  const working = [];
  let zeroQuota = 0;

  for (const m of candidates) {
    try {
      await axios.post(
        `${GEMINI_BASE}/models/${m}:generateContent`,
        {
          contents: [{ role: 'user', parts: [{ text: 'Say OK' }] }],
          generationConfig: { maxOutputTokens: 5, temperature: 0 },
        },
        { params: { key }, timeout: 25_000 }
      );
      ok(`${m}  <-- WORKS`);
      working.push(m);
      break; // one is enough
    } catch (err) {
      const e = describeAxiosError(err);
      if (e.status === 429 && /limit:\s*0\b/.test(e.message)) {
        zeroQuota++;
        console.log(`${DIM}  ---   ${m} — no quota (limit: 0)${RESET}`);
      } else if (e.status === 429) {
        // Throttled means there IS an allocation. That's a usable model.
        warn(`${m} — throttled, but quota EXISTS. Usable once it resets.`);
        working.push(m);
        break;
      } else if (e.status === 404) {
        console.log(`${DIM}  ---   ${m} — not available for generateContent${RESET}`);
      } else {
        console.log(`${DIM}  ---   ${m} — HTTP ${e.status}: ${String(e.message).slice(0, 80)}${RESET}`);
      }
    }
    // Small gap so a throttled account doesn't compound while probing.
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log('');
  if (working.length) {
    ok(`Use this model. Put it in backend/.env:`);
    info('');
    info(`  GEMINI_MODEL=${working[0]}`);
    info('');
    info('Then restart the server and run this check again.');
    return true;
  }

  bad(`No model has quota — ${zeroQuota} returned limit: 0`);
  info('');
  info('The free tier is genuinely unavailable to this account. Two real options:');
  info('');
  info('  1. Enable billing at https://aistudio.google.com/app/billing');
  info('     Roughly $0.02-0.05 per itinerary, and destination briefings are');
  info('     cached for 90 days, so repeat cities cost nothing. Set a budget cap.');
  info('');
  info('  2. Use OpenAI instead — set OPENAI_API_KEY in backend/.env.');
  info('     src/ai/llm.js already supports it; no code change needed.');
  info('');
  info('Velora still runs without either, returning clearly-labelled placeholder');
  info('content — but the retrieval grounding will not be visible in a demo.');
  return false;
}

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

      // The distinction that matters, and it is easy to miss because both
      // cases arrive as a 429 telling you to retry shortly:
      //
      //   limit: 0    no quota allocated at all. Retrying NEVER succeeds.
      //   limit: N>0  a real allocation you are exceeding. Waiting works.
      //
      // Google sends a retryDelay either way, which actively misleads you in
      // the first case.
      const zeroQuota = /limit:\s*0\b/.test(e.message);

      info('');
      if (zeroQuota) {
        info(`=> "limit: 0" — no quota allocated for ${model}. Not a throughput`);
        info('   problem; waiting will never fix it, whatever the delay says.');
        info('');
        info('   Quota is granted PER MODEL, so another model may still work.');
        info('   Checking all of them now rather than guessing.');

        // The useful next step, run automatically instead of being advice.
        return await findWorkingModel(key, models);
      } else {
        info('=> Rate limited on a real allocation. The key works; you are');
        info('   going too fast.');
        if (retry) info(`   Google asks you to wait ${retry}.`);
        if (/per ?day|PerDay|daily/i.test(e.message)) {
          info('   This is the DAILY cap — it resets at midnight Pacific time.');
        } else {
          info('   GEMINI_MODEL=gemini-2.0-flash-lite allows roughly double the');
          info('   per-minute throughput of gemini-2.0-flash.');
        }
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
