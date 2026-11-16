import { PrdNumberSchema, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { clock } from '../runners/page/parts';
import { jobHref } from '../runners/send/targets';

// What a mission's PRD waits on, as the Operation room and the Missions tab say it (PRD 2949 s5, the `fleet-room` screen's
// two waiting states), pure so each line is tested without a page. A PRD waits for a provider limit when its queued job resumes
// one that ended on a limit not yet lifted, and for room when its mission's supervisor wrote that no runner of its target can take
// the queued job. The line names the account that ran out and links its runner job as the Runners page does. A wait spends
// no tokens, so the line says `0`.

/** A queued job of a mission, as the repository read it. */
export interface QueuedJob {
  id: string;
  mission: string;
  /** `mission:<id>:prd:<n>:run:<n>`, which names the PRD. */
  key: string | null;
  /** The job whose provider limit this one waits out. */
  resumes: string | null;
  queuedAt: string;
}

/** The job a resume follows, as far as the line reads it. */
export interface LimitedJob {
  id: string;
  limitedUntil: string | null;
  /** The account that ran out. */
  account: string | null;
  /** Whether the runner guessed the reset: its job's last part says. */
  guessed: boolean;
}

/** What the repository read: the queued jobs, the jobs they resume, each mission's supervisor words. */
export interface WaitFacts {
  queued: readonly QueuedJob[];
  limited: readonly LimitedJob[];
  /** Each mission's `waiting_on`, by mission. */
  waitingOn: ReadonlyMap<string, string | null>;
}

/** One PRD's wait, in the words a line shows: the headline, then `lead`, the linked job, `tail`, and the state chip. */
export interface WaitLine {
  mission: string;
  prd: PrdNumber;
  kind: 'limit' | 'room';
  headline: string;
  lead: string;
  job: { href: string; label: string } | null;
  tail: string;
  chip: string;
}

const KEY = /^mission:[0-9a-f-]{36}:prd:([1-9][0-9]*):run:[1-9][0-9]*/;
const ROOM = /PRD ([1-9][0-9]*): waiting for room on the fleet's runners/g;

/** The PRD a mission job's key names; null for a key of no PRD. */
function prdOfKey(key: string | null): PrdNumber | null {
  const match = key === null ? null : KEY.exec(key);
  const parsed = PrdNumberSchema.safeParse(Number(match?.[1]));
  return parsed.success ? parsed.data : null;
}

const jobWords = (id: string): string => `job ${id.slice(0, 8)}`;
const slot = (mission: string, prd: PrdNumber): string => `${mission}:${String(prd)}`;

function limitLine(job: QueuedJob, prd: PrdNumber, before: LimitedJob, until: string): WaitLine {
  const at = clock(until);
  return {
    mission: job.mission,
    prd,
    kind: 'limit',
    headline: `Provider limit reached until ${at} · waiting until ${at}${before.guessed ? ' (guessed)' : ''}`,
    lead: before.account === null ? '' : `${before.account} ran out · `,
    job: { href: jobHref(before.id), label: jobWords(before.id) },
    tail: ` · tokens spent waiting 0 · next try ${at}`,
    chip: `Waiting until ${at}`,
  };
}

function roomLine(mission: string, prd: PrdNumber, job: QueuedJob | undefined): WaitLine {
  return {
    mission,
    prd,
    kind: 'room',
    headline: 'All runners are busy · waiting for room',
    lead: '',
    job: job === undefined ? null : { href: jobHref(job.id), label: jobWords(job.id) },
    tail: ' queued · tokens spent waiting 0',
    chip: 'Waiting for room',
  };
}

/** The newest queued job of each PRD of each mission, by slot. */
function newestJobs(queued: readonly QueuedJob[]): Map<string, QueuedJob> {
  const newest = new Map<string, QueuedJob>();
  for (const job of queued.toSorted((a, b) => b.queuedAt.localeCompare(a.queuedAt))) {
    const prd = prdOfKey(job.key);
    if (prd !== null && !newest.has(slot(job.mission, prd))) newest.set(slot(job.mission, prd), job);
  }
  return newest;
}

/** The PRDs a mission's supervisor wrote as waiting for room. */
function roomPrds(words: string | null): PrdNumber[] {
  return [...(words ?? '').matchAll(ROOM)].flatMap((match) => {
    const prd = PrdNumberSchema.safeParse(Number(match[1]));
    return prd.success ? [prd.data] : [];
  });
}

/** The waits of these facts at `now`, one per PRD: a limit wins over room, a PRD with no queued job waits on no limit. */
export function limitWaitsOf({ queued, limited, waitingOn }: WaitFacts, now: Date): WaitLine[] {
  const lines = new Map<string, WaitLine>();
  const newest = newestJobs(queued);
  for (const job of newest.values()) {
    const prd = prdOfKey(job.key);
    const before = limited.find((one) => one.id === job.resumes);
    if (prd === null || before?.limitedUntil == null || Date.parse(before.limitedUntil) <= now.getTime()) continue;
    lines.set(slot(job.mission, prd), limitLine(job, prd, before, before.limitedUntil));
  }
  for (const [mission, words] of waitingOn) {
    for (const prd of roomPrds(words)) if (!lines.has(slot(mission, prd))) lines.set(slot(mission, prd), roomLine(mission, prd, newest.get(slot(mission, prd))));
  }
  return [...lines.values()];
}

/** Whether what a mission's supervisor wrote for a PRD is one of these two waits, which their line says better. */
export const isWaitWords = (on: string): boolean => on.startsWith('waiting for a provider limit') || on.startsWith("waiting for room on the fleet's runners");
