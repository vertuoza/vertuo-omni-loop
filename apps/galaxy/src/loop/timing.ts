// Where the time of one loop read goes (the `Server-Timing` header of /api/loop/*): a collector made for
// each request (./loop-reads-live.ts) and handed down through its dependencies, never shared between
// requests. Each step sums the time of its calls and counts them; the calls of one step may overlap (a
// change's detail reads four things at once), so a step's sum can pass the total. The header carries
// step names, durations and counts only: never a token, a URL, a repository or a person.
import type { GithubStore } from '@omni/github';
import type { LoopWorkspaces } from './loop.repository';

/** The steps of a read, in the header's order: the dependencies' setup, the sign-in's check, the
 * workspace's check, the installation token (found and minted, or nothing when kept), the GitHub
 * client's store round-trips, GitHub's answers (until their headers), and reading and checking them. */
const TIMED_STEPS = ['setup', 'auth', 'workspace', 'token', 'store', 'github', 'parse'] as const;
export type TimedStep = (typeof TIMED_STEPS)[number];

export type LoopTiming = {
  /** Runs `run`, adding its time and one call to `step`, whether it answers or throws. */
  time<T>(step: TimedStep, run: () => Promise<T>): Promise<T>;
  /** The same, for a step that does not wait. */
  timeSync<T>(step: TimedStep, run: () => T): T;
  /** `<step>;dur=<ms>;desc="<n> calls"` for every step, then `total;dur=<ms>` since the collector was made. */
  header(): string;
};

const ms = (duration: number) => (Math.round(duration * 10) / 10).toFixed(1);

/** A collector for one request, its clock in milliseconds (performance.now by default). */
export function loopTiming(clock: () => number = () => performance.now()): LoopTiming {
  const started = clock();
  const spent = new Map<TimedStep, { duration: number; calls: number }>(TIMED_STEPS.map((step) => [step, { duration: 0, calls: 0 }]));
  const add = (step: TimedStep, from: number) => {
    const kept = spent.get(step);
    if (!kept) return;
    kept.duration += clock() - from;
    kept.calls += 1;
  };
  return {
    async time(step, run) {
      const from = clock();
      try {
        return await run();
      } finally {
        add(step, from);
      }
    },
    timeSync(step, run) {
      const from = clock();
      try {
        return run();
      } finally {
        add(step, from);
      }
    },
    header() {
      const steps = TIMED_STEPS.map((step) => {
        const { duration, calls } = spent.get(step) ?? { duration: 0, calls: 0 };
        return `${step};dur=${ms(duration)};desc="${String(calls)} calls"`;
      });
      return [...steps, `total;dur=${ms(clock() - started)}`].join(', ');
    },
  };
}

/** A collector that keeps nothing, for a host read outside a request. */
export const untimed: LoopTiming = {
  time: (_step, run) => run(),
  timeSync: (_step, run) => run(),
  header: () => '',
};

/** `store` with each of its calls timed as `store`. */
export function timedStore(store: GithubStore, timing: LoopTiming): GithubStore {
  return {
    etag: (...args) => timing.time('store', () => store.etag(...args)),
    saveEtag: (...args) => timing.time('store', () => store.saveEtag(...args)),
    touchEtag: (...args) => timing.time('store', () => store.touchEtag(...args)),
    budget: (...args) => timing.time('store', () => store.budget(...args)),
    saveBudget: (...args) => timing.time('store', () => store.saveBudget(...args)),
    pause: (...args) => timing.time('store', () => store.pause(...args)),
  };
}

/** `workspaces` with its check timed as `workspace`. */
export function timedWorkspaces(workspaces: LoopWorkspaces, timing: LoopTiming): LoopWorkspaces {
  return { workspaceOf: (person, repo) => timing.time('workspace', () => workspaces.workspaceOf(person, repo)) };
}
