// Whether Claude is working (PRD 757, spec "Working, on the app"): the one rule the PRD, fix and /ask
// pages read, as a pure function of the freshest heartbeat, the open questions and the time.
//
// - asking: a question is open (a round of the dossier, or of the terminal's session on /ask);
// - working: nothing is open, and a heartbeat came under 3 minutes ago from a session that has not ended;
// - idle: otherwise, including when there is no heartbeat or it cannot be read.

/** How long a heartbeat keeps a session working: the kit sends one a minute, so three missed ones end it. */
export const WORKING_FOR_MS = 3 * 60 * 1000;

export const WORKING_STATES = ['working', 'asking', 'idle'] as const;
export type WorkingState = (typeof WORKING_STATES)[number];

/** A heartbeat as the rule reads it: when it was last seen, and when its session ended. */
export type WorkingPing = { seen_at: string; ended_at: string | null };

/** working, asking or idle: `openQuestions` open rounds, the freshest `ping` (or null) at `now` (ms). */
export function workingState(ping: WorkingPing | null, openQuestions: number, now: number): WorkingState {
  if (openQuestions > 0) return 'asking';
  if (!ping || ping.ended_at !== null) return 'idle';
  const seen = Date.parse(ping.seen_at);
  if (!Number.isFinite(seen)) return 'idle';
  return now - seen < WORKING_FOR_MS ? 'working' : 'idle';
}
