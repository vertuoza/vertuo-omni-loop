// The race as a phase machine (PRD 1359), pure and seeded: no DOM, no canvas and no clock of its own.
// `newRace()` stands the player's kart on the last starting place, `step(race, held, dt)` plays `dt`
// seconds with the buttons held, and `press(race, action)` answers a press; each returns a new race
// and the events of that step. The same seed and the same inputs give the same race.
//
// ready (PRESS START) -> countdown (3 · 2 · 1) -> race (GO) <-> paused (START; leaving the scene, a
// blurred window and a hidden tab pause it too, and only START resumes).
import type { Action } from '../keys';
import type { KartHud } from '../scenes/kart.ts';
import { driveKart, kartAt, padOf, type Kart } from './kart';
import { RULES } from './rules';
import { parseTrack, type Track } from './track';

/** Frames add up to a countdown's end only to within what a float keeps. */
const EPSILON = 1e-9;

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
}

/** What happened in a step: the race went from the countdown to GO, or the player left from the pause. */
export type RaceEvent = { kind: 'go' } | { kind: 'quit' };

export interface Stepped { race: Race; events: RaceEvent[] }

/** A race on `track`, the player on the last starting place facing the way the line runs; nothing moves until START. */
export function newRace({ seed, track = parseTrack() }: { seed: number; track?: Track }): Race {
  const start = track.places[track.places.length - 1];
  if (!start) throw new Error('a circuit with no starting place');
  return { seed, track, phase: 'ready', resume: 'race', clock: 0, player: kartAt(start.x, start.y, track.heading) };
}

/** `dt` seconds of the race with the buttons held, played in the same short steps whatever the frame took. */
function drive(race: Race, held: ReadonlySet<Action>, dt: number): Kart {
  const pad = padOf(held);
  const steps = Math.max(1, Math.ceil(dt / RULES.subStep));
  let player = race.player;
  for (let i = 0; i < steps; i++) player = driveKart(race.track.map, player, pad, dt / steps);
  return player;
}

/** Plays `dt` seconds (no more than `RULES.maxDt` of them) with the buttons held. Before GO, and paused, nothing moves. */
export function step(race: Race, held: ReadonlySet<Action>, dt: number): Stepped {
  const t = Math.min(Math.max(dt, 0), RULES.maxDt);
  if (race.phase === 'countdown') {
    const clock = race.clock + t;
    if (clock < RULES.countdown - EPSILON) return { race: { ...race, clock }, events: [] };
    return { race: { ...race, phase: 'race', clock: 0 }, events: [{ kind: 'go' }] };
  }
  if (race.phase === 'race') return { race: { ...race, clock: race.clock + t, player: drive(race, held, t) }, events: [] };
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
  if (race.phase === 'countdown') return { phase, beat: String(Math.max(1, RULES.countdown - Math.floor(race.clock))) as '3' | '2' | '1' };
  if (race.phase === 'race' && race.clock < RULES.goBanner) return { phase, beat: 'GO' };
  return { phase, beat: null };
}
