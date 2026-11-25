import type { Seat } from '../../supervisor/api/supervisor.contract';
import { headerOf, spanWords, tokenWords } from '../../supervisor/page/model';
import type { Runner } from '../runners.contract';

// The Supervisor's seat on the Runners page (PRD omni-loop-34 s8), pure, as the before/after page draws it (3.A): the
// runner that holds the seat keeps one slot for it, its last pip in cyan with `+1 Supervisor` beside the job slots, and
// a seat strip under the slots line: `Supervisor · watching`, the last look, the tokens of the day and the account the
// seat thinks on, with Move for an owner. The page's subtitle counts the kept slot out of the job slots and names it.
// An owner places the seat from any runner card while the workspace has none. The seat is read through the Supervisor
// API's service (../../supervisor/api/), never the runner.

/** What the page knows of the Supervisor: the workspace (for an owner's Place and Move) and its seat, or none. */
export interface SeatOnPage { workspace: string; seat: Seat | null }

/** The seat's state on its strip, as the Supervisor page's header reads it. */
export type StripState = 'watching' | 'paused' | 'offline' | 'limit';

export interface SeatStrip {
  state: StripState;
  /** `Supervisor · watching`. */
  title: string;
  /** `last look 40 s`, or `no look yet`. */
  look: string;
  /** `412k tokens`, today's. */
  tokens: string;
  /** The account the seat thinks on (the runner's first Claude account that is not out); null when none is. */
  account: string | null;
}

const STATE_WORDS: Readonly<Record<StripState, string>> = { watching: 'watching', paused: 'paused', offline: 'offline', limit: 'thinking paused' };

/** Whether `runner` holds the seat. */
export const holdsSeat = (runner: Pick<Runner, 'id'>, seat: Seat | null | undefined): boolean => seat?.runner === runner.id;

/** The slots a runner keeps for the Supervisor: one on the runner that holds the seat, else none. */
export const keptSlots = (runner: Pick<Runner, 'id'>, seat: Seat | null | undefined): number => (holdsSeat(runner, seat) ? 1 : 0);

/** The account the seat thinks on, as the runner picks it (kit/lib/runner/runner.ts): its first Claude account that is not out. */
export function seatAccount(runner: Pick<Runner, 'health'>): string | null {
  return runner.health?.accounts?.find((account) => account.agent === 'claude' && account.state !== 'out')?.id ?? null;
}

/** The seat strip of the runner that holds the seat. */
export function seatStrip(seat: Seat, runner: Pick<Runner, 'health'>, nowIso: string): SeatStrip {
  const header = headerOf(seat, null, nowIso);
  const state: StripState = header.state === 'none' ? 'offline' : header.state;
  return {
    state,
    title: `Supervisor · ${STATE_WORDS[state]}`,
    look: seat.lastLookAt === null ? 'no look yet' : `last look ${spanWords(Date.parse(nowIso) - Date.parse(seat.lastLookAt))}`,
    tokens: `${tokenWords(seat.tokensToday)} tokens`,
    account: seatAccount(runner),
  };
}

/** The page's subtitle's kept slot: `1 kept for the Supervisor` while an online runner holds the seat, else null. */
export function keptWords(runners: readonly Pick<Runner, 'id' | 'state'>[], seat: Seat | null | undefined): string | null {
  return runners.some((runner) => runner.state !== 'offline' && holdsSeat(runner, seat)) ? '1 kept for the Supervisor' : null;
}

/** The runners an owner may move the seat to: every runner of the workspace but the one that holds it. */
export const moveTargets = <R extends Pick<Runner, 'id' | 'name'>>(runners: readonly R[], seat: Seat): R[] => runners.filter((runner) => runner.id !== seat.runner);
