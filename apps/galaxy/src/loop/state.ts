// What a loop is doing (PRD 1139, spec "The Loop page"): the one rule the Loop page reads, as a pure
// function of the loop's stored state, its times and the clock. The database stores only running,
// parked or stopped (supabase/migrations/20261108090000_loops.sql); the rest is read from the times,
// by the same rule as loop_is_silent() there:
//
// - parked: it stopped with PRDs waiting on people; stopped: it stopped with none;
// - sleeping: running, before the next wake its last tick set;
// - live: running, from that wake until 5 minutes past it (the tick is running), or before its first
//   tick set a wake, until an hour after its last push (a first tick may run a whole wave);
// - silent: running, past that: the session died. An unreadable time reads silent, never live.

/** How long past its next wake a running loop stays live before it reads silent. */
export const SILENT_AFTER_MS = 5 * 60 * 1000;

/** How long a loop with no wake yet (its first tick is running) stays live after its last push. */
export const FIRST_TICK_MS = 60 * 60 * 1000;

export type StoredLoopState = 'running' | 'parked' | 'stopped';
export type LoopState = 'live' | 'sleeping' | 'parked' | 'stopped' | 'silent';

/** A loop as the rule reads it: its stored state, its last push and its next wake. */
export type LoopTimes = { state: StoredLoopState; seen_at: string; next_wake_at: string | null };

/** live, sleeping, parked, stopped or silent: the loop `row` at `now` (ms). */
export function loopState(row: LoopTimes, now: number): LoopState {
  if (row.state !== 'running') return row.state;
  if (row.next_wake_at === null) {
    const seen = Date.parse(row.seen_at);
    return Number.isFinite(seen) && now < seen + FIRST_TICK_MS ? 'live' : 'silent';
  }
  const wake = Date.parse(row.next_wake_at);
  if (!Number.isFinite(wake)) return 'silent';
  if (now < wake) return 'sleeping';
  return now < wake + SILENT_AFTER_MS ? 'live' : 'silent';
}
