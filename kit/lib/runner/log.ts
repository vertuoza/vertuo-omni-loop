// What a runner reads from a job's log (PRD 1830): the tail it sends the app every few seconds, cut
// to the last 200 lines and at most 16 KB, and the last pull request of the job's repository the run
// printed, which the app links once the job is done. And its live lines (PRD 1904): the whole lines
// after the runner's cursor, each numbered by its 1-based line number in the log, sent at most 2,000
// lines and 256 KB per report.

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

/** The most lines one report carries (the app's `REPORT_LINES_MAX`). */
export const REPORT_LINES = 2000;
/** The most bytes of lines one report carries, as JSON. */
export const REPORT_BYTES = 256 * 1024;
/** The longest line the app stores (its `JOB_LINE_CHARS`): a longer one is cut, never refused. */
export const LINE_CHARS = 600;

/** `line` cut to {@link LINE_CHARS} characters, never between the two halves of one character. */
function cutLine(line: string): string {
  if (line.length <= LINE_CHARS) return line;
  const cut = line.slice(0, LINE_CHARS);
  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
}

/**
 * The lines of `log` after the first `cursor`, each cut to {@link LINE_CHARS}. While the job runs,
 * the last line is left until it ends with a newline, since it may still be being written; once the
 * job has `ended`, it goes too.
 */
export function linesAfter(log: string, cursor: number, { ended }: { ended: boolean }): string[] {
  const lines = log.split('\n');
  const last = lines.pop() ?? '';
  if (ended && last !== '') lines.push(last);
  return lines.slice(cursor).map(cutLine);
}

/** The first lines of `lines` one report carries: at most {@link REPORT_LINES}, and at most {@link REPORT_BYTES} as JSON. */
export function reportBatch(lines: readonly string[]): string[] {
  let bytes = 2;
  let count = 0;
  for (const line of lines.slice(0, REPORT_LINES)) {
    bytes += Buffer.byteLength(JSON.stringify(line)) + (count > 0 ? 1 : 0);
    if (bytes > REPORT_BYTES) break;
    count += 1;
  }
  return lines.slice(0, count);
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
