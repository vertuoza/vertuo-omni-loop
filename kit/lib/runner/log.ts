// What a runner reads from a job's log (PRD 1830): the tail it sends the app every few seconds, cut
// to the last 200 lines and at most 16 KB, and the last pull request of the job's repository the run
// printed, which the app links once the job is done. And its live lines (PRD 1904): the whole lines
// after the runner's cursor, each numbered by its 1-based line number in the log, sent at most 2,000
// lines and 256 KB per report.

import { parseIssue } from '../ids.ts';
import type { IssueNumber, PrdNumber } from '../ids.ts';

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

/** The readable log's `Done: …` line, which the run's hand-off follows, and a `PR: <link>` line. */
const DONE_LINE = /^(?:\d{2}:\d{2}:\d{2} )?Done: (?:ok|error) · /;
const PR_LINE = /^(?:\d{2}:\d{2}:\d{2} )?PR: (\S+)$/;

/**
 * The job's pull request in its readable log (bug 2365), or `null`: the first
 * `https://github.com/<repo>/pull/<n>` its hand-off (the lines after `Done: …`) names, else the last
 * `PR: <link>` line, which only a pull request the job opened writes. A link the job only read never
 * counts, nor another repository's.
 */
export function lastPullRequest(log: string, repo: string): string | null {
  const link = new RegExp(`https://github\\.com/${escape(repo)}/pull/\\d+(?!\\d)`, 'i');
  const lines = log.split('\n');
  const done = lines.findLastIndex((line) => DONE_LINE.test(line));
  const handedOff = done < 0 ? undefined : lines.slice(done + 1).flatMap((line) => link.exec(line)?.[0] ?? [])[0];
  const opened = lines.flatMap((line) => {
    const found = PR_LINE.exec(line)?.[1];
    return found === undefined ? [] : (link.exec(found)?.[0] ?? []);
  });
  return handedOff ?? opened.at(-1) ?? null;
}

/**
 * What a yolo job's hand-off ended on (PRD 2223): `answers` for `/omni:yolo-fix <prd>`, `held` for
 * `/omni:yolo <prd>`, `ready` for `/omni:pr-care <prd>`. `stopped` (PRD 2375) is a yolo job that exited
 * 0 with no hand-off line for its PRD: it stopped mid-way. A `/omni:mega-bug-fix` job is `stopped` too
 * when its hand-off ends on the line that resumes its fix ({@link fixOutcome}).
 */
export type RunOutcome = 'answers' | 'held' | 'ready' | 'stopped';

/** The skills whose job has a hand-off line to miss (PRD 2375). */
export type HandOffSkill = 'yolo' | 'yolo-fix';

const OUTCOMES: Readonly<Record<string, RunOutcome>> = { 'yolo-fix': 'answers', yolo: 'held', 'pr-care': 'ready' };
const STAMP = /^\d{2}:\d{2}:\d{2} /;
/** The line claude prints when one of the session's hooks fails, which may come after the hand-off (#2388). */
const HOOK_FAILED = /^[A-Za-z]+ hook \[.*\] failed: /;

/**
 * The outcome the run's last non-empty line names for PRD `prd` (the yolo skill's hand-off always ends
 * on its next command), or `null` for any other line, a line naming another PRD, or an empty log. The
 * runner's `hh:mm:ss ` stamp, when the line has one, is ignored, and so is a failed hook's line after it.
 * For a job of `skill` (`yolo` or `yolo-fix`, PRD 2375) a last line that is no hand-off for `prd` is
 * `stopped` instead of `null`.
 */
export function runOutcome(log: string, prd: PrdNumber, skill?: HandOffSkill): RunOutcome | null {
  const match = /^\/omni:([a-z-]+) (\d+)$/.exec(lastLine(log));
  const outcome = match?.[1] !== undefined && Object.hasOwn(OUTCOMES, match[1]) ? OUTCOMES[match[1]] : undefined;
  if (outcome !== undefined && match?.[2] === String(prd)) return outcome;
  return skill === undefined ? null : 'stopped';
}

/** The run's last non-empty line, without the runner's stamp, a failed hook's line after it ignored. */
function lastLine(log: string): string {
  return (log.split('\n').map((line) => line.trim()).filter((line) => line !== '' && !HOOK_FAILED.test(line)).at(-1) ?? '').replace(STAMP, '');
}

/** The plan repository's issue a `/omni:mega-bug-fix` job's arguments name (`612`, `#612` or its URL), or `null` for a description. */
export function fixIssueOf(args: string): IssueNumber | null {
  const match = /^(?:#?|https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/)([1-9]\d*)$/.exec(args.trim());
  return match?.[1] === undefined ? null : parseIssue(match[1]);
}

/**
 * What a `/omni:mega-bug-fix` job for issue `issue` ended on: `stopped` when its last line is the line
 * that resumes the fix, `/omni:mega-bug-fix #<issue>`, which the skill's hand-off ends on when a rerun
 * can finish it (a target stuck at `limits.attempts`, or one that could not be reached); `null` for any
 * other line, so a fix that ended, or stopped for a person to decide, keeps reading Done.
 */
export function fixOutcome(log: string, issue: IssueNumber): RunOutcome | null {
  return lastLine(log) === `/omni:mega-bug-fix #${String(issue)}` ? 'stopped' : null;
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
