// A player's side of the grid (PRD 1572): it joins the workspace's link as the player, keeps who
// Presence holds and says what the GRID screen shows. The rules are grid.ts's, the wire is net.ts's;
// this holds the link's life: joining, joined, dropped and trying again by itself, refused.
import type { KartLink, KartLinkStatus } from '../types';
import { GRID_JOINING_LINE, GRID_OUT_LINE, type KartGridView } from '../scenes/kart.ts';
import { placesOf, rowsOf, starterOf } from './grid';
import { presenceOf, readGrid, type GridPlayer } from './net';
import { RULES } from './rules';

/** What the GRID says besides the players. */
export const GRID_LINES = Object.freeze({
  joining: GRID_JOINING_LINE,
  alone: 'WAITING FOR RACERS',
  start: 'START RACE',
  full: `GRID FULL · ${RULES.places} RACERS`,
  reconnecting: 'RECONNECTING…',
  out: GRID_OUT_LINE,
});

/** The line for the player `me` among `players`: who they wait for, or that they start. */
function lineFor(players: readonly GridPlayer[], me: GridPlayer): string {
  const { seated } = placesOf(players);
  const starter = starterOf(players);
  if (!seated.some((p) => p.id === me.id)) return GRID_LINES.full;
  if (!starter || seated.length < 2) return GRID_LINES.alone;
  return starter.id === me.id ? GRID_LINES.start : `WAITING FOR ${starter.name.toUpperCase()}`;
}

/** What the GRID shows: the link's state, the players in their starting order and the line under them. */
function gridView(state: KartGridView['state'], players: readonly GridPlayer[], me: GridPlayer): KartGridView {
  if (state === 'out') return { state, rows: [], line: GRID_LINES.out };
  const everyone = players.some((p) => p.id === me.id) ? players : [...players, me];
  const rows = rowsOf(everyone).map(({ player, seat }) => ({ id: player.id, name: player.name, hero: player.hero, fleet: player.fleet, best: player.best, you: player.id === me.id, seat }));
  if (state === 'joining') return { state, rows, line: GRID_LINES.joining };
  if (state === 'reconnecting') return { state, rows, line: GRID_LINES.reconnecting };
  return { state, rows, line: lineFor(everyone, me) };
}

/** The player's grid: what it shows now, a new try after it was out of reach, and leaving the channel. */
export interface GridSession {
  view(): KartGridView;
  retry(): void;
  leave(): void;
}

const STATE: Record<KartLinkStatus, KartGridView['state']> = { joined: 'joined', reconnecting: 'reconnecting', refused: 'out' };

/**
 * Joins the grid over `link` as `me` and tells `onChange` each time what it shows. Presence is read
 * as it syncs; an entry that does not read is no player.
 */
export function openGrid(link: KartLink, me: GridPlayer, onChange: (view: KartGridView) => void): GridSession {
  let state: KartGridView['state'] = 'joining';
  let players: GridPlayer[] = [];
  let gone = false;
  const view = () => gridView(state, players, me);
  const tell = () => { if (!gone) onChange(view()); };
  const join = () => {
    state = 'joining';
    players = [];
    link.join(presenceOf(me), {
      presence: (entries) => { players = readGrid(entries); tell(); },
      message: () => { /* the race's messages: the next slices read them */ },
      status: (status) => { state = STATE[status]; tell(); },
    });
  };
  join();
  tell();
  return {
    view,
    retry() { if (!gone && state === 'out') { join(); tell(); } },
    leave() { gone = true; link.leave(); },
  };
}
