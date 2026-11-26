// `omni runner log <job>` (bug #3330): what `/omni:repair` reads of the job it repairs, from any runner of the workspace. The job may
// have run, and been lost, on another runner: its log is read through the app's lines route (`GET /api/runners/jobs/<id>/lines`), with
// the runner's sign-in, never from this machine's files. Printed: the job's status and why it ended, its line, and the last
// `LOG_TAIL` lines of its log (its tail when it holds no line), every secret masked (L-GDPR-2).
import { maskSecrets } from '../openrouter.ts';
import type { KitReads } from './api.ts';

/** The log lines printed at most: the tail a repair reads. */
const LOG_TAIL = 200;
/** The pages of lines read at most (the app answers 5,000 a page): a longer log prints the tail of what was read. */
const LOG_PAGES = 40;

/** A job as `omni runner log` reads it: its status, why it ended, its line, and its log's last lines. */
type JobLog = { status: string; reason: string | null; line: string | null; tail: string[] };

/** Job `job`'s log, read page by page through the app, keeping its last `LOG_TAIL` lines. */
export async function readJobLog(api: Pick<KitReads, 'lines'>, job: string): Promise<JobLog> {
  let read = await api.lines(job, 0);
  let tail = read.lines.length === 0 && read.logTail !== null ? read.logTail.split('\n') : read.lines.map((one) => one.text);
  for (let page = 1; page < LOG_PAGES && read.more && read.lines.length > 0; page += 1) {
    read = await api.lines(job, read.lines.at(-1)?.seq ?? 0);
    tail = [...tail, ...read.lines.map((one) => one.text)].slice(-LOG_TAIL);
  }
  return { status: read.status, reason: read.reason, line: read.line, tail: tail.slice(-LOG_TAIL) };
}

/** What `omni runner log` prints of `log`: `job <id>: <status>[, <reason>]`, its line, then its last lines, every secret masked. */
export function jobLogWords(job: string, log: JobLog): string {
  const head = [`job ${job}: ${log.status}${log.reason === null ? '' : `, ${log.reason}`}`, ...(log.line === null ? [] : [`line: ${log.line}`])];
  const body = log.tail.length === 0 ? ['log: none kept'] : [`log (last ${String(log.tail.length)} lines):`, ...log.tail];
  return maskSecrets([...head, ...body].join('\n'));
}
