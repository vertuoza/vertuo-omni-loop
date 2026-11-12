// The `embed` Edge Function's handler (PRD 2728): `POST {texts}` answers `{model: "gte-small", vectors}`,
// one normalized 384-long vector per text, in order. A pure function: the model session is passed in, so
// the tests run it with a fake one and never call the model.
//
// - Only the service role gets in. `verify_jwt` (supabase/config.toml) has the gateway check the token's
//   signature; this reads its `role` claim, and anyone but `service_role` gets 401 before the body is read.
// - At most 64 texts per call (more is refused whole, 413), each cut to 2,000 characters, never refused.
// - Nothing it receives is logged, and no answer repeats it: a text may be a workspace's private knowledge.

/** The model, as Supabase's `Supabase.ai.Session('gte-small')` runs it. */
export interface EmbedSession {
  run(text: string, options: { mean_pool: boolean; normalize: boolean }): Promise<unknown>;
}

export const MODEL = 'gte-small';
export const DIMENSIONS = 384;
export const MAX_TEXTS = 64;
export const MAX_CHARACTERS = 2000;

const answer = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

const isServiceRole = (authorization: string | null): boolean => {
  const match = /^Bearer (\S+)$/.exec(authorization ?? '');
  const payload = match?.[1]?.split('.')[1];
  if (payload === undefined) return false;
  try {
    const claims: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof claims === 'object' && claims !== null && 'role' in claims && claims.role === 'service_role';
  } catch {
    return false;
  }
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

export async function handleEmbed(request: Request, session: EmbedSession): Promise<Response> {
  if (request.method !== 'POST') return answer(405, { error: 'POST only' }, { allow: 'POST' });
  if (!isServiceRole(request.headers.get('authorization'))) return answer(401, { error: 'service role only' });
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
