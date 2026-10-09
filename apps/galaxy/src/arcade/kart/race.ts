// The race as a phase machine (PRD 1359), pure and seeded: no DOM, no canvas and no clock of its own.
// `newRace()` stands the player's kart on the last starting place, `step(race, held, dt)` plays `dt`
// seconds with the buttons held, and `press(race, action)` answers a press; each returns a new race
// and the events of that step. The same seed and the same inputs give the same race.
//
// ready (PRESS START) -> countdown (3 · 2 · 1) -> race (GO) <-> paused (START; leaving the scene, a
// blurred window and a hidden tab pause it too, and only START resumes).
import { fleetSprite, MASCOTS } from '@omni/design';
import type { Action } from '../keys';
import type { KartHud } from '../scenes/kart.ts';
import { driveKart, kartAt, padOf, type Kart } from './kart';
import { RULES } from './rules';
import { advance, driveRival, lapOf, progressOf, pushApart, rivalTraits, START_PACE, type Driver, type Pace, type Rival } from './rivals';
import { LAPS, parseTrack, PLACES, type Track } from './track';

/** Frames add up to a countdown's end only to within what a float keeps. */
const EPSILON = 1e-9;

/** The countdown's numbers, one a second. */
const BEATS: readonly ('3' | '2' | '1')[] = ['3', '2', '1'];

export type Phase = 'ready' | 'countdown' | 'race' | 'paused';

export interface Race {
  readonly seed: number;
  readonly track: Track;
  readonly phase: Phase;
  /** Where a pause resumes: the phase it interrupted. */
  readonly resume: 'countdown' | 'race';
  /** Seconds into the countdown, and then seconds of race. */
  readonly clock: number;
  readonly player: Kart;
  /** The player's laps and waypoints, and the five rivals on the grid. */
  readonly pace: Pace;
  readonly rivals: readonly Rival[];
  /** The race clock at which the player's last lap began: FINAL LAP shows from there; null before it. */
  readonly finalAt: number | null;
}

/** What happened in a step: the race went from the countdown to GO, or the player left from the pause. */
export type RaceEvent = { kind: 'go' } | { kind: 'quit' };

export interface Stepped { race: Race; events: RaceEvent[] }

/** The mascots no rival drives yet, in the library's order, as drivers: they take the places the workspace's fleets leave empty. */
function fillers(used: readonly Driver[], count: number): Driver[] {
  const taken = new Set(used.map((d) => d.sprite));
  const out: Driver[] = [];
  for (const m of MASCOTS) {
    const look = fleetSprite(m, null);
    if (out.length < count && !taken.has(look.sprite)) { out.push({ ...look, color: null }); taken.add(look.sprite); }
  }
  return out;
}

/**
 * A race on `track`, the player on the last starting place and `cast` (the rivals' drivers) on the
 * others, all facing the way the line runs; nothing moves until START. Fewer than five rivals in the
 * cast: the next mascots fill the places.
 */
export function newRace({ seed, track = parseTrack(), cast = [] }: { seed: number; track?: Track; cast?: readonly Driver[] }): Race {
  const start = track.places[track.places.length - 1];
  if (!start) throw new Error('a circuit with no starting place');
  const drivers = [...cast.slice(0, PLACES - 1)];
  drivers.push(...fillers(drivers, PLACES - 1 - drivers.length));
  const traits = rivalTraits(seed, drivers.length);
  const rivals = drivers.map((driver, i): Rival => {
    const place = track.places[i] ?? start;
    const trait = traits[i] ?? { skill: 1, offset: 0 };
    return { driver, kart: kartAt(place.x, place.y, track.heading), pace: START_PACE, ...trait };
  });
  return { seed, track, phase: 'ready', resume: 'race', clock: 0, player: kartAt(start.x, start.y, track.heading), pace: START_PACE, rivals, finalAt: null };
}

/** `dt` seconds of the race with the buttons held, played in the same short steps whatever the frame took: the player, the rivals, the karts pushed apart and the laps counted. */
function drive(race: Race, held: ReadonlySet<Action>, dt: number): Pick<Race, 'player' | 'pace' | 'rivals'> {
  const { track } = race;
  const pad = padOf(held);
  const steps = Math.max(1, Math.ceil(dt / RULES.subStep));
  let { player, pace, rivals } = race;
  for (let i = 0; i < steps; i++) {
    const was = player;
    player = driveKart(track.map, player, pad, dt / steps);
    pace = advance(track, pace, was, player);
    const ahead = progressOf(track, pace, player);
    rivals = rivals.map((r) => driveRival(track, r, dt / steps, ahead));
    const [p, ...others] = pushApart([player, ...rivals.map((r) => r.kart)]);
    if (p) player = p;
    rivals = rivals.map((r, j) => { const kart = others[j]; return kart ? { ...r, kart } : r; });
  }
  return { player, pace, rivals };
}

/** The player's place, 1 to 6: one more than the karts as far along the racing line or further (side by side on the grid, the player is behind: it stands on the last place). */
export function placeOf(race: Race): number {
  const { track } = race;
  const mine = progressOf(track, race.pace, race.player);
  return 1 + race.rivals.filter((r) => progressOf(track, r.pace, r.kart) >= mine).length;
}

/** Plays `dt` seconds (no more than `RULES.maxDt` of them) with the buttons held. Before GO, and paused, nothing moves. */
export function step(race: Race, held: ReadonlySet<Action>, dt: number): Stepped {
  const t = Math.min(Math.max(dt, 0), RULES.maxDt);
  if (race.phase === 'countdown') {
    const clock = race.clock + t;
    if (clock < RULES.countdown - EPSILON) return { race: { ...race, clock }, events: [] };
    return { race: { ...race, phase: 'race', clock: 0 }, events: [{ kind: 'go' }] };
  }
  if (race.phase === 'race') {
    const clock = race.clock + t;
    const moved = drive(race, held, t);
    return { race: { ...race, ...moved, clock, finalAt: race.finalAt ?? (moved.pace.laps >= LAPS - 1 ? clock : null) }, events: [] };
  }
  return { race, events: [] };
}

/** A press: START starts the countdown, pauses it or the race, and resumes a pause; SELECT on the pause leaves. */
export function press(race: Race, action: Action): Stepped {
  if (action === 'start') {
    if (race.phase === 'ready') return { race: { ...race, phase: 'countdown', clock: 0 }, events: [] };
    if (race.phase === 'paused') return { race: { ...race, phase: race.resume }, events: [] };
    return { race: { ...race, phase: 'paused', resume: race.phase }, events: [] };
  }
  if (action === 'select' && race.phase === 'paused') return { race, events: [{ kind: 'quit' }] };
  return { race, events: [] };
}

/** The race paused from outside (a blurred window, a hidden tab, leaving the scene): the countdown and the race pause, the rest stays. */
export function pause(race: Race): Race {
  return race.phase === 'countdown' || race.phase === 'race' ? { ...race, phase: 'paused', resume: race.phase } : race;
}

/** What the text layer shows of the race: its phase, and the countdown's number or the GO that follows it. */
export function hudOf(race: Race): KartHud {
  const { phase } = race;
  if (race.phase === 'countdown') return { phase, beat: BEATS[Math.min(BEATS.length - 1, Math.floor(race.clock))] ?? '1' };
  const beat = race.phase === 'race' && race.clock < RULES.goBanner ? 'GO' : null;
  if (race.phase !== 'race' && race.phase !== 'paused') return { phase, beat };
  const final = race.finalAt !== null && race.clock - race.finalAt < RULES.finalBanner;
  return { phase, beat, run: { place: placeOf(race), lap: lapOf(race.pace), laps: LAPS, tenths: Math.floor(race.clock * 10 + EPSILON), final } };
}
