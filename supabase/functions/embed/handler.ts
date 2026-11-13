// The `embed` Edge Function's handler (PRD 2728): `POST {texts}` answers `{model: "gte-small", vectors}`,
// one normalized 384-long vector per text, in order. A pure function: the model session is passed in, so
// the tests run it with a fake one and never call the model.
//
// - Only a server key gets in: the caller's Bearer must equal, compared in constant time, one of the keys the
//   function's environment holds (`SUPABASE_SERVICE_ROLE_KEY`, the legacy service-role JWT, and every value
//   of `SUPABASE_SECRET_KEYS`, the new `sb_secret_…` keys, which are not JWTs). `verify_jwt` is off
//   (supabase/config.toml) because the gateway refuses a key that is not a JWT. Anyone else gets 401 before
//   the body is read.
// - At most 8 texts per call (more is refused whole, 413), each cut to 2,000 characters, never refused. gte-small
//   cannot embed more within an Edge Function's CPU budget: 64 a call answered 546 in production (bug 2748).
// - Nothing it receives is logged, and no answer repeats it: a text may be a workspace's private knowledge.

/** The model, as Supabase's `Supabase.ai.Session('gte-small')` runs it. */
export interface EmbedSession {
  run(text: string, options: { mean_pool: boolean; normalize: boolean }): Promise<unknown>;
}

export const MODEL = 'gte-small';
export const DIMENSIONS = 384;
export const MAX_TEXTS = 8;
export const MAX_CHARACTERS = 2000;

const answer = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

/** Reads one variable of the function's environment (`Deno.env.get` in the edge runtime). */
export type ReadEnv = (name: string) => string | undefined;

/** The server keys the environment holds: the service-role key, and every value of `SUPABASE_SECRET_KEYS`. */
export const serverKeys = (env: ReadEnv): string[] => {
  const keys: string[] = [];
  const legacy = env('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy !== undefined && legacy !== '') keys.push(legacy);
  const secrets = env('SUPABASE_SECRET_KEYS');
  if (secrets === undefined) return keys;
  let parsed: unknown;
  try {
    parsed = JSON.parse(secrets);
  } catch {
    return keys;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return keys;
  for (const value of Object.values(parsed)) if (typeof value === 'string' && value !== '') keys.push(value);
  return keys;
};

const encoder = new TextEncoder();

/** Equal or not, in a time that depends on the lengths alone, never on where the first difference sits. */
const sameKey = (given: string, key: string): boolean => {
  const a = encoder.encode(given);
  const b = encoder.encode(key);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
};

const isServerKey = (authorization: string | null, keys: readonly string[]): boolean => {
  const given = /^Bearer (\S+)$/.exec(authorization ?? '')?.[1];
  if (given === undefined) return false;
  let found = false;
  for (const key of keys) found = sameKey(given, key) || found;
  return found;
};

const readTexts = async (request: Request): Promise<string[] | null> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body) || !('texts' in body)) return null;
  const texts = body.texts;
  if (!Array.isArray(texts) || !texts.every((text): text is string => typeof text === 'string')) return null;
  return texts;
};

/** The first 2,000 characters, counted by code point, so a character is never split in two. */
const cut = (text: string): string => Array.from(text).slice(0, MAX_CHARACTERS).join('');

const isVector = (value: unknown): value is number[] =>
  Array.isArray(value) && value.length === DIMENSIONS && value.every((x) => typeof x === 'number' && Number.isFinite(x));

export async function handleEmbed(request: Request, session: EmbedSession, env: ReadEnv): Promise<Response> {
  if (request.method !== 'POST') return answer(405, { error: 'POST only' }, { allow: 'POST' });
  if (!isServerKey(request.headers.get('authorization'), serverKeys(env))) return answer(401, { error: 'a server key only' });
  const texts = await readTexts(request);
  if (texts === null) return answer(400, { error: 'the body is {texts: string[]}' });
  if (texts.length > MAX_TEXTS) return answer(413, { error: `at most ${MAX_TEXTS} texts per call` });

  const vectors: number[][] = [];
  try {
    for (const text of texts) {
      const vector = await session.run(cut(text), { mean_pool: true, normalize: true });
      if (!isVector(vector)) return answer(500, { error: 'the model answered no vector' });
      vectors.push(vector);
    }
  } catch {
    return answer(500, { error: 'the model failed' });
  }
  return answer(200, { model: MODEL, vectors });
}
