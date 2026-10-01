// @ts-nocheck
/**
 * **One OpenRouter client for the loop** (PRD #82; moved here from PRD #72's retro `narrate`).
 *
 * A prompt in, a reply the caller's check accepts out. The retro and the knowledge harvest both ask a
 * model through it, so the model, the masking, the retries and the repair live in one place.
 *
 * - **The model:** Claude Opus 5.5 unless `OPENROUTER_MODEL` names another, at temperature 0.
 * - **The prompt:** every token-shaped string in it (GitHub tokens, `sk-` keys, AWS key ids, a
 *   bearer credential, a JWT) is masked before anything is sent.
 * - **The reply:** JSON. Given a `schema`, the request asks for a JSON-schema response format. The
 *   reply is checked by `check`: a function returning `{ errors, reply }`, or a zod schema (anything
 *   with `safeParse`). A reply the check refuses gets one repair request; refused again, the call
 *   returns a refusal with its reason.
 * - **The transport:** `fetch` is injected, and nothing here reaches the network on its own. A
 *   network error, a 408, a 429 or a 5xx is tried again, `call.attempts` times in all, inside
 *   `call.budgetMs`.
 *
 * It never throws. The contract:
 *   in:  { system, user, check, schema?, env, fetch, sleep?, call?, title?, stream? }
 *   out: { ok, error, model, reply, reason }
 *        `ok` true: `reply` is what the check kept. Otherwise `error` is `NO_KEY` (no request was
 *        made, `model` null), `UNAVAILABLE` or `REFUSED`, and `reason` says why in words.
 */
import { KIT_MESSAGES } from './schema/messages.ts';

/** The model asked when `OPENROUTER_MODEL` names none. */
export const DEFAULT_MODEL = 'anthropic/claude-opus-5.5';
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** The kinds of failure a call returns in `error`. */
export const NO_KEY = 'no-key';
export const UNAVAILABLE = 'unavailable';
export const REFUSED = 'refused';

/** The environment variables the client reads. */
export const KEY_VAR = 'OPENROUTER_API_KEY';
export const MODEL_VAR = 'OPENROUTER_MODEL';

/**
 * How the model is asked: how many tries a request gets in all, the pause before each retry, the
 * time every try and the repair share, and the longest reply, in tokens.
 */
export const MODEL_CALL = Object.freeze({
  attempts: 3,
  backoffMs: Object.freeze([1000, 4000]),
  budgetMs: 240_000,
  maxTokens: 4096,
});

/** The secrets a token looks like: GitHub's, `sk-` keys, AWS key ids, a JWT; and a bearer credential. */
const SECRETS = Object.freeze([
  /\bgh[pousr]_[A-Za-z0-9]{16,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{16,}/g,
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]*/g,
]);
const BEARER = /\b(Bearer)\s+[A-Za-z0-9\-._~+/]+=*/gi;
export const MASK = '[masked]';

/** `text` with every token-shaped string replaced by `[masked]`. Masking twice changes nothing. */
export function maskSecrets(text) {
  let out = String(text ?? '');
  for (const pattern of SECRETS) out = out.replace(pattern, MASK);
  return out.replace(BEARER, `$1 ${MASK}`);
}

/**
 * @param {{ system: string, user: string,
 *   check: ((value: unknown) => { errors: string[], reply: unknown }) | { safeParse: Function },
 *   schema?: { name: string, schema: object }, env?: Record<string, string | undefined>,
 *   fetch?: typeof fetch, sleep?: (ms: number) => Promise<void>, call?: typeof MODEL_CALL,
 *   title?: string, stream?: boolean }} input
 * @returns {Promise<{ ok: boolean, error: string | null, model: string | null, reply: unknown, reason: string | null }>}
 */
export async function askModel({
  system,
  user,
  check,
  schema,
  env = {},
  fetch,
  sleep = wait,
  call = MODEL_CALL,
  title = 'omni loop',
  stream = false,
} = {}) {
  const key = env[KEY_VAR];
  if (!key) return failure(NO_KEY, null, `${KEY_VAR} is not set`);
  const model = env[MODEL_VAR] || DEFAULT_MODEL;
  if (typeof fetch !== 'function') return failure(UNAVAILABLE, model, 'model unavailable (no fetch given)');

  const messages = [
    { role: 'system', content: maskSecrets(system) },
    { role: 'user', content: maskSecrets(user) },
  ];
  const deadline = Date.now() + call.budgetMs;
  const body = (conversation) => ({
    model,
    temperature: 0,
    max_tokens: call.maxTokens,
    ...(stream ? { stream: true } : {}),
    ...(schema ? { response_format: { type: 'json_schema', json_schema: { name: schema.name, strict: true, schema: schema.schema } } } : {}),
    messages: conversation,
  });
  const request = (conversation) => ask({ fetch, sleep, call, deadline, key, title, body: body(conversation) });

  const first = await request(messages);
  if (!first.ok) return failure(UNAVAILABLE, model, unavailable(first.status));
  const checked = runCheck(check, parseJson(first.content));
  if (checked.reply !== null) return { ok: true, error: null, model, reply: checked.reply, reason: null };

  const repair = await request([
    ...messages,
    { role: 'assistant', content: first.content },
    {
      role: 'user',
      content: `Your reply did not fit the shape asked for: ${checked.errors.join('; ')}. Reply again with only the JSON object, in that shape.`,
    },
  ]);
  if (!repair.ok) return failure(UNAVAILABLE, model, unavailable(repair.status));
  const repaired = runCheck(check, parseJson(repair.content));
  if (repaired.reply !== null) return { ok: true, error: null, model, reply: repaired.reply, reason: null };
  return failure(REFUSED, model, `model reply invalid: ${repaired.errors.join('; ')}`);
}

function failure(error, model, reason) {
  return { ok: false, error, model, reply: null, reason };
}

const unavailable = (status) => `model unavailable (${status})`;

/** The caller's check run on `value`: `{ errors, reply }`, `reply` null when refused. Never throws. */
function runCheck(check, value) {
  try {
    if (value === undefined) return { errors: ['the reply must be one JSON object'], reply: null };
    if (check && typeof check.safeParse === 'function') {
      const parsed = check.safeParse(value, { error: KIT_MESSAGES });
      if (parsed.success) return { errors: [], reply: parsed.data };
      const issues = parsed.error?.issues ?? [];
      const errors = issues.map((issue) => `${issue.path?.length ? issue.path.join('.') : '(root)'}: ${issue.message}`);
      return { errors: errors.length ? errors : ['the reply does not fit the schema'], reply: null };
    }
    if (typeof check === 'function') {
      const out = check(value) ?? {};
      const errors = Array.isArray(out.errors) ? out.errors : [];
      if (errors.length === 0 && out.reply !== undefined && out.reply !== null) return { errors, reply: out.reply };
      return { errors: errors.length ? errors : ['the reply does not fit the shape asked for'], reply: null };
    }
    return { errors: ['no check was given for the reply'], reply: null };
  } catch (error) {
    return { errors: [`the reply could not be checked: ${error?.message ?? error}`], reply: null };
  }
}

/** One request, tried again on a failure worth trying again, within the budget. */
async function ask({ fetch, sleep, call, deadline, key, title, body }) {
  let outcome = { ok: false, status: 'timeout', retry: false };
  for (let attempt = 1; attempt <= call.attempts; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return { ok: false, status: 'timeout' };
    outcome = await once({ fetch, key, title, body, signal: AbortSignal.timeout(remaining) });
    if (outcome.ok || !outcome.retry || attempt === call.attempts) return outcome;
    const pause = call.backoffMs[attempt - 1] ?? call.backoffMs.at(-1) ?? 0;
    if (Date.now() + pause >= deadline) return outcome;
    await sleep(pause);
  }
  return outcome;
}

async function once({ fetch, key, title, body, signal }) {
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'x-title': title },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) {
      response.body?.cancel().catch(() => {});
      return { ok: false, status: response.status, retry: retriable(response.status) };
    }
    return { ok: true, content: await readContent(response) };
  } catch (error) {
    if (error instanceof ModelError) return { ok: false, status: error.code, retry: retriable(error.code) };
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return { ok: false, status: 'timeout', retry: false };
    return { ok: false, status: 'network error', retry: true };
  }
}

function retriable(status) {
  const code = Number(status);
  return code === 408 || code === 429 || code >= 500;
}

/** An error OpenRouter reported after the request was accepted: inside the stream, or in the body. */
class ModelError extends Error {
  constructor(code) {
    super(`model error ${code}`);
    this.code = code ?? 'error';
  }
}

/** The reply's text: from OpenRouter's server-sent events when streamed, else from its JSON body. */
async function readContent(response) {
  if (!(response.headers.get('content-type') ?? '').includes('text/event-stream')) {
    const data = await response.json();
    if (data?.error) throw new ModelError(data.error.code);
    return data?.choices?.[0]?.message?.content ?? '';
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  const line = (text) => {
    if (!text.startsWith('data:')) return false;
    const data = text.slice(5).trim();
    if (data === '[DONE]') return true;
    let chunk;
    try {
      chunk = JSON.parse(data);
    } catch {
      return false;
    }
    if (chunk?.error) throw new ModelError(chunk.error.code);
    content += chunk?.choices?.[0]?.delta?.content ?? '';
    return false;
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf('\n');
    while (newline !== -1) {
      const text = buffer.slice(0, newline).replace(/\r$/, '');
      buffer = buffer.slice(newline + 1);
      if (line(text)) {
        reader.cancel().catch(() => {});
        return content;
      }
      newline = buffer.indexOf('\n');
    }
  }
  line(buffer + decoder.decode());
  return content;
}

/** The JSON object in the model's text, a code fence around it allowed; `undefined` when there is none. */
function parseJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end < start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
