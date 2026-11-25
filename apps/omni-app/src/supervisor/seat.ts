// The seat as the watch reads it (PRD omni-loop-34 s2, spec "1. The seat" and "The watcher of the watcher"). The seat
// looks every 2 minutes; the watch counts the looks it missed since its last one (or since it was placed, before its
// first), and reads it:
//
//   paused    an owner paused it: it is not offline, and the checks write their findings alone
//   offline   it missed 3 looks in a row: the watch raises the high finding "The Supervisor is offline since <time>
//             on <runner>" and sends one push, and the checks write their findings alone
//   limit     it used its daily tokens: it checks in without thinking, and the checks write their findings alone
//   watching  it looks: it turns the signals into findings itself
//
// Pure: `now` is given.
import { evidenceKey, type Fire } from './checks.ts';

/** How often the seat looks (spec: "otherwise every 2 minutes for a routine look"). */
export const LOOK_MS = 2 * 60_000;
/** The looks missed in a row that make the seat offline. */
const OFFLINE_AFTER_LOOKS = 3;

/** A workspace's seat, as the watch reads it. */
export type Seat = {
  workspace: string;
  runnerId: string;
  runnerName: string;
  paused: boolean;
  dailyTokens: number;
  /** The day `tokensUsed` counts (`YYYY-MM-DD`, the workspace's day), or null. */
  tokensDay: string | null;
  tokensUsed: number;
  lastLookAt: string | null;
  placedAt: string;
};

export type SeatState = 'watching' | 'paused' | 'offline' | 'limit';

/** The looks the seat missed in a row at `now`. */
export function missedLooks(seat: Seat, now: number): number {
  const since = Date.parse(seat.lastLookAt ?? seat.placedAt);
  return Math.max(0, Math.floor((now - since) / LOOK_MS));
}

/**
 * Whether the seat used its daily tokens. Its day is the workspace's, which the App does not read here: a day that is
 * today or yesterday in UTC still counts, so no time zone ends the limit early.
 */
function pastLimit(seat: Seat, now: number): boolean {
  if (seat.tokensDay === null || seat.tokensUsed < seat.dailyTokens) return false;
  const today = new Date(now).toISOString().slice(0, 10);
  const yesterday = new Date(now - 24 * 60 * 60_000).toISOString().slice(0, 10);
  return seat.tokensDay === today || seat.tokensDay === yesterday;
}

/** How the seat reads at `now`. */
export function seatState(seat: Seat, now: number): SeatState {
  if (seat.paused) return 'paused';
  if (missedLooks(seat, now) >= OFFLINE_AFTER_LOOKS) return 'offline';
  return pastLimit(seat, now) ? 'limit' : 'watching';
}

/** `iso` as a finding names a time: `2027-01-15 09:02 UTC`. */
function timeOf(iso: string): string {
  return `${new Date(iso).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/** The watcher of the watcher: the seat missed 3 looks in a row and nobody paused it. */
export function seatOffline(seat: Seat, now: number): Fire[] {
  if (seatState(seat, now) !== 'offline') return [];
  const since = seat.lastLookAt ?? seat.placedAt;
  const missed = missedLooks(seat, now);
  return [{
    fingerprint: `health:seat-offline:${seat.runnerId}`, check: 'seat-offline', kind: 'health', severity: 'high',
    title: `The Supervisor is offline since ${timeOf(since)} on ${seat.runnerName}`,
    checkLine: `Seat offline: ${String(missed)} looks missed in a row on ${seat.runnerName}`,
    figures: { missedLooks: missed, since },
    evidence: [{ of: 'runner', id: seat.runnerId }],
    evidenceKey: evidenceKey([seat.runnerId, since]),
  }];
}
