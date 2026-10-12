// `/api/health` of the GitHub App (PRD 1723): whether this deployment is alive and its environment
// parses, and which commit it runs. Public, so it never shows a variable's value, an error's text or
// anything about a person, and it calls nothing outside: no GitHub, no Inngest, no OpenRouter, no
// fetch at all.
//
// Answers, always with `Cache-Control: no-store`:
//   - GET, the environment parses         → 200 `{ ok: true,  app: "omni-app", commit, checks: { env: "ok" } }`
//   - GET, the environment does not parse → 503 `{ ok: false, app: "omni-app", commit, checks: { env: "failed" } }`
//   - any other method                    → 405, `Allow: GET`
// `commit` is `VERCEL_GIT_COMMIT_SHA`, `null` when unset.
import { readCommit, readEnv, type EnvSource } from '../env.ts';

/** What `/api/health` answers. */
export type Health = {
  ok: boolean;
  app: 'omni-app';
  commit: string | null;
  checks: { env: 'ok' | 'failed' };
};

/** The health of the deployment whose environment is `source`, and its status. Never throws. */
export function healthOf(source: EnvSource): { status: 200 | 503; body: Health } {
  let env: 'ok' | 'failed' = 'ok';
  try {
    readEnv(source);
  } catch {
    // What failed is for the function logs (every other entry fails its start with it), never for this public body.
    env = 'failed';
  }
  const ok = env === 'ok';
  return { status: ok ? 200 : 503, body: { ok, app: 'omni-app', commit: readCommit(source), checks: { env } } };
}

const NO_STORE = { 'cache-control': 'no-store' };

const notAllowed = (): Response =>
  new Response('method not allowed', { status: 405, headers: { ...NO_STORE, allow: 'GET', 'content-type': 'text/plain; charset=utf-8' } });

/** The methods of `/api/health`, reading the environment from `source` on each request. */
export function healthRoute(source: () => EnvSource) {
  return {
    GET: (): Response => {
      const { status, body } = healthOf(source());
      return Response.json(body, { status, headers: NO_STORE });
    },
    POST: notAllowed,
    PUT: notAllowed,
    PATCH: notAllowed,
    DELETE: notAllowed,
  };
}
