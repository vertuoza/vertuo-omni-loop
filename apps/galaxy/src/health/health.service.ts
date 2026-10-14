// The arcade's health (PRD 1723, s3; ADR-0095): what GET /api/health answers. Two checks: the
// environment parses (the read `instrumentation.ts`'s register() makes at startup) and the galaxy's
// database answers one query within 3 seconds (./health.repository.ts). Every check `ok` is 200,
// anything else 503, never cached. The body names checks only: never a variable's value, an error's
// text or anything about a person, and nothing here calls GitHub, Inngest or OpenRouter.
import 'server-only';
import { serverCommit, serverEnv } from '../env.ts';
import { healthRepository } from './health.repository.ts';

/** How long the database has to answer before its check is `failed`. */
const SUPABASE_LIMIT_MS = 3_000;

type Check = 'ok' | 'failed';

/** What /api/health answers. */
type HealthBody = {
  ok: boolean;
  app: 'galaxy';
  commit: string | null;
  checks: { env: Check; supabase: Check };
};

/** What the health reads: each throws, or rejects, when its check fails. */
export type HealthDeps = {
  /** Parses the environment; throws when it does not. */
  env: () => unknown;
  /** The deployed commit, or null. */
  commit: () => string | null;
  /** Resolves when the database answered. */
  supabase: () => Promise<void>;
};

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function envCheck(env: HealthDeps['env']): Check {
  try {
    env();
    return 'ok';
  } catch {
    return 'failed';
  }
}

/** `ok` when `probe` resolves within the limit; `failed` when it throws, rejects or is too slow. */
async function supabaseCheck(probe: HealthDeps['supabase']): Promise<Check> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<Check>((resolve) => { timer = setTimeout(() => { resolve('failed'); }, SUPABASE_LIMIT_MS); });
  const answered = (async (): Promise<Check> => {
    try {
      await probe();
      return 'ok';
    } catch {
      return 'failed';
    }
  })();
  try {
    return await Promise.race([answered, late]);
  } finally {
    clearTimeout(timer);
  }
}

function commitOf(commit: HealthDeps['commit']): string | null {
  try {
    return commit();
  } catch {
    return null;
  }
}

/** The health answer: 200 when every check is `ok`, 503 otherwise, with `Cache-Control: no-store`. */
export async function healthResponse(deps: HealthDeps): Promise<Response> {
  const checks = { env: envCheck(deps.env), supabase: await supabaseCheck(deps.supabase) };
  const ok = checks.env === 'ok' && checks.supabase === 'ok';
  const body: HealthBody = { ok, app: 'galaxy', commit: commitOf(deps.commit), checks };
  return Response.json(body, { status: ok ? 200 : 503, headers: NO_STORE });
}

/** The health's real dependencies: this server's environment, and its database read as nobody. */
export function liveHealth(): HealthDeps {
  return {
    env: serverEnv,
    commit: serverCommit,
    supabase: () => healthRepository(serverEnv().supabase).ping(),
  };
}
