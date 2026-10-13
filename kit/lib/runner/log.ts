// What a runner reads from a job's log (PRD 1830): the tail it sends the app every few seconds, cut
// to the last 200 lines and at most 16 KB, and the last pull request of the job's repository the run
// printed, which the app links once the job is done.

/** The most lines a log tail carries. */
export const TAIL_LINES = 200;
/** The most bytes a log tail carries. */
export const TAIL_BYTES = 16 * 1024;

/** The last {@link TAIL_LINES} lines of `log`, then cut from the front to at most {@link TAIL_BYTES} bytes. */
export function logTail(log: string): string {
  const lines = log.split('\n');
  if (lines.at(-1) === '') lines.pop();
  let tail = lines.slice(-TAIL_LINES).join('\n');
  const bytes = Buffer.from(tail, 'utf8');
  if (bytes.length > TAIL_BYTES) {
    tail = bytes.subarray(bytes.length - TAIL_BYTES).toString('utf8').replace(/^�+/, '');
    const cut = tail.indexOf('\n');
    if (cut >= 0) tail = tail.slice(cut + 1);
  }
  return tail;
}

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The last `https://github.com/<repo>/pull/<n>` in `log`, or `null`: another repository's never counts. */
export function lastPullRequest(log: string, repo: string): string | null {
  const pattern = new RegExp(`https://github\\.com/${escape(repo)}/pull/\\d+(?!\\d)`, 'gi');
  const found = log.match(pattern);
  return found?.at(-1) ?? null;
}

const UNITS: Readonly<Record<string, number>> = { s: 1000, m: 60_000, h: 3_600_000 };

/** A duration as `--timeout` takes it (`90s`, `45m`, `3h`), in milliseconds, or `null` when it is not one. */
export function parseDuration(text: string): number | null {
  const match = /^(\d+)([smh])$/.exec(text);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = UNITS[match[2] ?? ''] ?? 0;
  return amount > 0 ? amount * unit : null;
}
