import type { JevOutcome, JevQuestion } from './client';
import type { JevDecisionEntry } from './decisions';
import { MASTER_KEY_VAR, openSecret } from './secret-box';
import type { JevCall, JevDecisionSettings } from './store';

// The resolver (PRD 812 s2): a decision's mode × Jev's outcome gives the answer that counts, who
// decided, and the one row the record keeps, Jev's answer beside today's (the old one).
//
//   Off     today's answer; Jev is not called and nothing is logged.
//   Shadow  today's answer; Jev's is logged beside it.
//   On      Jev's answer, when it answered inside the question at or above the decision's confidence
//           floor, even against today's (decision 4); today's otherwise (under the floor, failed, no key).
//
// Jev never blocks anything (decision 6): unreadable settings read as Off, a missing or unopenable key
// and any failure of the call count today's answer, and a log that cannot be written is only reported.
// `resolve` is pure; `decide` runs one decision against injected dependencies (./resolve-live.ts).

/** What came of trying Jev: its outcome, no key stored, or a stored key that could not be opened. */
export type JevAttempt = JevOutcome | { kind: 'no-key' } | { kind: 'unopened'; message: string };

/** The answer that counts, who decided, Jev's confidence when it decided, and the row to log (none when Off). */
export interface Counted<V> {
  value: V | null;
  decidedBy: 'jev' | 'old';
  confidence: number | null;
  call: JevCall | null;
}

export const OUTSIDE = 'Jev answered outside the decision’s options.';
export const NO_KEY = 'No TypeSafe key is stored.';

export interface Resolve<I, V> {
  entry: JevDecisionEntry<I, V>;
  settings: JevDecisionSettings;
  old: V | null;
  /** Null when the decision is Off: Jev was not tried. */
  attempt: JevAttempt | null;
  /** The round, outbox item or issue the decision is about. */
  ref: string | null;
}

export function resolve<I, V>({ entry, settings, old, attempt, ref }: Resolve<I, V>): Counted<V> {
  const today: Counted<V> = { value: old, decidedBy: 'old', confidence: null, call: null };
  if (settings.mode === 'off' || !attempt) return today;
  const oldAnswer = old === null ? null : entry.show(old);
  const base: JevCall = {
    decision: entry.name, mode: settings.mode, outcome: 'failed', model: null, jevAnswer: null, confidence: null,
    oldAnswer, counted: oldAnswer, decidedBy: 'old', ref, reason: null, ms: null,
  };
  if (attempt.kind === 'no-key') return { ...today, call: { ...base, outcome: 'no-key', reason: NO_KEY } };
  if (attempt.kind === 'unopened') return { ...today, call: { ...base, reason: attempt.message } };
  if (attempt.kind === 'failed') return { ...today, call: { ...base, reason: attempt.message, ms: attempt.ms } };

  const heard = { ...base, model: attempt.model, confidence: attempt.confidence, ms: attempt.ms };
  const value = entry.value(attempt.answer, settings);
  if (value === null) return { ...today, call: { ...heard, jevAnswer: String(attempt.answer), reason: OUTSIDE } };
  const logged = { ...heard, jevAnswer: entry.show(value) };
  const underFloor = attempt.confidence < settings.floor;
  if (settings.mode === 'shadow' || underFloor) {
    return { ...today, call: { ...logged, outcome: underFloor ? 'under-floor' : 'answered' } };
  }
  return {
    value, decidedBy: 'jev', confidence: attempt.confidence,
    call: { ...logged, outcome: 'answered', counted: entry.show(value), decidedBy: 'jev' },
  };
}

/** The workspace's key: none stored, opened, or stored but not openable here. */
export type JevKey = { kind: 'none' } | { kind: 'key'; key: string } | { kind: 'failed'; message: string };

/** Opens a sealed key with the deployment's master key, never throwing. */
export function openKey(sealed: { ciphertext: string; iv: string } | null, master: Buffer | null): JevKey {
  if (!sealed) return { kind: 'none' };
  if (!master) return { kind: 'failed', message: `${MASTER_KEY_VAR} is not set on this deployment, so the stored key cannot be opened.` };
  try {
    return { kind: 'key', key: openSecret(sealed, master) };
  } catch {
    return { kind: 'failed', message: 'The stored key could not be opened with this deployment’s master key.' };
  }
}

/** What `decide` reaches: the decision's settings, the workspace's key, Jev, and the record. */
export interface JevDecideDeps {
  settings(workspace: string, decision: string): Promise<JevDecisionSettings>;
  key(workspace: string): Promise<JevKey>;
  ask(key: string, state: unknown, question: JevQuestion): Promise<JevOutcome>;
  log(workspace: string, call: JevCall): Promise<void>;
}

export interface Decide<I, V> {
  workspace: string;
  entry: JevDecisionEntry<I, V>;
  input: I;
  /** Today's path. Off runs only it, exactly as before; Shadow and On run it beside Jev. */
  old: () => Promise<V | null>;
  ref: string | null;
}

const why = (err: unknown) => (err instanceof Error ? err.message : String(err));
const OFF = (decision: string): JevDecisionSettings => ({ decision, mode: 'off', threshold: 0.5, floor: 0.4 });

async function attempt<I, V>(deps: JevDecideDeps, { workspace, entry, input }: Decide<I, V>): Promise<JevAttempt> {
  const key = await deps.key(workspace).catch((err: unknown): JevKey => ({ kind: 'failed', message: `The key could not be read (${why(err)}).` }));
  if (key.kind === 'none') return { kind: 'no-key' };
  if (key.kind === 'failed') return { kind: 'unopened', message: key.message };
  try {
    return await deps.ask(key.key, entry.state(input), entry.question);
  } catch (err) {
    return { kind: 'failed', reason: 'network', status: null, message: `Jev could not be asked (${why(err)}).`, ms: 0 };
  }
}

export async function decide<I, V>(deps: JevDecideDeps, run: Decide<I, V>): Promise<Counted<V>> {
  const { workspace, entry, ref } = run;
  const settings = await deps.settings(workspace, entry.name).catch((err: unknown) => {
    console.error(`jev: ${entry.name} reads as Off, its settings could not be read (${why(err)})`);
    return OFF(entry.name);
  });
  if (settings.mode === 'off') return resolve({ entry, settings, old: await run.old(), attempt: null, ref });

  const [old, tried] = await Promise.all([
    run.old().catch((err: unknown) => {
      console.error(`jev: ${entry.name}'s old answer failed (${why(err)})`);
      return null;
    }),
    attempt(deps, run),
  ]);
  const counted = resolve({ entry, settings, old, attempt: tried, ref });
  if (counted.call) {
    await deps.log(workspace, counted.call).catch((err: unknown) => console.error(`jev: a ${entry.name} call was not logged (${why(err)})`));
  }
  return counted;
}
