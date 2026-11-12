// Test support: `fakeStepLedger` (PRD omni-loop-4 s1) is the ledger's saved steps in memory: each job's steps
// kept under its claim as background_job_steps keeps them, a claim that is no longer the job's answered
// `stale`, and every save and renew written down, so a test of a job's run, or of the runs after it, reads
// what was saved.
import type { Held, SaveStep, StepLedger } from '../src/jobs/ledger.ts';

/** What a fake step ledger was asked: each step saved (`<job> <step>`), each claim renewed (`<job>`). */
type StepCalls ={ saved: string[]; renewed: string[]; read: string[] };

/**
 * The ledger's saved steps in memory. `steps` seeds a job's saved steps by its id; `until` is when a renewed
 * claim runs out. A job is held by the claim it carries until `takeOver` gives it to another.
 */
export function fakeStepLedger({ steps = {}, until = '2027-01-17T09:05:00.000Z' }: { steps?: Record<string, Record<string, unknown>>; until?: string } = {}) {
  const kept = new Map<string, Map<string, unknown>>(Object.entries(steps).map(([id, values]) => [id, new Map(Object.entries(values))]));
  const holder = new Map<string, string>();
  const calls: StepCalls = { saved: [], renewed: [], read: [] };
  const holds = ({ id, claim }: Held) => (holder.get(id) ?? claim) === claim;
  const ledger: StepLedger = {
    save: ({ id, claim, step, value }: SaveStep) => {
      if (!holds({ id, claim })) return Promise.resolve('stale');
      const job = kept.get(id) ?? new Map<string, unknown>();
      job.set(step, value);
      kept.set(id, job);
      calls.saved.push(`${id} ${step}`);
      return Promise.resolve('saved');
    },
    stepsOf: (job) => {
      calls.read.push(job.id);
      return Promise.resolve(holds(job) ? new Map(kept.get(job.id)) : 'stale');
    },
    renew: (job) => {
      if (!holds(job)) return Promise.resolve('stale');
      calls.renewed.push(job.id);
      return Promise.resolve({ until });
    },
  };
  /** The saved steps of job `id`, by step. */
  const stepsOf = (id: string): Record<string, unknown> => Object.fromEntries(kept.get(id) ?? []);
  /** Another worker takes job `id` over under `claim`: the claim it had is stale from now on. */
  const takeOver = (id: string, claim: string) => holder.set(id, claim);
  return { ledger, calls, stepsOf, takeOver };
}
