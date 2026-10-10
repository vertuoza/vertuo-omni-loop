// The race as a phase machine (PRD 1359), pure and seeded: no DOM, no canvas and no clock of its own.
// `newRace()` stands the player's kart on the last starting place, `step(race, held, dt)` plays `dt`
// seconds with the buttons held, and `press(race, action)` answers a press; each returns a new race
// and the events of that step. The same seed and the same inputs give the same race.
//
// ready (PRESS START) -> countdown (3 · 2 · 1) -> race (GO) <-> paused (START; leaving the scene, a
// blurred window and a hidden tab pause it too, and only START resumes) -> finish (the player crossed the
// line at the end of the last lap: the results table and the score, given once; A races again, B leaves).
import { fleetSprite, MASCOTS } from '@omni/design';
import type { Action } from '../keys';
import type { KartHud, KartResults, KartRow } from '../scenes/kart.ts';
import { driveKart, kartAt, padOf, type Kart } from './kart';
import { RULES } from './rules';
import { advance, driveRival, lapOf, progressOf, pushApart, rivalTraits, START_PACE, type Driver, type Pace, type Rival } from './rivals';
import { LAPS, PAR_SECONDS, parseTrack, PLACES, type Track } from './track';

/** Frames add up to a countdown's end only to within what a float keeps. */
const EPSILON = 1e-9;

/** The countdown's numbers, one a second. */
const BEATS: readonly ('3' | '2' | '1')[] = ['3', '2', '1'];

export type Phase = 'ready' | 'countdown' | 'race' | 'paused' | 'finish';

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
  /** The results, once the player crossed the line at the end of the last lap; null before. */
  readonly finish: KartResults | null;
}

/** What happened in a step: GO, the finish with its score (given once), the player leaving from the pause, or asking for another race from the results. */
export type RaceEvent = { kind: 'go' } | { kind: 'finish'; score: number } | { kind: 'quit' } | { kind: 'again' };

export interface Stepped { race: Race; events: RaceEvent[] }

/** The mascots no rival drives yet, in the library's order, as drivers: they take the places the workspace's fleets leave empty. */
function fillers(used: readonly Driver[], count: number): Driver[] {
  const taken = new Set(used.map((d) => d.sprite));
  const out: Driver[] = [];
  for (const m of MASCOTS) {
    const look = fleetSprite(m, null);
    if (out.length < count && !taken.has(look.sprite)) { out.push({ ...look, color: null, name: m.toUpperCase() }); taken.add(look.sprite); }
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
  return { seed, track, phase: 'ready', resume: 'race', clock: 0, player: kartAt(start.x, start.y, track.heading), pace: START_PACE, rivals, finalAt: null, finish: null };
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

/** The score of a finish: the place's points, and a point per tenth of a second under the par time (none at or over it). */
export function scoreOf(place: number, seconds: number): number {
  const points = RULES.placePoints[Math.min(Math.max(place, 1), PLACES) - 1] ?? 0;
  return points + Math.max(0, Math.floor((PAR_SECONDS - seconds) * 10 + EPSILON));
}

/** The race clock's tenths of a second, as the clock shows them. */
const tenthsOf = (seconds: number) => Math.floor(seconds * 10 + EPSILON);

/**
 * The results when the player crosses the line at the end of the last lap, `clock` seconds in: the
 * rivals that already crossed first, by their time, then the ones still racing by how far along the
 * circuit they are, with no time. The player stands behind a rival that crossed at the same instant.
 */
function resultsOf(race: Race, clock: number): KartResults {
  const { track } = race;
  type Entry = { name: string; you: boolean; at: number | null; progress: number };
  const entries: Entry[] = race.rivals.map((r, i) => ({ name: r.driver.name ?? `RIVAL ${i + 1}`, you: false, at: r.doneAt ?? null, progress: progressOf(track, r.pace, r.kart) }));
  entries.push({ name: 'YOU', you: true, at: clock, progress: progressOf(track, race.pace, race.player) });
  entries.sort((a, b) => (a.at !== null && b.at !== null ? a.at - b.at || Number(a.you) - Number(b.you) : a.at !== null ? -1 : b.at !== null ? 1 : b.progress - a.progress));
  const rows: KartRow[] = entries.map((e, i) => ({ place: i + 1, name: e.name, tenths: e.at === null ? null : tenthsOf(e.at), you: e.you }));
  const place = rows.findIndex((r) => r.you) + 1;
  return { rows, place, tenths: tenthsOf(clock), score: scoreOf(place, clock) };
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
    const rivals = moved.rivals.map((r) => (r.pace.laps >= LAPS && r.doneAt == null ? { ...r, doneAt: clock } : r));
    const next: Race = { ...race, ...moved, rivals, clock, finalAt: race.finalAt ?? (moved.pace.laps >= LAPS - 1 ? clock : null) };
    if (moved.pace.laps < LAPS) return { race: next, events: [] };
    const finish = resultsOf(next, clock);
    return { race: { ...next, phase: 'finish', finish }, events: [{ kind: 'finish', score: finish.score }] };
  }
  return { race, events: [] };
}

/** A press: START starts the countdown, pauses it or the race, and resumes a pause; SELECT on the pause leaves. */
export function press(race: Race, action: Action): Stepped {
  if (action === 'start') {
    if (race.phase === 'finish') return { race, events: [] };
    if (race.phase === 'ready') return { race: { ...race, phase: 'countdown', clock: 0 }, events: [] };
    if (race.phase === 'paused') return { race: { ...race, phase: race.resume }, events: [] };
    return { race: { ...race, phase: 'paused', resume: race.phase }, events: [] };
  }
  if (action === 'select' && race.phase === 'paused') return { race, events: [{ kind: 'quit' }] };
  if (action === 'a' && race.phase === 'finish') return { race, events: [{ kind: 'again' }] };
  return { race, events: [] };
}

/** The race paused from outside (a blurred window, a hidden tab, leaving the scene): the countdown and the race pause, the rest stays. */
export function pause(race: Race): Race {
  return race.phase === 'countdown' || race.phase === 'race' ? { ...race, phase: 'paused', resume: race.phase } : race;
}

/** What the text layer shows of the race: its phase, and the countdown's number or the GO that follows it. */
export function hudOf(race: Race): KartHud {
  const { phase } = race;
  if (race.phase === 'finish' && race.finish) return { phase, beat: null, results: race.finish };
  if (race.phase === 'countdown') return { phase, beat: BEATS[Math.min(BEATS.length - 1, Math.floor(race.clock))] ?? '1' };
  const beat = race.phase === 'race' && race.clock < RULES.goBanner ? 'GO' : null;
  if (race.phase !== 'race' && race.phase !== 'paused') return { phase, beat };
  const final = race.finalAt !== null && race.clock - race.finalAt < RULES.finalBanner;
  return { phase, beat, run: { place: placeOf(race), lap: lapOf(race.pace), laps: LAPS, tenths: Math.floor(race.clock * 10 + EPSILON), final } };
}
