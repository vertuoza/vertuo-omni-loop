// The App's own 5xx (PRD omni-loop-34 s2, spec "3. The error table"): every request of the omni-app's routes that
// answers 5xx, or throws (Vercel answers 500), writes one row of `app_errors` (supabase/migrations/
// 20270129160000_supervisor.sql): service `omni-app`, the route's path (never its query), the status, and a message of
// at most 500 characters masked before the write (L-GDPR-2), which the table masks again. The Supervisor's
// route-failing check reads them (../supervisor/checks.ts). Kept 14 days and 10,000 rows (the table's retention,
// L-GDPR-4).
//
// A route function installs the sink once, when it loads (`recordAppErrorsTo`); ./run-log.ts's `loggedHandler` writes
// through it. Writing an error never changes the answer: a sink that throws or a database that refuses is ignored.
import { maskSecrets } from 'omni-loop/kit/lib/openrouter.ts';
import type { Connection } from '../approved-check/record.ts';
import { serviceDb } from '../server-event/service-db.ts';

/** One 5xx: the route's path, the status, what was said, and the workspace when the route knows it. */
export type AppError = { route: string; status: number; message: string; workspace?: string | null };

export type AppErrorSink = (error: AppError) => Promise<void>;

/** The row an error writes: its message masked, on one line, cut to 500 characters; its route cut to 200. */
export function appErrorRow(error: AppError) {
  const route = error.route.replace(/[\r\n]+/g, ' ').trim().slice(0, 200) || '/';
  const message = maskSecrets(error.message).replace(/\s+/g, ' ').trim().slice(0, 500);
  return { service: 'omni-app' as const, route, status: Math.min(599, Math.max(500, Math.trunc(error.status))), message, workspace_id: error.workspace ?? null };
}

/** The sink writing to `app_errors` as the service role on `connection`; throws when the database refuses. */
function appErrorsTo(connection: Connection): AppErrorSink {
  const db = serviceDb(connection);
  return async (error) => {
    const answer = await db.from('app_errors').insert(appErrorRow(error));
    if (answer.error) throw new Error(`the database refused: ${answer.error.message}`);
  };
}

let installed: AppErrorSink | null = null;

/** Installs the sink every route of this function writes its 5xx through; null, none. */
export function recordAppErrorsTo(sink: AppErrorSink | null): void {
  installed = sink;
}

/** Installs the sink of the App's environment: `app_errors` on its database, or none where it has no database. */
export function recordAppErrorsOf(env: { supabase?: Connection | null | undefined }): void {
  recordAppErrorsTo(env.supabase ? appErrorsTo(env.supabase) : null);
}

/** The installed sink, or null. */
export function installedAppErrors(): AppErrorSink | null {
  return installed;
}

/** Writes `error` through `sink`; never throws. */
export async function recordAppError(error: AppError, sink: AppErrorSink | null): Promise<void> {
  if (!sink) return;
  try {
    await sink(error);
  } catch {
    // An error the table could not keep never changes the answer.
  }
}
