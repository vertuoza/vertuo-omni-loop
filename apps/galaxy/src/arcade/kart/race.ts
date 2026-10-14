// The race as a phase machine (PRD 1359), pure and seeded: no DOM, no canvas and no clock of its own.
// `newRace()` stands the player's kart on the last starting place, `step(race, held, dt)` plays `dt`
// seconds with the buttons held, and `press(race, action)` answers a press; each returns a new race
// and the events of that step. The same seed and the same inputs give the same race.
//
// ready (PRESS START) -> countdown (3 · 2 · 1) -> race (GO) <-> paused (START; leaving the scene, a
// blurred window and a hidden tab pause it too, and only START resumes) -> finish (the player crossed the
// line at the end of the last lap: the results table and the race time, given once; A races again, B leaves).
import { fleetSprite, MASCOTS } from '@omni/design';
import { crewLook, heroOf } from '../fleets';
import type { Action } from '../keys';
import type { KartCue, KartHud, KartResults, KartRow } from '../scenes/kart.ts';
import { podiumOf } from './podium';
import { carried, type GridPlayer, type ItemMessage, type StateMessage } from './net';
import type { KartLook } from './look';
import { fallIfOver, kartAt, NO_FX, padOf, stepFx, type Fx, type Kart, type Pad } from './kart';
import { slopeAt } from './relief';
import { newWorld, stepItems, spendItem, wantsToUse, type Item, type World } from './items';
import { RULES, type Difficulty } from './rules';
import { advance, aimOf, approachesRamp, comeBack, driveRival, lapOf, progressOf, pushApart, rivalTraits, START_PACE, type Driver, type Pace, type Rival } from './rivals';
import { carryAlong, LAPS, parseTrack, PLACES, type Track } from './track';

/** Frames add up to a countdown's end only to within what a float keeps. */
const EPSILON = 1e-9;

/** The countdown's numbers, one a second. */
const BEATS: readonly ('3' | '2' | '1')[] = ['3', '2', '1'];

/** No button held. */
const NONE: ReadonlySet<Action> = new Set();

export type Phase = 'ready' | 'countdown' | 'race' | 'paused' | 'finish' | 'left';

/** A SINGLE race against the CPU karts, or a MULTI race against the players of the workspace's grid (PRD 1572). */
export type Mode = 'single' | 'multi';

export interface Race {
  readonly seed: number;
  readonly mode: Mode;
  readonly track: Track;
  readonly phase: Phase;
  /** Where a pause resumes: the phase it interrupted. */
  readonly resume: 'countdown' | 'race';
  /** Seconds into the countdown, and then seconds of race. */
  readonly clock: number;
  readonly player: Kart;
  /** What the player holds and what is on the player's kart. */
  readonly fx: Fx;
  /** The item boxes, BLOBs and ORBs on the circuit. */
  readonly items: World;
  /** The player's laps and waypoints, and the rivals on the grid: the five CPU karts, or in a MULTI race the other players, who are never driven here. */
  readonly pace: Pace;
  readonly rivals: readonly Rival[];
  /** How hard the rivals drive (PRD 1762); `normal` in MULTI, which has none to drive. */
  readonly difficulty: Difficulty;
  /** How many laps the race runs (PRD 1762): 3, 5 or 7; always 3 in MULTI until the grid carries it. */
  readonly laps: number;
  /** The player's kart's colour and design (PRD 1762); none draws the fleet's colour and CLASSIC. */
  readonly look?: KartLook;
  /** The race clock at which the player crossed the line for the third time: the time the board gets; null before. */
  readonly threeAt: number | null;
  /** The race clock at which the player's last lap began: FINAL LAP shows from there; null before it. */
  readonly finalAt: number | null;
  /** MULTI: whether the race's menu is open over the race (the race goes on), and the players gone OUT or left, by id. */
  readonly menu: boolean;
  /** MULTI: the player's own place on the grid, 0 on pole. */
  readonly slot: number;
  readonly gone: readonly string[];
  /** MULTI: the player's own id, and how many BLOBs and ORBs they have sent: the next one's id is the two together. */
  readonly self: string;
  readonly thrown: number;
  /** MULTI: the players who crossed the line, by id, with their time in tenths (never the player at this screen), and every other player's name by id. */
  readonly finished: Readonly<Record<string, number>>;
  readonly names: Readonly<Record<string, string>>;
  /** The results, once the player crossed the line at the end of the last lap; null before. */
  readonly finish: KartResults | null;
  /** The podium shows before the results (PRD 1762): set at the finish, cleared by A. */
  readonly podium?: boolean;
  /** MULTI: every other player's driver by id, kept after they cross the line, to draw them on the podium. */
  readonly drivers?: Readonly<Record<string, Driver>>;
}

/**
 * What happened in a step: a beat of the countdown, GO, an item used, a box taken, a kart hit by a BLOB or an ORB
 * (`spun`: it started a spin-out), a kart falling into the void (`fell`), the final lap starting, the finish with the
 * player's time in tenths (given once), the player leaving from the pause, or asking for another race from the results. A `racer` is 0
 * for the player and 1 to 5 for the rivals, in their order.
 */
export type RaceEvent =
  | { kind: 'beat'; beat: '3' | '2' | '1' } | { kind: 'go' }
  | { kind: 'item'; racer: number; item: Item } | { kind: 'box'; racer: number }
  | { kind: 'hit'; racer: number; item: 'blob' | 'orb'; spun: boolean; id?: string }
  | { kind: 'fell'; racer: number } | { kind: 'finalLap' }
  | { kind: 'throw'; id: string; item: 'blob' | 'orb'; x: number; y: number; angle: number }
  | { kind: 'finish'; tenths: number } | { kind: 'quit' } | { kind: 'again' } | { kind: 'leave' };

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
export function newRace({ seed, track = parseTrack(), cast = [], field, difficulty = 'normal', laps = LAPS, look }: { seed: number; track?: Track; cast?: readonly Driver[]; field?: Field; difficulty?: Difficulty; laps?: number; look?: KartLook }): Race {
  if (field) return newMultiRace(seed, track, field, look);
  const start = track.places[track.places.length - 1];
  if (!start) throw new Error('a circuit with no starting place');
  const drivers = [...cast.slice(0, PLACES - 1)];
  drivers.push(...fillers(drivers, PLACES - 1 - drivers.length));
  const traits = rivalTraits(seed, drivers.length, difficulty);
  const rivals = drivers.map((driver, i): Rival => {
    const place = track.places[i] ?? start;
    const trait = traits[i] ?? { skill: 1, offset: 0 };
    return { driver, kart: kartAt(place.x, place.y, track.heading), pace: START_PACE, fx: NO_FX, ...trait };
  });
  return { seed, mode: 'single', track, phase: 'ready', resume: 'race', clock: 0, player: kartAt(start.x, start.y, track.heading), fx: NO_FX, items: newWorld(track, seed), pace: START_PACE, rivals, difficulty, laps, ...(look ? { look } : {}), threeAt: null, finalAt: null, menu: false, slot: 0, gone: [], self: '', thrown: 0, finished: {}, names: {}, finish: null };
}

/** The players of a MULTI race in their starting order, and which of them is the one at this screen. */
export interface Field { me: string; order: readonly GridPlayer[]; /** How many laps the grid runs (PRD 1762); 3 when not given. */ laps?: number }

/** A player of the grid as a driver: their hero in the seat, their fleet's colour on the kart, their name on the results. */
function driverOf(p: GridPlayer): Driver {
  const look = heroOf(p.hero, p.fleet);
  return { sprite: look.sprite, tint: look.tint, color: crewLook(p.fleet).color, ...(p.look ? { look: p.look } : {}), name: p.name.toUpperCase() };
}

/**
 * A MULTI race (PRD 1572): the players, and only them, stand on the first places of the circuit in
 * their starting order, pole first, facing the way the line runs. No CPU kart. Each other player is a
 * rival that is never driven here: its kart is read from the last state heard from it.
 */
function newMultiRace(seed: number, track: Track, { me, order, laps = LAPS }: Field, given?: KartLook): Race {
  const index = order.findIndex((p) => p.id === me);
  const place = (i: number) => {
    const p = track.places[i];
    if (!p) throw new Error('a circuit with no starting place');
    return p;
  };
  if (index < 0) throw new Error('a MULTI race the player is not in');
  const rivals = order.flatMap((p, i): Rival[] => {
    if (p.id === me) return [];
    const kart = kartAt(place(i).x, place(i).y, track.heading);
    return [{ id: p.id, slot: i, driver: driverOf(p), kart, pace: START_PACE, fx: NO_FX, skill: 1, offset: 0, heard: { kart, fx: NO_FX, at: 0 } }];
  });
  const mine = place(index);
  const look = order[index]?.look ?? given;
  return { seed, mode: 'multi', track, phase: 'ready', resume: 'race', clock: 0, player: kartAt(mine.x, mine.y, track.heading), fx: NO_FX, items: newWorld(track, seed), pace: START_PACE, rivals, difficulty: 'normal', laps, ...(look ? { look } : {}), threeAt: null, finalAt: null, menu: false, slot: index, gone: [], self: me, thrown: 0, finished: {}, names: Object.fromEntries(order.filter((p) => p.id !== me).map((p) => [p.id, driverOf(p).name ?? p.id])), drivers: Object.fromEntries(order.filter((p) => p.id !== me).map((p) => [p.id, driverOf(p)])), finish: null };
}

/** A state heard from player `id`: their kart, laps and spin-out or fall stand as they say, at the race clock it came at (before GO, at 0). Not a MULTI race on its way, a player not in it, or a player gone: nothing changes. */
export function hear(race: Race, id: string, s: StateMessage): Race {
  if (race.mode !== 'multi' || (race.phase !== 'countdown' && race.phase !== 'race' && race.phase !== 'finish')) return race;
  const at = race.phase === 'countdown' ? 0 : race.clock;
  const heard: Kart = { x: s.x, y: s.y, angle: s.angle, speed: s.speed, steer: s.steer, ...(s.height ? { height: s.height } : {}) };
  const fx: Fx = { ...NO_FX, spin: s.spin, fall: s.fall };
  return { ...race, rivals: race.rivals.map((r) => {
    if (r.id !== id) return r;
    const kart = carryAlong(race.track, r.kart, heard);
    return { ...r, kart, fx, pace: { laps: s.laps, passed: s.passed }, heard: { kart, fx, at } };
  }) };
}

/** The BLOB or ORB `id` on the circuit, if it is there. */
const thrownOf = (items: World, id: string) => items.blobs.find((b) => b.id === id) ?? items.orbs.find((o) => o.id === id);

/**
 * A BLOB or an ORB sent by another player (PRD 1572, slice 6) appears on this circuit under the id it was sent with, an ORB flying the way its
 * sender fired it. Not a MULTI race on its way, an item that is on the circuit already, or one of the player's own: nothing changes. Whether
 * it hits a remote kart is that player's word (their `hit`), never this screen's.
 */
export function plant(race: Race, from: string, m: ItemMessage): Race {
  if (race.mode !== 'multi' || (race.phase !== 'race' && race.phase !== 'finish') || from === race.self || thrownOf(race.items, m.id)) return race;
  const { items } = race;
  if (m.item === 'blob') return { ...race, items: { ...items, blobs: [...items.blobs, { x: m.x, y: m.y, id: m.id }].slice(-RULES.blobMax) } };
  return { ...race, items: { ...items, orbs: [...items.orbs, { x: m.x, y: m.y, angle: m.angle, bounces: 0, age: 0, id: m.id }] } };
}

/** The item `id` was hit, by the player it hit: it is gone from this circuit. */
export function lift(race: Race, id: string): Race {
  if (race.mode !== 'multi' || !thrownOf(race.items, id)) return race;
  return { ...race, items: { ...race.items, blobs: race.items.blobs.filter((b) => b.id !== id), orbs: race.items.orbs.filter((o) => o.id !== id) } };
}

/** Where the item `id` lies or flies, and what it is, for the sound of its end. */
export function whereIs(race: Race, id: string): { x: number; y: number; item: 'blob' | 'orb' } | null {
  const blob = race.items.blobs.find((b) => b.id === id);
  if (blob) return { x: blob.x, y: blob.y, item: 'blob' };
  const orb = race.items.orbs.find((o) => o.id === id);
  return orb ? { x: orb.x, y: orb.y, item: 'orb' } : null;
}

/** Player `id` is OUT: they left, or nothing came from them for `RULES.outAfter` seconds. Their kart is gone from the circuit. */
export function dropOut(race: Race, id: string): Race {
  return race.rivals.some((r) => r.id === id) ? { ...race, rivals: race.rivals.filter((r) => r.id !== id), gone: [...race.gone, id] } : race;
}

/**
 * Player `id` crossed the line, with `tenths` for their time (PRD 1572, slice 5): their kart leaves the circuit and they stand
 * on the results, ahead of a player still racing. Not a MULTI race on its way or finished, a player not in it, or one who
 * finished already: nothing changes. A player who was OUT and finishes after all is back among the finishers.
 */
export function finishOf(race: Race, id: string, tenths: number): Race {
  if (race.mode !== 'multi' || race.phase === 'ready' || race.phase === 'left' || race.phase === 'paused') return race;
  if (!(id in race.names) || id in race.finished) return race;
  return { ...race, rivals: race.rivals.filter((r) => r.id !== id), gone: race.gone.filter((g) => g !== id), finished: { ...race.finished, [id]: tenths } };
}

/** The race left from outside because the tab is hidden: a MULTI race on its way is left at once, a SINGLE one pauses. */
export function away(race: Race): Race {
  if (race.mode === 'single') return pause(race);
  return race.phase === 'countdown' || race.phase === 'race' ? { ...race, phase: 'left', menu: false } : race;
}

/** Every remote kart read from its last state, carried forward `RULES.carry` seconds at most (and its spin-out and fall run down meanwhile), at race clock `clock`. */
function carryRemotes(track: Track, rivals: readonly Rival[], clock: number): Rival[] {
  return rivals.map((r) => {
    if (!r.heard) return r;
    const age = Math.max(0, clock - r.heard.at);
    const { fx } = r.heard;
    return { ...r, kart: carryAlong(track, r.kart, carried(r.heard.kart, age)), fx: { ...fx, spin: Math.max(0, fx.spin - age), fall: Math.max(0, fx.fall - age) } };
  });
}

/** How a rival that holds an item sees the road: it is facing where it goes when it needs hardly any turn to aim at its waypoint. */
const STRAIGHT = 0.1;

/** A kart's own short step: it drives with the pad, its pace follows, and a fall that ends brings it back on the line (the jump is never passed to `advance()`). */
function roll(track: Track, own: { player: Kart; fx: Fx; pace: Pace }, pad: Pad, dt: number): { player: Kart; fx: Fx; pace: Pace } {
  const moved = stepFx(track, own.player, pad, dt, 1, own.fx, slopeAt(track, own.player.x, own.player.y, own.player.angle));
  const kart = carryAlong(track, own.player, moved.kart);
  const pace = advance(track, own.pace, own.player, kart);
  if (!moved.landed) return { player: kart, fx: moved.fx, pace };
  const back = comeBack(track, pace, kart, moved.fx);
  return { player: back.kart, fx: back.fx, pace };
}

/** `dt` seconds of the race with the buttons held, played in the same short steps whatever the frame took: the player, the rivals, the karts pushed apart, the items and the laps counted. */
function drive(race: Race, held: ReadonlySet<Action>, dt: number): Pick<Race, 'player' | 'fx' | 'items' | 'pace' | 'rivals'> & { events: RaceEvent[] } {
  const { track } = race;
  const pad = padOf(held);
  const steps = Math.max(1, Math.ceil(dt / RULES.subStep));
  let { player, fx, items, pace, rivals } = race;
  const events: RaceEvent[] = [];
  for (let i = 0; i < steps; i++) {
    const falling = [fx.fall > 0, ...rivals.map((r) => (r.fx ?? NO_FX).fall > 0)];
    ({ player, fx, pace } = roll(track, { player, fx, pace }, pad, dt / steps));
    const ahead = progressOf(track, pace, player);
    rivals = rivals.map((r) => driveRival(track, r, dt / steps, ahead, race.difficulty));
    const [p, ...others] = pushApart([player, ...rivals.map((r) => r.kart)], [fx.fall > 0, ...rivals.map((r) => (r.fx ?? NO_FX).fall > 0)]);
    if (p) player = p;
    rivals = rivals.map((r, j) => { const kart = others[j]; return kart ? { ...r, kart } : r; });
    // A kart pushed over the edge by another falls too.
    const dropped = fallIfOver(track, player, fx);
    player = dropped.kart;
    fx = dropped.fx;
    rivals = rivals.map((r) => { const d = fallIfOver(track, r.kart, r.fx ?? NO_FX); return d.kart === r.kart && d.fx === (r.fx ?? NO_FX) ? r : { ...r, kart: d.kart, fx: d.fx }; });
    // The items: the rivals use what they hold by their rules, then the boxes, BLOBs and ORBs act.
    let racers = [{ kart: player, fx }, ...rivals.map((r) => ({ kart: r.kart, fx: r.fx ?? NO_FX }))];
    rivals.forEach((r, j) => {
      const holder = racers[j + 1];
      const calm = holder?.fx.item !== 'boost' && racers.some((x) => approachesRamp(track, x.kart));
      if (!holder || calm || !wantsToUse(racers, j + 1, Math.abs(aimOf(track, r)) < STRAIGHT && holder.kart.speed > 0, race.difficulty, r.held ?? 0)) return;
      const used = spendItem(items, holder);
      if (holder.fx.item) events.push({ kind: 'item', racer: j + 1, item: holder.fx.item });
      items = used.world;
      racers = racers.map((x, k) => (k === j + 1 ? used.racer : x));
    });
    const paces = [pace, ...rivals.map((r) => r.pace)];
    const progress = racers.map((r, k) => progressOf(track, paces[k] ?? pace, r.kart));
    const places = progress.map((mine) => 1 + progress.filter((o) => o > mine).length);
    const acted = stepItems(track, items, racers, places, dt / steps);
    items = acted.world;
    events.push(...acted.events);
    const [mine, ...theirs] = acted.racers;
    if (mine) { player = mine.kart; fx = mine.fx; }
    rivals = rivals.map((r, j) => { const x = theirs[j]; return x ? { ...r, kart: x.kart, fx: x.fx, held: x.fx.item ? (r.held ?? 0) + dt / steps : 0 } : r; });
    [fx, ...rivals.map((r) => r.fx ?? NO_FX)].forEach((f, k) => { if (f.fall > 0 && !falling[k]) events.push({ kind: 'fell', racer: k }); });
  }
  return { player, fx, items, pace, rivals, events };
}

/**
 * `dt` seconds of a MULTI race (PRD 1572), played like `drive` for the player alone: the other players
 * are read from their last states at race clock `clock`, never driven, never pushed, never dropped and
 * never given a box. They are in the player's way: the whole push falls on the player, who gets out of
 * it. The menu is open over a race that goes on, and the kart rolls on with nothing pressed.
 */
function driveMulti(race: Race, held: ReadonlySet<Action>, dt: number, clock: number): Pick<Race, 'player' | 'fx' | 'items' | 'pace' | 'rivals'> & { events: RaceEvent[] } {
  const { track } = race;
  const pad = padOf(race.menu ? NONE : held);
  const steps = Math.max(1, Math.ceil(dt / RULES.subStep));
  const rivals = carryRemotes(track, race.rivals, clock);
  let { player, fx, items, pace } = race;
  const events: RaceEvent[] = [];
  for (let i = 0; i < steps; i++) {
    const fell = fx.fall > 0;
    ({ player, fx, pace } = roll(track, { player, fx, pace }, pad, dt / steps));
    const [pushed] = pushApart([player, ...rivals.map((r) => r.kart)], [fx.fall > 0, ...rivals.map((r) => (r.fx ?? NO_FX).fall > 0)]);
    if (pushed) player = { ...pushed, x: player.x + (pushed.x - player.x) * 2, y: player.y + (pushed.y - player.y) * 2 };
    const dropped = fallIfOver(track, player, fx);
    player = dropped.kart;
    fx = dropped.fx;
    // Only the player's own kart takes a box; the item it draws is by its place among the players.
    const mine = progressOf(track, pace, player);
    const place = 1 + rivals.filter((r) => progressOf(track, r.pace, r.kart) > mine).length;
    const acted = stepItems(track, items, [{ kart: player, fx }], [place], dt / steps);
    items = acted.world;
    events.push(...acted.events);
    const [self] = acted.racers;
    if (self) { player = self.kart; fx = self.fx; }
    if (fx.fall > 0 && !fell) events.push({ kind: 'fell', racer: 0 });
  }
  return { player, fx, items, pace, rivals, events };
}

/** The rivals after a step at race clock `clock`: a MULTI player nothing has come from for `RULES.outAfter` seconds is OUT (their kart is gone), and a rival that crossed the line is marked with its time. */
function settle(race: Race, rivals: readonly Rival[], clock: number): { rivals: Rival[]; gone: string[] } {
  const silent = rivals.filter((r) => r.id !== undefined && clock - (r.heard?.at ?? 0) > RULES.outAfter);
  const kept = rivals.filter((r) => !silent.includes(r)).map((r) => (r.pace.laps >= race.laps && r.doneAt == null ? { ...r, doneAt: clock } : r));
  return { rivals: kept, gone: [...race.gone, ...silent.flatMap((r) => (r.id === undefined ? [] : [r.id]))] };
}

/** The player's place, 1 to 6: one more than the karts as far along the racing line or further (side by side on the grid, the player is behind: it stands on the last place). */
export function placeOf(race: Race): number {
  const { track } = race;
  const mine = progressOf(track, race.pace, race.player);
  // A MULTI grid is three across: side by side, whoever stood ahead on it is ahead.
  const ahead = (r: Rival) => { const p = progressOf(track, r.pace, r.kart); return race.mode === 'multi' ? p > mine || (p === mine && (r.slot ?? 0) < race.slot) : p >= mine; };
  // A player who crossed the line is ahead of everyone still racing.
  return 1 + race.rivals.filter(ahead).length + Object.keys(race.finished).length;
}

/** The race clock's tenths of a second, as the clock shows them. */
const tenthsOf = (seconds: number) => Math.floor(seconds * 10 + EPSILON);

/**
 * The results when the player crosses the line at the end of the last lap, `clock` seconds in: the
 * rivals that already crossed first, by their time, then the ones still racing by how far along the
 * circuit they are, with no time. The player stands behind a rival that crossed at the same instant.
 */
/** A driver's tint and kart look for the podium: a rival's own, the player's look for the player. */
function artOf(driver: Driver | undefined, look: KartLook | undefined): Pick<KartRow, 'tint' | 'look'> {
  const own = driver?.look ?? look;
  return { ...(driver ? { tint: driver.tint } : {}), ...(own ? { look: own } : {}) };
}

function resultsOf(race: Race, clock: number): KartResults {
  const { track } = race;
  type Entry = { name: string; you: boolean; at: number | null; progress: number; driver?: Driver };
  const entries: Entry[] = race.rivals.map((r, i) => ({ name: r.driver.name ?? `RIVAL ${i + 1}`, you: false, at: r.doneAt ?? null, progress: progressOf(track, r.pace, r.kart), driver: r.driver }));
  entries.push({ name: 'YOU', you: true, at: clock, progress: progressOf(track, race.pace, race.player) });
  entries.sort((a, b) => (a.at !== null && b.at !== null ? a.at - b.at || Number(a.you) - Number(b.you) : a.at !== null ? -1 : b.at !== null ? 1 : b.progress - a.progress));
  const rows: KartRow[] = entries.map((e, i) => ({ place: i + 1, name: e.name, tenths: e.at === null ? null : tenthsOf(e.at), you: e.you, ...artOf(e.driver, e.you ? race.look : undefined) }));
  const place = rows.findIndex((r) => r.you) + 1;
  return { rows, place, tenths: tenthsOf(clock), threeLap: tenthsOf(race.threeAt ?? clock) };
}

/**
 * The results of a MULTI race (PRD 1572, slice 5), read afresh each time because they fill in live: the players who crossed the
 * line by their time (the player at this screen behind one who crossed at the same tenth), then the ones still racing by how far
 * along the circuit they are, with no time, and last the ones who are OUT.
 */
function multiResults(race: Race, mine: number): KartResults {
  const { track } = race;
  const crossed = [
    { name: 'YOU', you: true, tenths: mine, ...artOf(undefined, race.look) },
    ...Object.entries(race.finished).map(([id, tenths]) => ({ name: race.names[id] ?? id, you: false, tenths, ...artOf(race.drivers?.[id], undefined) })),
  ].sort((a, b) => a.tenths - b.tenths || Number(a.you) - Number(b.you) || a.name.localeCompare(b.name));
  const racing = [...race.rivals].sort((a, b) => progressOf(track, b.pace, b.kart) - progressOf(track, a.pace, a.kart));
  const out = race.gone.filter((id) => !(id in race.finished));
  const rows: KartRow[] = [
    ...crossed,
    ...racing.map((r) => ({ name: r.driver.name ?? 'RACER', tenths: null, you: false, ...artOf(r.driver, undefined) })),
    ...out.map((id) => ({ name: race.names[id] ?? id, tenths: null, you: false, out: true })),
  ].map((r, i) => ({ place: i + 1, ...r }));
  return { rows, place: rows.findIndex((r) => r.you) + 1, tenths: mine, threeLap: race.threeAt === null ? mine : tenthsOf(race.threeAt), live: true };
}

/** The clocks the laps mark: the player's third crossing (the time the board gets) and the start of the last lap (FINAL LAP), each kept once. */
const marksOf = (race: Race, laps: number, clock: number): Pick<Race, 'threeAt' | 'finalAt'> => ({
  threeAt: race.threeAt ?? (laps >= LAPS ? clock : null),
  finalAt: race.finalAt ?? (laps >= race.laps - 1 ? clock : null),
});

/** `t` seconds of the race itself: the karts move, the laps count, FINAL LAP shows, and the line at the end of the last lap makes the results. */
function stepRace(race: Race, held: ReadonlySet<Action>, t: number): Stepped {
  const clock = race.clock + t;
  const { events, ...moved } = race.mode === 'multi' ? driveMulti(race, held, t, clock) : drive(race, held, t);
  const { rivals, gone } = settle(race, moved.rivals, clock);
  const next: Race = { ...race, ...moved, rivals, gone, clock, ...marksOf(race, moved.pace.laps, clock) };
  if (race.finalAt === null && next.finalAt !== null && moved.pace.laps < race.laps) events.push({ kind: 'finalLap' });
  if (moved.pace.laps < race.laps) return { race: next, events };
  const finish = race.mode === 'multi' ? multiResults(next, tenthsOf(clock)) : resultsOf(next, clock);
  // The time sent is the clock at the third crossing: in a 3-lap race, the race time.
  return { race: { ...next, phase: 'finish', finish, podium: true }, events: [...events, { kind: 'finish', tenths: finish.threeLap }] };
}

/** Plays `dt` seconds (no more than `RULES.maxDt` of them) with the buttons held. Before GO, and paused, nothing moves. */
export function step(race: Race, held: ReadonlySet<Action>, dt: number): Stepped {
  const t = Math.min(Math.max(dt, 0), RULES.maxDt);
  if (race.phase === 'countdown') {
    const clock = race.clock + t;
    if (clock < RULES.countdown - EPSILON) {
      // Each second of the countdown names the next number: 3 is told by START, 2 and 1 here.
      const events = BEATS.flatMap((beat, i): RaceEvent[] => (i > 0 && race.clock < i - EPSILON && clock >= i - EPSILON ? [{ kind: 'beat', beat }] : []));
      return { race: { ...race, clock }, events };
    }
    // GO: the race clock starts at this player's own GO, so what is heard before it is heard at 0.
    const rivals = race.rivals.map((r) => (r.heard ? { ...r, heard: { ...r.heard, at: 0 } } : r));
    return { race: { ...race, phase: 'race', clock: 0, rivals }, events: [{ kind: 'go' }] };
  }
  if (race.phase === 'race') return stepRace(race, held, t);
  return { race: race.phase === 'finish' && race.mode === 'multi' ? waitOnResults(race, t) : race, events: [] };
}

/** On the results of a MULTI race the others race on: a player silent for too long is OUT, and the results fill in. */
function waitOnResults(race: Race, t: number): Race {
  const clock = race.clock + t;
  const { rivals, gone } = settle(race, race.rivals, clock);
  return { ...race, clock, rivals, gone };
}

/** START: the ready screen starts the countdown (and tells its first number), a pause resumes, the countdown and the race pause, the results do nothing. */
function pressStart(race: Race): Stepped {
  if (race.phase === 'finish' || race.phase === 'left') return { race, events: [] };
  if (race.mode === 'multi' && race.phase !== 'ready') {
    // There is no pause in a MULTI race: ENTER opens the menu over a race that goes on, and ENTER closes it.
    return race.phase === 'race' ? { race: { ...race, menu: !race.menu }, events: [] } : { race, events: [] };
  }
  if (race.phase === 'ready') return { race: { ...race, phase: 'countdown', clock: 0 }, events: [{ kind: 'beat', beat: '3' }] };
  if (race.phase === 'paused') return { race: { ...race, phase: race.resume }, events: [] };
  return { race: { ...race, phase: 'paused', resume: race.phase }, events: [] };
}

/** The list with its last item given `id`: the one the player just dropped or fired. */
const tagLast = <T extends { id?: string }>(list: readonly T[], id: string): T[] => list.map((x, i) => (i === list.length - 1 ? { ...x, id } : x));

/** MULTI: a BLOB dropped or an ORB fired takes an id of its own (this player's and a count) and is told to the others; a BOOST stays the player's own. */
function throwOf(race: Race, used: { world: World; racer: { fx: Fx } }, item: 'blob' | 'orb'): Stepped {
  const id = `${race.self}:${race.thrown + 1}`;
  const items: World = item === 'blob' ? { ...used.world, blobs: tagLast(used.world.blobs, id) } : { ...used.world, orbs: tagLast(used.world.orbs, id) };
  const at = (item === 'blob' ? items.blobs : items.orbs).at(-1) ?? race.player;
  // An ORB leaves the way the kart faces, so the angle the others fly it at is the kart's.
  const thrown: RaceEvent = { kind: 'throw', id, item, x: at.x, y: at.y, angle: race.player.angle };
  return { race: { ...race, items, fx: used.racer.fx, thrown: race.thrown + 1 }, events: [{ kind: 'item', racer: 0, item }, thrown] };
}

/** B in the race: the player uses what it holds, and the use is told (a spinning kart, or one holding nothing, uses nothing). */
function pressItem(race: Race): Stepped {
  const used = spendItem(race.items, { kart: race.player, fx: race.fx });
  const { item } = race.fx;
  const spent = item && race.fx.spin <= 0 && race.fx.fall <= 0 ? item : null;
  if (race.mode === 'multi' && (spent === 'blob' || spent === 'orb')) return throwOf(race, used, spent);
  return { race: { ...race, items: used.world, fx: used.racer.fx }, events: spent ? [{ kind: 'item', racer: 0, item: spent }] : [] };
}

/** A press: B uses the item held, START starts the countdown, pauses it or the race, and resumes a pause; SELECT on the pause leaves. */
export function press(race: Race, action: Action): Stepped {
  if (action === 'start') return pressStart(race);
  if (action === 'b' && race.phase === 'race' && !race.menu) return pressItem(race);
  if (action === 'select' && race.phase === 'paused') return { race, events: [{ kind: 'quit' }] };
  // MULTI: LEAVE RACE (TAB) on the menu leaves the race for the grid.
  if (action === 'select' && race.mode === 'multi' && race.phase === 'race' && race.menu) return { race: { ...race, phase: 'left', menu: false }, events: [{ kind: 'leave' }] };
  // The podium (PRD 1762): A moves on to the results; A there races again.
  if (action === 'a' && race.phase === 'finish' && race.podium) { return { race: { ...race, podium: false }, events: [] }; }
  if (action === 'a' && (race.phase === 'finish' || race.phase === 'left')) return { race, events: [{ kind: 'again' }] };
  return { race, events: [] };
}

/** The race paused from outside (a blurred window, a hidden tab, leaving the scene): the countdown and the race pause, the rest stays. */
export function pause(race: Race): Race {
  // In a MULTI race a window that loses focus opens the menu over a race that goes on.
  if (race.mode === 'multi') return race.phase === 'race' ? { ...race, menu: true } : race;
  return race.phase === 'countdown' || race.phase === 'race' ? { ...race, phase: 'paused', resume: race.phase } : race;
}

/** What the text layer shows of the race: its phase, and the countdown's number or the GO that follows it. */
export function hudOf(race: Race): KartHud {
  const { phase } = race;
  if (race.phase === 'finish' && race.finish) {
    const results = race.mode === 'multi' ? multiResults(race, race.finish.tenths) : race.finish;
    return { phase, beat: null, results, ...(race.podium ? { podium: podiumOf(results) } : {}) };
  }
  if (race.phase === 'left') return { phase, beat: null };
  if (race.phase === 'countdown') return { phase, beat: BEATS[Math.min(BEATS.length - 1, Math.floor(race.clock))] ?? '1' };
  const beat = race.phase === 'race' && race.clock < RULES.goBanner ? 'GO' : null;
  if (race.phase !== 'race' && race.phase !== 'paused') return { phase, beat };
  const final = race.finalAt !== null && race.clock - race.finalAt < RULES.finalBanner;
  return { phase, beat, ...(race.mode === 'multi' ? { menu: race.menu } : {}), run: { place: placeOf(race), lap: lapOf(race.pace, race.laps), laps: race.laps, tenths: Math.floor(race.clock * 10 + EPSILON), final, item: race.fx.item } };
}

/** One kind of race event, as the cues the arcade hears; `tiles` is how far the racer it names stands from the player. */
type CueOf<K extends RaceEvent['kind']> = (e: Extract<RaceEvent, { kind: K }>, tiles: number) => KartCue[];
const CUES: { [K in RaceEvent['kind']]: CueOf<K> } = {
  beat: (e) => [{ kind: 'beep', beat: e.beat }],
  go: () => [{ kind: 'go' }],
  item: (e, tiles) => [{ kind: 'item', item: e.item, you: e.racer === 0, tiles }],
  box: (e) => (e.racer === 0 ? [{ kind: 'box' }] : []),
  hit: (e, tiles) => [{ kind: 'hit', item: e.item, you: e.racer === 0, tiles }, ...(e.racer === 0 && e.spun ? [{ kind: 'spin' } as const] : [])],
  fell: (e) => (e.racer === 0 ? [{ kind: 'fall' }] : []),
  finalLap: () => [{ kind: 'finalLap' }],
  finish: () => [],
  quit: () => [],
  again: () => [],
  leave: () => [],
  throw: () => [],
};

/** The cues an event makes, in order: a hit on the player is also a spin-out, a rival's box or fall is no one's business. */
export function cuesOf(event: RaceEvent, tiles: number): KartCue[] {
  return cuesBy(event.kind, event, tiles);
}

/** The table's row for one kind, typed by that kind, so the event and its maker agree without a cast. */
function cuesBy<K extends RaceEvent['kind']>(kind: K, event: Extract<RaceEvent, { kind: K }>, tiles: number): KartCue[] {
  return CUES[kind](event, tiles);
}
