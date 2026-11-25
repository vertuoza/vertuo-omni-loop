// The App's own 5xx (PRD omni-loop-34 s3, spec "The error table"): a galaxy route that answers 5xx writes one row of
// `app_errors` (supabase/migrations/20270129180000_supervisor.sql), its message masked before the write (L-GDPR-2) and cut
// to 500 characters, so the Supervisor's `route-failing` check reads it. The database masks it a second time on the way
// in. Writing never fails what wrote: a refusal is one line in the log.

/** What reads as a credential, as app_error_mask() masks it: GitHub, Anthropic, OpenAI and Supabase keys, JWTs, bearer
 * tokens and `key=value` secrets. */
const MASKS: readonly [RegExp, string][] = [
  [/(gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{16,})/g, '[masked]'],
  [/(sk-[A-Za-z0-9_-]{16,}|sb_(secret|publishable)_[A-Za-z0-9_-]{8,})/g, '[masked]'],
  [/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[masked]'],
  [/([Bb]earer|[Tt]oken)\s+[A-Za-z0-9._~+/=-]{8,}/g, '$1 [masked]'],
  [/((password|passwd|secret|token|api[_-]?key|apikey|authorization)["']?\s*[:=]\s*["']?)[^\s"'&,;]+/gi, '$1[masked]'],
];

/** `text` with every credential it holds masked. */
export function maskSecrets(text: string): string {
  return MASKS.reduce((masked, [pattern, by]) => masked.replace(pattern, by), text);
}

/** The most of a message a row keeps. */
export const APP_ERROR_CHARS = 500;

/** One 5xx of the galaxy, as a route saw it. */
export type AppError = { workspace: string | null; route: string; status: number; message: string };

/** The row written: the service, the route on one line, the message masked and cut. */
export type AppErrorRow = { workspace_id: string | null; service: 'galaxy'; route: string; status: number; message: string };

/** Writes one row; may throw. */
export type AppErrorStore = { write: (row: AppErrorRow) => Promise<void> };

/** The row `error` is written as. */
export function appErrorRow(error: AppError): AppErrorRow {
  return {
    workspace_id: error.workspace,
    service: 'galaxy',
    route: error.route.replace(/[\r\n]/g, ' ').slice(0, 200),
    status: Math.min(599, Math.max(500, Math.trunc(error.status))),
    message: maskSecrets(error.message).slice(0, APP_ERROR_CHARS),
  };
}

/** A writer of the galaxy's 5xx: masks and writes; never throws. Null store (no service role here): nothing is written. */
export function appErrorWriter(store: AppErrorStore | null, log: (line: string) => void): (error: AppError) => Promise<void> {
  return async (error) => {
    if (store === null) return;
    try {
      await store.write(appErrorRow(error));
    } catch (failure) {
      log(`app errors: the ${String(error.status)} of ${error.route} was not recorded — ${failure instanceof Error ? maskSecrets(failure.message) : 'the database failed'}`);
    }
  };
}
