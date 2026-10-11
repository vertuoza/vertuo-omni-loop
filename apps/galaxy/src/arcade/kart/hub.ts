// A player's side of the grid (PRD 1572): it joins the workspace's link as the player, keeps who
// Presence holds and says what the GRID screen shows. The rules are grid.ts's, the wire is net.ts's;
// this holds the link's life: joining, joined, dropped and trying again by itself, refused.
import type { KartLink, KartLinkStatus } from '../types';
import { GRID_JOINING_LINE, GRID_OUT_LINE, type KartGridView } from '../scenes/kart.ts';
import { placesOf, rowsOf, startingOrder, starterOf } from './grid';
import { presenceOf, readGrid, readMessage, type GridPlayer } from './net';
import { RULES } from './rules';

/** What the GRID says besides the players. */
export const GRID_LINES = Object.freeze({
  joining: GRID_JOINING_LINE,
  alone: 'WAITING FOR RACERS',
  start: 'START RACE',
  full: `GRID FULL · ${RULES.places} RACERS`,
  reconnecting: 'RECONNECTING…',
  raceOn: (racers: number) => `RACE ON · ${racers} RACERS`,
  out: GRID_OUT_LINE,
});

/** How long a race is still on after the last state heard from it, in ms: a late arrival reads RACE ON for as long as karts are heard. */
const RACE_ON_MS = 3000;

/** The line for the player `me` among `players`: who they wait for, or that they start; `racers` karts heard racing, when any, is a race on and the player waits. */
function lineFor(players: readonly GridPlayer[], me: GridPlayer, racers: number): string {
  if (racers > 0) return GRID_LINES.raceOn(racers);
  const { seated } = placesOf(players);
  const starter = starterOf(players);
  if (!seated.some((p) => p.id === me.id)) return GRID_LINES.full;
  if (!starter || seated.length < 2) return GRID_LINES.alone;
  return starter.id === me.id ? GRID_LINES.start : `WAITING FOR ${starter.name.toUpperCase()}`;
}

/** What the GRID shows: the link's state, the players in their starting order and the line under them. */
function gridView(state: KartGridView['state'], players: readonly GridPlayer[], me: GridPlayer, racers: number): KartGridView {
  if (state === 'out') return { state, rows: [], line: GRID_LINES.out };
  const everyone = players.some((p) => p.id === me.id) ? players : [...players, me];
  const rows = rowsOf(everyone).map(({ player, seat }) => ({ id: player.id, name: player.name, hero: player.hero, fleet: player.fleet, best: player.best, you: player.id === me.id, seat }));
  if (state === 'joining') return { state, rows, line: GRID_LINES.joining };
  if (state === 'reconnecting') return { state, rows, line: GRID_LINES.reconnecting };
  return { state, rows, line: lineFor(everyone, me, racers) };
}

/** A race that starts: its id, its seed and the players in their starting order. */
export interface RaceStart { race: string; seed: number; order: readonly GridPlayer[] }

/** The player's grid: what it shows now, a new try after it was out of reach, starting the race, the race's messages and leaving the channel. */
export interface GridSession {
  view(): KartGridView;
  retry(): void;
  leave(): void;
  /** START RACE: the start is sent to everyone in the starting order and answered for this player to enter; null when this player may not start now (not the one who starts, alone, a race on, no link). */
  start(): RaceStart | null;
  /** Sends a message of the race to the others on the channel. */
  send(body: unknown): void;
  /** Listens to the race's messages, with the id of the player who sent each; answers how to stop. */
  listen(fn: (from: string, body: unknown) => void): () => void;
}

const STATE: Record<KartLinkStatus, KartGridView['state']> = { joined: 'joined', reconnecting: 'reconnecting', refused: 'out' };

/**
 * Joins the grid over `link` as `me` and tells `onChange` each time what it shows. Presence is read
 * as it syncs; an entry that does not read is no player.
 */
export function openGrid(link: KartLink, me: GridPlayer, onChange: (view: KartGridView) => void, onStart: (start: RaceStart) => void = () => undefined): GridSession {
  let state: KartGridView['state'] = 'joining';
  let players: GridPlayer[] = [];
  let gone = false;
  const listeners = new Set<(from: string, body: unknown) => void>();
  // The karts heard racing, by player id, and when (ms): a player who arrives during a race reads RACE ON.
  const heard = new Map<string, number>();
  let expiry: ReturnType<typeof setTimeout> | null = null;
  const racers = () => {
    const now = Date.now();
    return [...heard].filter(([, at]) => now - at < RACE_ON_MS).length;
  };
  const view = () => gridView(state, players, me, racers());
  const tell = () => { if (!gone) onChange(view()); };
  const watch = () => {
    if (expiry) clearTimeout(expiry);
    expiry = setTimeout(() => { expiry = null; tell(); }, RACE_ON_MS);
  };
  const hear = (from: string, body: unknown) => {
    for (const fn of listeners) fn(from, body);
    const message = readMessage(body);
    if (!message) return;
    if (message.kind === 'state') { heard.set(from, Date.now()); watch(); tell(); return; }
    if (message.kind === 'leave') { heard.delete(from); tell(); return; }
    // A start: whoever it names takes it, from a player who holds a place, and nobody else.
    if (!message.order.some((p) => p.id === me.id) || !message.order.some((p) => p.id === from)) return;
    heard.clear();
    onStart({ race: message.race, seed: message.seed, order: message.order });
  };
  const join = () => {
    state = 'joining';
    players = [];
    link.join(presenceOf(me), {
      presence: (entries) => { players = readGrid(entries); tell(); },
      message: hear,
      status: (status) => { state = STATE[status]; tell(); },
    });
  };
  join();
  tell();
  return {
    view,
    retry() { if (!gone && state === 'out') { join(); tell(); } },
    leave() { gone = true; if (expiry) clearTimeout(expiry); link.leave(); },
    start() {
      const everyone = players.some((p) => p.id === me.id) ? players : [...players, me];
      const { seated } = placesOf(everyone);
      if (gone || state !== 'joined' || racers() > 0 || starterOf(everyone)?.id !== me.id || seated.length < 2) return null;
      const seed = Math.floor(Math.random() * 2 ** 31);
      const start: RaceStart = { race: `${me.id.slice(0, 24)}-${Date.now().toString(36)}`, seed, order: startingOrder(seated) };
      link.send({ kind: 'start', ...start });
      heard.clear();
      return start;
    },
    send(body) { if (!gone) link.send(body); },
    listen(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  };
}
