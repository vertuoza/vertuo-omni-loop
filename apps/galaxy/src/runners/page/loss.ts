import type { BoardSave, Job, Runner } from '../runners.contract';
import { clock } from './parts';

// What the Runners page says of a lost job, its resume and the saves a runner keeps (PRD 2809, s7), as words: pure, so
// each line is tested without a page. A job its runner lost, with a resume queued, reads Lost · resuming and says who went
// silent, when, and which attempt comes next; the resume says it came after a loss and what came back; a chain that lost
// its third attempt reads Lost 3 times, each loss listed. Times are UTC, as the rest of the page gives them.

/** The reasons a runner lost a job: the three the database resumes (supabase/migrations/20270121100000_runner_resume.sql). */
const LOST_REASONS: readonly string[] = ['runner lost', 'the worktree could not be made', 'the tmux session could not be started'];

/** The attempts a chain has, the third being the last. */
const ATTEMPTS = 3;

const MIN = 60_000;
const HOUR = 60 * MIN;

type Lostable = Pick<Job, 'status' | 'reason'>;
type Chained = Pick<Job, 'id' | 'resumes' | 'attempt' | 'status' | 'reason' | 'runner' | 'endedAt' | 'resumeAfter'>;

const isLost = (job: Lostable): boolean => job.status === 'failed' && job.reason !== null && LOST_REASONS.includes(job.reason);

/** Whether the job is a chain's third loss: nothing more is queued, and a person sends it again. */
export const lostThrice = (job: Lostable & Pick<Job, 'attempt' | 'resumes'>): boolean => isLost(job) && (job.attempt ?? 1) >= ATTEMPTS && (job.resumes ?? null) !== null;

/** A job's lost state in words: `words` replaces the status, `why` goes under it, `resume` is the job that carries it on, `times` the losses of a chain (empty while it resumes). */
export type Loss = { words: 'Lost · resuming' | 'Lost 3 times'; why: string; resume: string | null; times: string[] };

const runnerName = (id: string | null, runners: readonly Pick<Runner, 'id' | 'name'>[]): string => runners.find((r) => r.id === id)?.name ?? 'A runner';

/** `in 5 min`, `in 2 h`; `in under 1 min` just before the wait ends; nothing once it did. */
function waitWords(until: string | null | undefined, now: Date): string {
  if (until === null || until === undefined) return '';
  const left = Date.parse(until) - now.getTime();
  if (!(left > 0)) return '';
  if (left < MIN) return ' in under 1 min';
  if (left < HOUR) return ` in ${String(Math.floor(left / MIN))} min`;
  return ` in ${String(Math.floor(left / HOUR))} h`;
}

const timeOf = (job: Pick<Job, 'endedAt'>): string => (job.endedAt === null ? '?' : clock(job.endedAt));

/** Every loss of a chain up to this job, oldest first: the ones still on the board. */
function lossesOf(job: Chained, jobs: readonly Chained[]): Chained[] {
  const found = [job];
  let earlier = job.resumes ?? null;
  while (earlier !== null && found.length < ATTEMPTS) {
    const before = jobs.find((other) => other.id === earlier);
    if (before === undefined) break;
    found.unshift(before);
    earlier = before.resumes ?? null;
  }
  return found;
}

/** The lost words of a job, or null for a job its runner did not lose, or lost with no resume queued and fewer than three attempts. */
export function lossOf(job: Chained, jobs: readonly Chained[], runners: readonly Pick<Runner, 'id' | 'name'>[], now: Date): Loss | null {
  if (!isLost(job)) return null;
  const resume = jobs.find((other) => other.resumes === job.id);
  if (resume !== undefined) {
    const next = resume.attempt ?? (job.attempt ?? 1) + 1;
    const why = `${runnerName(job.runner, runners)} went silent at ${timeOf(job)} · attempt ${String(next)} of ${String(ATTEMPTS)}${waitWords(resume.resumeAfter, now)}`;
    return { words: 'Lost · resuming', why, resume: resume.id, times: [] };
  }
  if (!lostThrice(job)) return null;
  const times = lossesOf(job, jobs).map(timeOf);
  return { words: 'Lost 3 times', why: `Lost at ${times.join(' · ')}`, resume: null, times };
}

/** Under a resume's line: `after a loss · job <8 characters>`, then `attempt <k> of 3`; null for a job that resumes none. */
export function resumeWords(job: Pick<Job, 'resumes' | 'attempt'>): { after: string; attempt: string } | null {
  if (job.resumes === null || job.resumes === undefined) return null;
  return { after: `after a loss · job ${job.resumes.slice(0, 8)}`, attempt: `attempt ${String(job.attempt ?? 2)} of ${String(ATTEMPTS)}` };
}

const plural = (count: number, one: string, many: string): string => `${String(count)} ${count === 1 ? one : many}`;

/** The ids of the jobs a resume carries on, oldest first, as far as the board shows them. */
function chainOf(job: Pick<Job, 'resumes'>, jobs: readonly Pick<Job, 'id' | 'resumes'>[]): string[] {
  const chain: string[] = [];
  let earlier = job.resumes ?? null;
  while (earlier !== null && chain.length < ATTEMPTS - 1) {
    chain.unshift(earlier);
    const id = earlier;
    earlier = jobs.find((other) => other.id === id)?.resumes ?? null;
  }
  return chain;
}

/**
 * Once a resume started, one line of what came back: `Resumed from the <time> save · <n> branches` for the saves that
 * reached the runner it runs on (a portable one anywhere, a local one only on its own runner), `<n> files stayed on <runner>`
 * for a local one that did not, `Started over: nothing was unsaved` when the chain left none. Null for a job that resumes
 * none, and for a resume still waiting for a runner.
 */
export function cameBackWords(
  job: Pick<Job, 'resumes' | 'status' | 'runner'>, jobs: readonly Pick<Job, 'id' | 'resumes'>[], saves: readonly BoardSave[], runners: readonly Pick<Runner, 'id' | 'name'>[],
): string | null {
  if (job.resumes === null || job.resumes === undefined || job.status === 'queued') return null;
  const chain = chainOf(job, jobs);
  const mine = saves.filter((save) => chain.includes(save.job));
  const here = runnerName(job.runner, runners);
  const restored = mine.filter((save) => save.kind === 'portable' || save.runner === here);
  const stayed = mine.filter((save) => save.kind === 'local' && save.runner !== here);
  if (mine.length === 0) return 'Started over: nothing was unsaved';
  const lines: string[] = [];
  const last = restored.map((save) => save.savedAt).sort().at(-1);
  if (last !== undefined) lines.push(`Resumed from the ${clock(last)} save · ${plural(restored.reduce((sum, save) => sum + save.branches, 0), 'branch', 'branches')}`);
  for (const runner of [...new Set(stayed.map((save) => save.runner))]) {
    lines.push(`${plural(stayed.filter((save) => save.runner === runner).reduce((sum, save) => sum + save.files, 0), 'file', 'files')} stayed on ${runner}`);
  }
  return lines.join(' · ');
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** An ISO time as `Wed 14:00`, UTC. */
const dayTime = (iso: string): string => `${DAYS[new Date(iso).getUTCDay()] ?? ''} ${clock(iso)}`;

/** A size in the page's short words: `900 B`, `5 KB`, `4.0 MB`, `2.5 GB`. */
function sizeWords(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 ** 2) return `${String(Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

/** Under a runner's name, what it keeps of local saves: `Keeps <size> until <day time>`, the last save's day and time; null when it keeps none. */
export function keepsWords(runner: string, saves: readonly BoardSave[]): string | null {
  const kept = saves.filter((save) => save.kind === 'local' && save.runner === runner).sort((a, b) => a.savedAt.localeCompare(b.savedAt));
  const last = kept.at(-1);
  if (last === undefined) return null;
  return `Keeps ${sizeWords(kept.reduce((sum, save) => sum + save.bytes, 0))} until ${dayTime(last.keepUntil)}`;
}

