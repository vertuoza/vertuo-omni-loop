import { parsePr, parsePrd, type PrNumber, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';

// What the Operation room says of QA and of a job's cost (PRD 3001 s5, the `fleet-room` screen), pure so each line is tested
// without a page: a job's tokens on its row (`41k tokens`, or `tokens unknown`), and QA's now line (`Checking PR 12 · round 1 of 2`,
// `Waiting for the preview`).

/** The four counts a runner sends when a job ends, as `runner_jobs.tokens` keeps them. */
export interface JobTokens {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/** The kinds of event that end or judge a job: their row ends with that job's tokens. */
const TOKEN_KINDS: ReadonlySet<string> = new Set(['job-ended', 'checked', 'reviewed']);

const compact = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n);

/** `41k tokens`, or `tokens unknown` when the agent gave none: the four counts added, as the Ask page adds them. */
export const tokensWords = (tokens: JobTokens | null | undefined): string =>
  tokens == null ? 'tokens unknown' : `${compact(tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite)} tokens`;

/** The events whose row carries a job's tokens, given those the repository read by job; the others are left as they are. */
export function withTokens<E extends { kind: string; job: string | null; tokens?: JobTokens | null }>(events: readonly E[], byJob: ReadonlyMap<string, JobTokens | null>): E[] {
  return events.map((event) => (event.job !== null && TOKEN_KINDS.has(event.kind) ? { ...event, tokens: byJob.get(event.job) ?? null } : event));
}

/** A QA job that runs: its mission, its PRD, its round, and whether it waits for the preview. */
export interface QaJob {
  mission: string;
  prd: PrdNumber;
  round: 1 | 2;
  previewWait: boolean;
}

const KEY = /^mission:([0-9a-f-]{36}):prd:([1-9][0-9]*):run:[1-9][0-9]*:qa:([12])$/;

/** The QA job a runner job is, from its mission key and the end of its log; null for a job that is not one. */
export function qaJobOf({ mission, key, logTail }: { mission: string; key: string | null; logTail: string }): QaJob | null {
  const match = key === null ? null : KEY.exec(key);
  if (match === null) return null;
  const last = logTail.trimEnd().split('\n').at(-1) ?? '';
  return { mission, prd: parsePrd(Number(match[2])), round: match[3] === '2' ? 2 : 1, previewWait: last.includes('Waiting for the preview') };
}

/** QA's now line: `Waiting for the preview`, else `Checking PR 12 · round 1 of 2` (`PRD 3001` while its feature PR is not known from the events). */
export function qaNowWords(job: QaJob, pr: PrNumber | null): string {
  if (job.previewWait) return 'Waiting for the preview';
  return `Checking ${pr === null ? `PRD ${String(job.prd)}` : `PR ${String(pr)}`} · round ${String(job.round)} of 2`;
}

/** The pull request a link names, when it is one. */
export const prOfLink = (link: string | null): PrNumber | null => {
  const match = link === null ? null : /\/pull\/([1-9][0-9]*)/.exec(link);
  return match === null ? null : parsePr(Number(match[1]));
};
