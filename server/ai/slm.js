// The narrative layer — a port of ai/tools/slm_client.py, talking to the same local
// Ollama instance over HTTP.
//
// The prompts themselves are NOT duplicated: ai/prompts.json is already JSON, so it is
// read straight from the Python module's directory. One copy, one place to edit, and the
// CLI and the web app cannot drift apart on house style.
//
// The model only ever receives the stage's `delta` (its genuinely new fields) plus the
// NAMES of the annexures on file. Carried-forward prose and annexure tables are assembled
// in code and never sent — that is what keeps the prompt small and the figures exact.

import { readFileSync } from 'node:fs';

const PROMPTS_URL = new URL('../../ai/prompts.json', import.meta.url);

export const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
export const MODEL = process.env.SLM_MODEL || 'qwen2.5:3b';

let PROMPTS = null;
export function prompts() {
  if (!PROMPTS) PROMPTS = JSON.parse(readFileSync(PROMPTS_URL, 'utf8'));
  return PROMPTS;
}

export async function health() {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return { up: false, model: MODEL, reason: `HTTP ${r.status}` };
    const body = await r.json();
    const names = (body.models ?? []).map((m) => m.name);
    return {
      up: true,
      model: MODEL,
      modelPresent: names.includes(MODEL),
      models: names,
      reason: names.includes(MODEL) ? null : `model ${MODEL} not pulled — run: ollama pull ${MODEL}`
    };
  } catch (e) {
    return {
      up: false, model: MODEL,
      reason: `Ollama not reachable at ${OLLAMA_URL} — start it with: ollama serve`
    };
  }
}

// Build the prompt for a stage exactly as ai/pipeline.py does: the per-stage template
// with the delta JSON substituted, annexure names appended, then the shared guard.
export function buildPrompt(stageId, delta, annexureNames = []) {
  const P = prompts();
  const spec = P[stageId];
  if (!spec) return null;
  const ann = annexureNames.length
    ? `Annexures available to reference by name: ${annexureNames.join(', ')}`
    : '';
  let t = spec.user
    .replace('{delta_json}', JSON.stringify(delta, null, 2))
    .replace('{annexures}', ann);
  if (P._GUARD) t += `\n\n${P._GUARD}`;
  return t;
}

// Returns the drafted prose, or a bracketed marker the UI can show plainly. Never throws:
// a note with an unavailable model is still a note, just with the section flagged.
export async function generate(prompt, { maxTokens = 800, timeoutMs = 180000 } = {}) {
  const payload = {
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    options: { num_predict: maxTokens, temperature: 0.3 }
  };
  if (MODEL.includes('qwen3')) payload.think = false;

  try {
    const r = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!r.ok) return { text: '[SLM_ERROR]', ok: false, error: `Ollama HTTP ${r.status}` };
    const body = await r.json();
    const out = String(body?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    return { text: out || '[SLM_EMPTY]', ok: Boolean(out), error: null };
  } catch (e) {
    const unreachable = /fetch failed|ECONNREFUSED|other side closed/i.test(String(e?.message));
    return {
      text: unreachable ? '[SLM_UNAVAILABLE]' : '[SLM_ERROR]',
      ok: false,
      error: unreachable
        ? `Ollama not running at ${OLLAMA_URL} — start it with: ollama serve`
        : String(e?.message ?? e)
    };
  }
}

export default { OLLAMA_URL, MODEL, prompts, health, buildPrompt, generate };
