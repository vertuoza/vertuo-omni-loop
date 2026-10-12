import { describe, expect, it } from 'vitest';
import type { Block } from './collide';
import { RULES } from './rules';
import {
  blocksAt, CHAPTERS, ENDLESS_GROUPS, ENDLESS_SEED, endlessSpeed, endlessWave, endlessWaves, fallen, ghostShare, parseChapter, parseWave, passedAt, patternsOf,
  placedAt, POSE, RAMP, reachOf, ring, route, secondsOf, SHAPE, sightOf, spaceBetween, spacingProblems, speedAt, struck, throughHolding, timeAt,
  turnSeconds, waveProblems, wayOf, windowOf, type Pattern, type Piece, type Wave,
} from './waves';

// OMNI DUET's waves (PRD 1633, slice 3; issues 1672, 1689 and 1692): the vocabulary of obstacles set on
// the circle, each still one dodged by one clear pose and each moving one by a turn, the four chapters
// written in it, their spirals, zigzags, rod chains, ghosts and end-of-wave speed-ups, the spacing a
// turn asks for, and the check that proves every wave passable by a person (issue 1663).

const R = RULES.radius;
const at = (wave: Wave, seconds: number) => blocksAt(wave, Math.round(seconds / RULES.subStep));
const UPRIGHT = Math.PI / 2, LEVEL = 0;

/** The first two blocks of a wave, which the test wrote. */
function two(blocks: readonly Block[]): [Block, Block] {
  const [a, b] = blocks;
  if (!a || !b) throw new Error('not two blocks');
  return [a, b];
}

/** Every still obstacle the legend can write, and every moving one: a centre block sliding or a rod, either way round. */
const STILL = ['L half', 'R half', 'centre', 'gate', 'upright', 'short'];
const MOVING = ['centre slide', 'centre slide back', 'centre turn', 'centre turn back'];

/** A person who reacts slower than the check's, with orbs 2 pixels wider: the room every wave keeps to spare. */
const SPARE = { reactionSeconds: 0.4, orbRadius: RULES.orbRadius + 2 };

/** One wave, as a chapter of its own for the checks. */
const alone = (wave: Wave) => [{ numeral: 'X', name: 'ALONE', waves: [wave] }];

/** Whether orbs held at `angle`, `r` wide, are struck by a wave of `words` alone, at any sub-step until it is passed. */
function strikes(words: string, angle: number, { speed = 60, distance = '0', r = RULES.orbRadius }: { speed?: number; distance?: string; r?: number } = {}): boolean {
  const wave = parseWave(`speed ${speed}\n${words} · ${distance}`, 'test');
  for (let tick = 1; !passedAt(wave, tick); tick++) if (struck(angle, blocksAt(wave, tick), r)) return true;
  return false;
}

describe('the vocabulary', () => {
  const posed = (words: string) => POSE[parseWave(`speed 60\n${words} · 0`, 'test').pieces[0]?.kind ?? 'centre'];

  it('asks the pair upright for half bars and gates, and level for the centre block, the upright block and the short bar', () => {
    expect(posed('L half').pose).toBe('upright');
    expect(posed('R half').pose).toBe('upright');
    expect(posed('gate').pose).toBe('upright');
    expect(posed('centre').pose).toBe('level');
    expect(posed('upright').pose).toBe('level');
    expect(posed('short').pose).toBe('level');
  });

  it('never moves a half bar: moving, it only ever moved away from the upright orbs', () => {
    expect(() => parseWave('speed 100\nL half slide · 0', 'test')).toThrow('test, line 2: a half bar does not move');
    expect(() => parseWave('speed 100\nR half turn back · 0', 'test')).toThrow('test, line 2: a half bar does not move');
  });

  it('holds Duet\'s shapes: the half bar, the centre block, the gate, the upright block and the short bar, only the centre block moving', () => {
    expect(Object.keys(POSE)).toEqual(['half', 'centre', 'gate', 'upright', 'short']);
    expect(() => parseWave('speed 100\nL upright · 0', 'test')).toThrow('test, line 2: an upright block has no side');
    expect(() => parseWave('speed 100\nR gate · 0', 'test')).toThrow('test, line 2: a gate has no side');
    expect(() => parseWave('speed 100\ngate slide · 0', 'test')).toThrow('test, line 2: a gate does not move');
    expect(() => parseWave('speed 100\nshort turn · 0', 'test')).toThrow('test, line 2: a short bar does not move');
    expect(() => parseWave('speed 100\nupright turn back · 0', 'test')).toThrow('test, line 2: an upright block does not move');
  });

  it.each(STILL)('%s: its one pose clears it, with room for orbs 2 pixels wider; the other pose hits it', (words) => {
    const { angle } = posed(words);
    const other = angle === UPRIGHT ? LEVEL : UPRIGHT;
    for (const speed of [95, 125, 155]) {
      for (const distance of ['0', '0.4R', '1.3R']) {
        expect(strikes(words, angle, { speed, distance, r: RULES.orbRadius + 2 }), `${speed} px/s, ${distance}: its pose`).toBe(false);
        expect(strikes(words, angle + Math.PI, { speed, distance }), `${speed} px/s, ${distance}: its pose half a turn on`).toBe(false);
        expect(strikes(words, other, { speed, distance }), `${speed} px/s, ${distance}: the other pose`).toBe(true);
      }
    }
  });

  it.each(MOVING)('%s: every pose held still hits it, at every angle of the ring; a person turning the way it moves clears it, and only so', (words) => {
    const { bins } = ring();
    const way = wayOf(parseWave(`speed 60\n${words} · 0`, 'test').pieces[0] ?? { motion: 'still', back: false });
    expect(way).not.toBe(0);
    for (const speed of [95, 125, 155]) {
      for (const distance of ['0', '1.3R']) {
        for (let b = 0; b < bins; b++) expect(strikes(words, (b / bins) * Math.PI * 2, { speed, distance }), `${speed} px/s, ${distance}: held at bin ${b}`).toBe(true);
        const wave = parseWave(`speed ${speed}\n${words} · ${distance}`, 'test');
        expect(waveProblems(alone(wave), SPARE), `${speed} px/s, ${distance}: a person, with room to spare`).toEqual([]);
        const seen = windowOf(wave, 0);
        if (!seen) throw new Error('never in reach');
        expect(throughHolding(wave, seen.first, seen.last, [0, way === 1 ? -1 : 1]), `${speed} px/s, ${distance}: never turning its way`).toBe(false);
      }
    }
  });

  it('sets the half bar 2 R long from either side, its inner end R/3 short of the centre line', () => {
    const [left, right] = two(at(parseWave('speed 60\nL half · 0\nR half · 1R', 'test'), 0));
    expect(left.w).toBeCloseTo(2 * R, 9);
    expect(left.h).toBeCloseTo(0.3 * R, 9);
    expect(left.cx + left.w / 2).toBeCloseTo(RULES.centre.x - R / 3, 9);
    expect(right.cx - right.w / 2).toBeCloseTo(RULES.centre.x + R / 3, 9);
  });

  it('sets the centre block on the centre line, a square 0.75 R wide', () => {
    const [centre] = at(parseWave('speed 60\ncentre · 0', 'test'), 0);
    expect(centre).toMatchObject({ cx: RULES.centre.x, angle: 0 });
    expect(centre?.w).toBeCloseTo(0.75 * R, 9);
    expect(centre?.h).toBeCloseTo(0.75 * R, 9);
  });

  it('sets a gate\'s two bars at one height, 1.2 R long either side of a gap 0.8 R wide on the centre line, as one obstacle', () => {
    const wave = parseWave('speed 60\ngate · 0', 'test');
    const [left, right] = two(at(wave, 0));
    expect(placedAt(wave, 0).map((p) => p.piece)).toEqual([wave.pieces[0], wave.pieces[0]]);
    expect(left.cy).toBe(right.cy);
    for (const bar of [left, right]) {
      expect(bar.w).toBeCloseTo(1.2 * R, 9);
      expect(bar.h).toBeCloseTo(0.3 * R, 9);
    }
    expect(left.cx + left.w / 2).toBeCloseTo(RULES.centre.x - 0.4 * R, 9);
    expect(right.cx - right.w / 2).toBeCloseTo(RULES.centre.x + 0.4 * R, 9);
    // Its outer ends reach past the level orbs.
    expect(right.cx + right.w / 2).toBeGreaterThan(RULES.centre.x + R + RULES.orbRadius);
  });

  it('sets the upright block, 0.8 R wide and 1.3 R tall, and the short bar, 1 R long and 0.33 R thick, on the centre line', () => {
    const [upright, short] = two(at(parseWave('speed 60\nupright · 0\nshort · 1R', 'test'), 0));
    expect(upright).toMatchObject({ cx: RULES.centre.x, angle: 0 });
    expect(upright.w).toBeCloseTo(0.8 * R, 9);
    expect(upright.h).toBeCloseTo(1.3 * R, 9);
    expect(short).toMatchObject({ cx: RULES.centre.x, angle: 0 });
    expect(short.w).toBeCloseTo(R, 9);
    expect(short.h).toBeCloseTo(0.33 * R, 9);
  });

  it('makes a turning centre block a rod as Duet has, 2.2 R long and 0.33 R thick, turning about its middle on the centre line', () => {
    const [rod] = at(parseWave('speed 60\ncentre turn · 0', 'test'), 0);
    expect(rod?.cx).toBe(RULES.centre.x);
    expect(rod?.w).toBeCloseTo(2.2 * R, 9);
    expect(rod?.h).toBeCloseTo(0.33 * R, 9);
    expect(SHAPE.spinTurnsPerSecond).toBe(RULES.turnsPerSecond);
  });
});

describe('the chapters', () => {
  const motions = (i: number) => new Set(CHAPTERS[i]?.waves.flatMap((w) => w.pieces.map((p) => p.motion)));
  const pieces = (i: number) => CHAPTERS[i]?.waves.flatMap((w) => w.pieces) ?? [];

  it('are I · DRIFT, II · SLIDE, III · SPIN and IV · STORM, of ten waves each', () => {
    expect(CHAPTERS.map((c) => `${c.numeral} · ${c.name}`)).toEqual(['I · DRIFT', 'II · SLIDE', 'III · SPIN', 'IV · STORM']);
    for (const c of CHAPTERS) expect(c.waves.length, c.name).toBe(10);
  });

  it('brings in still obstacles first, then sliding ones, then turning ones, then all three, each chapter a little faster', () => {
    expect([...motions(0)]).toEqual(['still']);
    expect(motions(1).has('slide')).toBe(true);
    expect(motions(1).has('turn')).toBe(false);
    expect(motions(2).has('turn')).toBe(true);
    expect(motions(3)).toEqual(new Set(['still', 'slide', 'turn']));
    const slowest = (i: number) => Math.min(...(CHAPTERS[i]?.waves.map((w) => w.speed) ?? []));
    const fastest = (i: number) => Math.max(...(CHAPTERS[i]?.waves.map((w) => w.speed) ?? []));
    for (const i of [1, 2, 3]) {
      expect(slowest(i), CHAPTERS[i]?.name).toBeGreaterThan(slowest(i - 1));
      expect(fastest(i), CHAPTERS[i]?.name).toBeGreaterThan(fastest(i - 1));
    }
  });

  it('uses every kind of obstacle, the half bar on both sides', () => {
    const used = new Set(CHAPTERS.flatMap((_, i) => pieces(i).map((p) => `${p.side} ${p.kind}`)));
    expect(used).toEqual(new Set(['-1 half', '1 half', '0 centre', '0 gate', '0 upright', '0 short']));
  });

  it('brings in one new shape a chapter: gates in I, short bars in II, upright blocks in III, rod chains in IV', () => {
    const first = (kind: Piece['kind']) => CHAPTERS.findIndex((c) => c.waves.some((w) => w.pieces.some((p) => p.kind === kind)));
    expect([first('gate'), first('short'), first('upright')]).toEqual([0, 1, 2]);
    const chained = CHAPTERS.map((c) => c.waves.some((w) => w.pieces.some((p, k) => {
      const before = w.pieces[k - 1];
      return !!before && p.motion === 'turn' && before.motion === 'turn' && spaceBetween(before, p) < 1.75 * R;
    })));
    expect(chained).toEqual([false, false, false, true]);
  });

  it('raises the speed wave after wave within each chapter', () => {
    for (const c of CHAPTERS) {
      c.waves.forEach((w, i) => { if (i > 0) expect(w.speed, `${c.name} wave ${i + 1}`).toBeGreaterThan(c.waves[i - 1]?.speed ?? 0); });
    }
  });
});

describe('the wave text', () => {
  it('reads the speed, then one obstacle a line, each its distance behind the one before', () => {
    const wave = parseWave('speed 70\nL half · 0\ncentre slide ghost · 2R\ncentre turn back · 1.5R', 'test');
    expect(wave.speed).toBe(70);
    expect(wave.pieces.map(({ kind, side, motion, back, ghost }) => ({ kind, side, motion, back, ghost }))).toEqual([
      { kind: 'half', side: -1, motion: 'still', back: false, ghost: false },
      { kind: 'centre', side: 0, motion: 'slide', back: false, ghost: true },
      { kind: 'centre', side: 0, motion: 'turn', back: true, ghost: false },
    ]);
    const [a, b, c] = wave.pieces as [Piece, Piece, Piece];
    expect(a.above).toBeCloseTo(reachOf(a), 9);
    expect(spaceBetween(a, b)).toBeCloseTo(2 * R, 9);
    expect(spaceBetween(b, c)).toBeCloseTo(1.5 * R, 9);
  });

  it('counts a rod at the disc it sweeps', () => {
    expect(reachOf({ kind: 'centre', motion: 'turn' })).toBeCloseTo(Math.hypot(2.2 * R, 0.33 * R) / 2, 9);
    expect(reachOf({ kind: 'centre', motion: 'slide' })).toBeCloseTo(0.375 * R, 9);
  });

  it('refuses a ghost word anywhere but last', () => {
    expect(() => parseWave('speed 60\ncentre ghost slide · 0', 'test')).toThrow('test, line 2: "ghost" is not in the legend');
  });

  it('refuses an unknown word with its chapter, wave and line', () => {
    expect(() => parseChapter('II', 'SLIDE', ['speed 60\ncentre · 0', 'speed 60\ncentre · 0\nL half wobble · 2R']))
      .toThrow('chapter II · SLIDE, wave 2, line 3: "wobble" is not in the legend');
    expect(() => parseChapter('II', 'SLIDE', ['speed 60\nL wall · 0'])).toThrow('chapter II · SLIDE, wave 1, line 2: "wall" is not in the legend');
  });

  it('refuses a side the obstacle cannot have, a distance not in R, and a wave with no speed or no obstacle', () => {
    expect(() => parseChapter('I', 'DRIFT', ['speed 60\nL centre · 0'])).toThrow('chapter I · DRIFT, wave 1, line 2: a centre block has no side');
    expect(() => parseChapter('I', 'DRIFT', ['speed 60\nhalf · 0'])).toThrow('chapter I · DRIFT, wave 1, line 2: a half bar needs its side, L or R');
    expect(() => parseChapter('I', 'DRIFT', ['speed 60\ncentre · 40'])).toThrow('chapter I · DRIFT, wave 1, line 2: "40" is not a distance');
    expect(() => parseChapter('I', 'DRIFT', ['centre · 0'])).toThrow('chapter I · DRIFT, wave 1: the first line is not');
    expect(() => parseChapter('I', 'DRIFT', ['speed 60'])).toThrow('chapter I · DRIFT, wave 1: no obstacles');
  });
});

describe('the obstacles', () => {
  const wave = parseWave('speed 60\ncentre · 0', 'test');
  const side = SHAPE.centre.side * R;

  it('enter from above the playfield and fall straight down at the wave\'s speed', () => {
    const [start] = at(wave, 0);
    expect(start).toEqual({ cx: 160, cy: -side / 2, w: side, h: side, angle: 0 });
    const [later] = at(wave, 1);
    expect(later?.cx).toBe(160);
    expect(later?.cy).toBeCloseTo(60 - side / 2, 9);
  });

  it('wait above the playfield for the first one\'s distance before they enter', () => {
    expect(at(parseWave('speed 60\ncentre · 1R', 'test'), 0)[0]?.cy).toBeCloseTo(-R - side / 2, 9);
  });

  it('slide a centre block across the whole circle on a fixed path: at its far side as it crosses the centre\'s height, on the centre line at the upright orbs\' heights', () => {
    for (const [words, far] of [['centre slide', -1], ['centre slide back', 1]] as const) {
      for (const speed of [60, 150]) {
        const wave = parseWave(`speed ${speed}\n${words} · 0`, 'test');
        const xAt = (cy: number) => {
          let tick = 0;
          while ((blocksAt(wave, tick)[0]?.cy ?? Infinity) < cy) tick++;
          const [b] = blocksAt(wave, tick);
          return { x: (b?.cx ?? 0) - RULES.centre.x, y: (b?.cy ?? 0) - cy };
        };
        for (let tick = 0; !passedAt(wave, tick); tick++) expect(Math.abs((blocksAt(wave, tick)[0]?.cx ?? 0) - RULES.centre.x)).toBeLessThanOrEqual(SHAPE.slide.reach * R + 1e-9);
        // A sub-step's fall from the height asked: the block within that much of it across.
        const slack = (step: number) => step * 2 * SHAPE.slide.reach / SHAPE.slide.across + 1e-9;
        const middle = xAt(RULES.centre.y), top = xAt(RULES.centre.y - R), bottom = xAt(RULES.centre.y + R);
        expect(Math.abs(middle.x - far * R), `${words} at ${speed} px/s`).toBeLessThanOrEqual(slack(middle.y));
        expect(Math.abs(top.x), `${words} at ${speed} px/s`).toBeLessThanOrEqual(slack(top.y));
        expect(Math.abs(bottom.x), `${words} at ${speed} px/s`).toBeLessThanOrEqual(slack(bottom.y));
      }
    }
  });

  it('turn a rod about its middle at a constant rate, the way it was written, lying level as it crosses the centre\'s height', () => {
    const quarter = 0.25 / SHAPE.spinTurnsPerSecond;
    for (const [words, way] of [['centre turn', 1], ['centre turn back', -1]] as const) {
      const spin = parseWave(`speed 60\n${words} · 0`, 'test');
      const crossing = timeAt(spin, RULES.centre.y + (spin.pieces[0]?.above ?? 0));
      expect(at(spin, crossing)[0]?.angle, words).toBeCloseTo(0, 1);
      const [later] = at(spin, crossing + quarter);
      expect(later?.angle, words).toBeCloseTo((way * Math.PI) / 2, 1);
      expect(later?.cx, words).toBe(at(spin, 0)[0]?.cx);
    }
  });

  it('count a wave passed once its last obstacle is entirely below the circle', () => {
    const bottom = RULES.centre.y + RULES.radius + RULES.orbRadius;
    // The block's top edge is at -side plus the fall: it clears the circle's bottom once that passes `bottom`.
    const clear = timeAt(wave, bottom + side);
    expect(passedAt(wave, Math.floor(clear / RULES.subStep) - 1)).toBe(false);
    expect(passedAt(wave, Math.ceil(clear / RULES.subStep) + 1)).toBe(true);
  });

  it('strike the pair when a block overlaps either orb', () => {
    const [warmRight] = [{ cx: RULES.centre.x + RULES.radius, cy: RULES.centre.y, w: 16, h: 12, angle: 0 }];
    expect(struck(0, [warmRight])).toBe(true); // the warm orb, on the right at angle 0
    expect(struck(Math.PI, [warmRight])).toBe(true); // the cool orb, now on the right
    expect(struck(Math.PI / 2, [warmRight])).toBe(false);
    expect(struck(0, [])).toBe(false);
  });
});

describe('the spacing a turn asks for', () => {
  it('asks nothing between two obstacles of one pose, and a quarter turn plus a person\'s reaction between the two poses', () => {
    const [half, centre, slide, rod] = [
      { kind: 'half', motion: 'still', back: false }, { kind: 'centre', motion: 'still', back: false },
      { kind: 'centre', motion: 'slide', back: false }, { kind: 'centre', motion: 'turn', back: false },
    ] as const;
    expect(turnSeconds(half, half)).toBe(0);
    expect(turnSeconds(centre, centre)).toBe(0);
    const quarter = 0.25 / RULES.turnsPerSecond + RULES.reactionSeconds;
    expect(turnSeconds(half, centre)).toBeCloseTo(quarter, 9);
    expect(turnSeconds(centre, half)).toBeCloseTo(quarter, 9);
    // A moving obstacle asks a turn: the same room before it, after it, and between two.
    expect(turnSeconds(centre, slide)).toBeCloseTo(quarter, 9);
    expect(turnSeconds(rod, centre)).toBeCloseTo(quarter, 9);
    expect(turnSeconds(slide, slide)).toBeCloseTo(quarter, 9);
    // A rod right behind a rod turning the same way is a chain: the turn held carries on. The other way round asks a change.
    expect(turnSeconds(rod, rod)).toBe(0);
    expect(turnSeconds(rod, { ...rod, back: true })).toBeCloseTo(quarter, 9);
    expect(turnSeconds({ kind: 'gate', motion: 'still', back: false }, half)).toBe(0);
    expect(turnSeconds({ kind: 'upright', motion: 'still', back: false }, { kind: 'short', motion: 'still', back: false })).toBe(0);
    expect(turnSeconds({ kind: 'gate', motion: 'still', back: false }, { kind: 'short', motion: 'still', back: false })).toBeCloseTo(quarter, 9);
  });

  it('stands every chapter obstacle that asks another pose far enough behind the one before, at its wave\'s speed', () => {
    expect(spacingProblems(CHAPTERS)).toEqual([]);
  });

  it('names an obstacle too close behind one of the other pose, and lets one of the same pose follow closely', () => {
    const close = parseChapter('V', 'CLOSE', ['speed 100\nL half · 0\nR half · 0.25R\ncentre · 1R']);
    expect(spacingProblems([close])).toEqual(['chapter V · CLOSE, wave 1, line 4: 56.0 px behind, not 69.8']);
  });

  it('keeps the endless waves to it too, for the first 200', () => {
    expect(spacingProblems([{ numeral: 'ENDLESS', name: '×2', waves: endlessWaves(200) }])).toEqual([]);
  });
});

describe('every wave is passable by a person', () => {
  it('turns on a ring of 100 bins, 1 a step: the run\'s own angles, exactly', () => {
    expect(ring()).toEqual({ bins: 100, move: 1 });
  });

  it('passes every chapter wave, from any angle, holding anything, each change of turn 0.25 s after the last', () => {
    expect(RULES.reactionSeconds).toBe(0.25);
    expect(waveProblems(CHAPTERS)).toEqual([]);
  });

  it('keeps room to spare: every chapter wave passes for a person reacting in 0.4 s with orbs 2 pixels wider', () => {
    expect(waveProblems(CHAPTERS, SPARE)).toEqual([]);
  });

  it('names a deliberately impassable wave: a half bar, a centre block and the other half bar touching, a wall across the circle', () => {
    const walled = parseChapter('V', 'WALL', ['speed 60\ncentre · 0', 'speed 60\nL half · 0\ncentre · 0\nR half · 0', 'speed 60\nL half · 0\nR half · 0']);
    expect(waveProblems([walled])).toEqual(['chapter V · WALL, wave 2: no human way through']);
  });

  it('names a wave whose obstacles ask for a quicker turn than the orbs can make', () => {
    // A half bar asks the orbs upright, a centre block a quarter of R behind asks them level, then the
    // other half bar upright again: too quick a pair of turns at this speed, even for perfect, instant inputs.
    const tight = parseChapter('V', 'TIGHT', ['speed 300\nL half · 0\ncentre · 0.25R\nR half · 0.25R']);
    expect(waveProblems([tight], { reactionSeconds: 0 })).toEqual(['chapter V · TIGHT, wave 1: no human way through']);
  });

  it('names a wave only perfect, instant inputs get through: two quarter turns back to back, too close for a person', () => {
    const quick = parseChapter('II', 'SLIDE', ['speed 60\ncentre · 0', 'speed 300\nL half · 0\ncentre · 1R\nR half · 1R']);
    expect(waveProblems([quick], { reactionSeconds: 0 })).toEqual([]);
    expect(waveProblems([quick])).toEqual(['chapter II · SLIDE, wave 2: no human way through']);
  });

  it('finds a way through each chapter wave that changes turn no sooner than the reaction delay', () => {
    const react = Math.round(RULES.reactionSeconds / RULES.subStep);
    for (const c of CHAPTERS) {
      c.waves.forEach((w, i) => {
        const turns = route(w, 0) ?? [];
        expect(turns.length, `${c.name} wave ${i + 1}`).toBeGreaterThan(0);
        let since = react;
        turns.forEach((t, k) => {
          if (k > 0 && t !== turns[k - 1]) { expect(since, `${c.name} wave ${i + 1}, sub-step ${k + 1}`).toBeGreaterThanOrEqual(react); since = 0; }
          since++;
        });
      });
    }
  });
});

describe('what the waves ask of a person', () => {
  /** Whether orbs held still at some angle get through `wave` untouched. */
  const stillPasses = (wave: Wave) => {
    const { bins } = ring();
    let alive = Array.from({ length: bins }, (_, b) => (b / bins) * Math.PI * 2);
    for (let tick = 1; alive.length && !passedAt(wave, tick); tick++) alive = alive.filter((a) => !struck(a, blocksAt(wave, tick)));
    return alive.length > 0;
  };

  /** A wave's seconds, from its first obstacle entering the playfield to its last passing the orbs. */
  const seconds = secondsOf;

  /** How many times a wave's obstacles ask the pair to change pose. */
  const changes = (wave: Wave) => wave.pieces.filter((p, k) => k > 0 && POSE[p.kind].pose !== POSE[wave.pieces[k - 1]?.kind ?? p.kind].pose).length;

  it('asks to turn the pair in every wave, a chapter\'s first too: no angle held still gets through', () => {
    const still = CHAPTERS.flatMap((c) => c.waves.flatMap((w, i) => (stillPasses(w) ? [`${c.name} wave ${i + 1}`] : [])));
    expect(still).toEqual([]);
  });

  it('falls about 2 R a second, as Duet does: chapter I at 95 to 115 px/s, each chapter after a little faster', () => {
    const bands: readonly (readonly [number, number])[] = [[95, 115], [105, 125], [115, 135], [125, 145]];
    CHAPTERS.forEach((c, i) => {
      const [low = 0, high = 0] = bands[i] ?? [];
      for (const w of c.waves) {
        expect(w.speed, c.name).toBeGreaterThanOrEqual(low);
        expect(w.speed, c.name).toBeLessThanOrEqual(high);
      }
    });
  });

  it('keeps every wave short: 8 seconds at most from its first obstacle entering to its last passing the orbs', () => {
    const long = CHAPTERS.flatMap((c) => c.waves.flatMap((w, i) => (seconds(w) > 8 ? [`${c.name} wave ${i + 1}: ${seconds(w).toFixed(2)} s`] : [])));
    expect(long).toEqual([]);
  });

  it('plays chapter I\'s ten waves in 75 seconds at most', () => {
    const total = (CHAPTERS[0]?.waves ?? []).reduce((sum, w) => sum + seconds(w), 0);
    expect(total).toBeLessThanOrEqual(75);
  });

  it('sets three to five obstacles in a chapter I wave, three to six after', () => {
    CHAPTERS.forEach((c, i) => {
      for (const w of c.waves) {
        expect(w.pieces.length, c.name).toBeGreaterThanOrEqual(3);
        expect(w.pieces.length, c.name).toBeLessThanOrEqual(i === 0 ? 5 : 6);
      }
    });
  });

  it('keeps chapter I the gentlest: still obstacles only, two changes of pose a wave at the least, 1.75 R before a change, 1.5 R within a run', () => {
    for (const [i, w] of (CHAPTERS[0]?.waves ?? []).entries()) {
      expect(changes(w), `DRIFT wave ${i + 1}`).toBeGreaterThanOrEqual(2);
      w.pieces.forEach((p, k) => {
        expect(p.motion, `DRIFT wave ${i + 1}, line ${k + 2}`).toBe('still');
        const before = w.pieces[k - 1];
        if (!before) return;
        const least = POSE[before.kind].pose === POSE[p.kind].pose ? 1.5 : 1.75;
        expect(spaceBetween(before, p) / R, `DRIFT wave ${i + 1}, line ${k + 2}`).toBeGreaterThanOrEqual(least - 1e-9);
      });
    }
  });

  it('tightens to 1.25 R within a run of one pose in chapter IV', () => {
    const storm = (CHAPTERS[3]?.waves ?? []).flatMap((w) => w.pieces.slice(1).map((p, k) => ({ p, before: w.pieces[k] as Piece })));
    const same = storm.filter(({ p, before }) => POSE[p.kind].pose === POSE[before.kind].pose).map(({ p, before }) => spaceBetween(before, p) / R);
    expect(Math.min(...same)).toBeCloseTo(1.25, 9);
  });
});

describe('the speed-up at each wave\'s end', () => {
  const sample = parseWave('speed 120\ncentre · 0\nL half · 2R\ncentre turn · 2R', 'test');

  it('keeps the wave\'s speed until its last 35%, then speeds the fall up evenly, lightly, to 10% above it', () => {
    const { from, seconds, gain } = sample.ramp;
    expect(gain).toBe(RAMP.full);
    expect(RAMP.full).toBe(0.1);
    expect(from / (from + seconds)).toBeCloseTo(1 - RAMP.share, 9);
    expect(speedAt(sample, 0)).toBe(120);
    expect(speedAt(sample, from)).toBe(120);
    expect(speedAt(sample, from + seconds / 2)).toBeCloseTo(120 * 1.05, 9);
    expect(speedAt(sample, from + seconds)).toBeCloseTo(132, 9);
    expect(speedAt(sample, 60)).toBeCloseTo(132, 9);
  });

  it('ends exactly as the wave\'s last obstacle reach is below the circle', () => {
    const last = sample.pieces.at(-1);
    if (!last) throw new Error('no obstacle');
    const { from, seconds } = sample.ramp;
    expect(fallen(sample, from + seconds)).toBeCloseTo(last.above + reachOf(last) + RULES.centre.y + RULES.radius + RULES.orbRadius, 6);
  });

  it('moves the obstacles by the speed integrated, and timeAt undoes it', () => {
    let d = 0;
    const dt = 1e-4;
    for (let i = 0; i < 8 / dt; i++) d += speedAt(sample, (i + 0.5) * dt) * dt;
    expect(fallen(sample, 8)).toBeCloseTo(d, 2);
    for (const t of [0.5, sample.ramp.from + 0.1, sample.ramp.from + sample.ramp.seconds + 0.3]) expect(timeAt(sample, fallen(sample, t))).toBeCloseTo(t, 9);
    const [start] = blocksAt(sample, 0), [later] = blocksAt(sample, 300);
    expect((later?.cy ?? 0) - (start?.cy ?? 0)).toBeCloseTo(fallen(sample, 300 * RULES.subStep), 9);
  });

  it('never speeds chapter I up, and every other wave by 10%, endless ones too, never the pair\'s turn', () => {
    CHAPTERS.forEach((c, i) => { for (const w of c.waves) expect(w.ramp.gain, c.name).toBe(i === 0 ? RAMP.gentle : RAMP.full); });
    expect(RAMP.gentle).toBe(0);
    const [first] = CHAPTERS[0]?.waves ?? [];
    if (!first) throw new Error('no wave');
    expect(speedAt(first, 60)).toBe(first.speed);
    for (const w of endlessWaves(20)) expect(w.ramp.gain).toBe(RAMP.full);
    expect(RULES.turnsPerSecond).toBe(0.6);
  });

  it('asks the spacing at the speed the wave falls at as the obstacle arrives, its speed-up counted', () => {
    // A quarter turn and a reaction take 0.667 s: 100 px at 150 px/s, 107 px at the speed the half bar arrives at, sped up.
    const text = 'speed 150\ncentre · 0\ncentre · 1R\ncentre · 1R\ncentre · 1R\nL half · 1.85R';
    expect(spacingProblems([parseChapter('V', 'LATE', [text])])).toEqual(['chapter V · LATE, wave 1, line 6: 103.6 px behind, not 107.4']);
    expect(spacingProblems([parseChapter('V', 'FLAT', [text], 0)])).toEqual([]);
  });
});

describe('the ghosts', () => {
  const ghostly = (wave: Wave) => wave.pieces.some((p) => p.ghost);
  const plain = (wave: Wave): Wave => ({ ...wave, pieces: wave.pieces.map((p) => ({ ...p, ghost: false })) });

  it('are seen whole as they enter, fade, and are gone from 2 R above the circle\'s top', () => {
    const gone = RULES.centre.y - RULES.radius - 2 * R;
    expect(sightOf({ ghost: true }, { cy: -10 })).toBe(1);
    expect(sightOf({ ghost: true }, { cy: 0 })).toBe(1);
    expect(sightOf({ ghost: true }, { cy: gone / 2 })).toBeCloseTo(0.5, 9);
    expect(sightOf({ ghost: true }, { cy: gone })).toBe(0);
    expect(sightOf({ ghost: true }, { cy: RULES.centre.y })).toBe(0);
    expect(sightOf({ ghost: false }, { cy: RULES.centre.y })).toBe(1);
  });

  it('strike as any obstacle does: a wave falls, strikes and is passed the same with or without them', () => {
    const waves = [...(CHAPTERS[3]?.waves ?? []), ...endlessWaves(200)].filter(ghostly);
    expect(waves.length).toBeGreaterThan(10);
    for (const w of waves.slice(0, 12)) {
      for (let tick = 0; tick < 600; tick += 7) expect(blocksAt(w, tick)).toEqual(blocksAt(plain(w), tick));
      expect(route(w, 0)).toEqual(route(plain(w), 0));
    }
  });

  it('hide some obstacles of chapter IV\'s last four waves, and none before them', () => {
    CHAPTERS.forEach((c, i) => {
      c.waves.forEach((w, k) => { expect(ghostly(w), `${c.name} wave ${k + 1}`).toBe(i === 3 && k >= 6); });
    });
  });

  it('theme chapter IV\'s late waves as Duet\'s are: its eighth all rods, its ninth all ghosts', () => {
    const storm = CHAPTERS[3]?.waves ?? [];
    expect(storm[7]?.pieces.every((p) => p.motion === 'turn')).toBe(true);
    expect(storm[8]?.pieces.every((p) => p.ghost)).toBe(true);
  });

  it('come into endless mode from its 11th wave, a share rising slowly to 40% at most, never every obstacle of a wave but in a ghost-themed one', () => {
    for (const w of endlessWaves(10)) expect(ghostly(w)).toBe(false);
    expect(ghostShare(9)).toBe(0);
    expect(ghostShare(10)).toBeCloseTo(0.1, 9);
    expect(ghostShare(60)).toBeCloseTo(0.2, 9);
    expect(ghostShare(100_000)).toBe(0.4);
    const waves = endlessWaves(200);
    const all = waves.filter((w) => w.pieces.every((p) => p.ghost));
    const some = waves.filter((w) => ghostly(w) && !w.pieces.every((p) => p.ghost));
    expect(some.length).toBeGreaterThan(20);
    expect(all.length).toBeGreaterThan(0);
    expect(all.length).toBeLessThan(waves.length / 10);
  });

  it('let endless mode draw a wave of rods alone now and then', () => {
    const waves = endlessWaves(200);
    const turning = waves.filter((w) => w.pieces.every((p) => p.motion === 'turn'));
    expect(turning.length).toBeGreaterThan(3);
  });
});

describe('the spirals and the zigzags', () => {
  /** Whether a pattern asks what it says: a spiral passed holding only its turn (or nothing), never without it; a zigzag asking ◀ and ▶ between every two of its obstacles. */
  function asks(wave: Wave, p: Pattern): boolean {
    const seen = (k: number) => { const s = windowOf(wave, k); if (!s) throw new Error(`obstacle ${k + 1} never in reach`); return s; };
    if (p.shape === 'spiral') {
      const way = wayOf(wave.pieces[p.first] ?? { motion: 'still', back: false });
      const from = seen(p.first).first, to = seen(p.last).last;
      return throughHolding(wave, from, to, [0, way]) && !throughHolding(wave, from, to, [0, way === 1 ? -1 : 1]);
    }
    for (let k = p.first; k < p.last; k++) {
      const from = seen(k).first, to = seen(k + 1).last;
      if (throughHolding(wave, from, to, [0, 1]) || throughHolding(wave, from, to, [0, -1])) return false;
    }
    return true;
  }

  it('reads a spiral from three moving obstacles the same way round, and a zigzag from three each the other way', () => {
    const wave = parseWave('speed 100\ncentre slide · 0\ncentre turn · 2R\ncentre slide · 2R\ncentre turn back · 2R\ncentre slide · 2R\nL half · 2R', 'test');
    expect(patternsOf(wave)).toEqual([{ shape: 'spiral', first: 0, last: 2 }, { shape: 'zigzag', first: 2, last: 4 }]);
    expect(patternsOf(parseWave('speed 100\ncentre slide · 0\ncentre slide · 2R\ncentre · 2R\ncentre slide · 2R', 'test'))).toEqual([]);
  });

  it('holds at least two spirals and two zigzags in each chapter from II on, none in chapter I', () => {
    CHAPTERS.forEach((c, i) => {
      const found = c.waves.flatMap(patternsOf);
      const count = (shape: Pattern['shape']) => found.filter((p) => p.shape === shape).length;
      if (i === 0) expect(found, c.name).toEqual([]);
      else {
        expect(count('spiral'), c.name).toBeGreaterThanOrEqual(2);
        expect(count('zigzag'), c.name).toBeGreaterThanOrEqual(2);
      }
    });
  });

  it('asks of a person what each says, in every chapter: a spiral one turn held through it, a zigzag a change of turn at every obstacle', () => {
    for (const c of CHAPTERS) {
      c.waves.forEach((w, i) => { for (const p of patternsOf(w)) expect(asks(w, p), `${c.name} wave ${i + 1}: ${p.shape} ${p.first + 1} to ${p.last + 1}`).toBe(true); });
    }
  });

  it('read every rod chain as a spiral: two or three rods turning one way, 1.25 to 1.5 R apart, passed holding that turn', () => {
    const waves = [...CHAPTERS.flatMap((c) => c.waves), ...endlessWaves(200)];
    let chains = 0;
    for (const w of waves) {
      const spirals = patternsOf(w).filter((p) => p.shape === 'spiral');
      w.pieces.forEach((p, k) => {
        const before = w.pieces[k - 1];
        if (!before || p.motion !== 'turn' || before.motion !== 'turn' || p.back !== before.back || spaceBetween(before, p) >= 1.75 * R) return;
        chains++;
        expect(spaceBetween(before, p) / R).toBeGreaterThanOrEqual(1.25 - 1e-9);
        expect(spaceBetween(before, p) / R).toBeLessThanOrEqual(1.5 + 1e-9);
        expect(spirals.some((s) => s.first <= k - 1 && k <= s.last), `a chain at obstacle ${k + 1}`).toBe(true);
      });
    }
    expect(chains).toBeGreaterThan(10);
  });

  it('come into endless mode: its groups hold both, and its waves chain them as asked', () => {
    const shapes = new Set(ENDLESS_GROUPS.flatMap((g) => patternsOf(parseWave(['speed 145', ...g.map((l, i) => (i === 0 ? `${l} · 0` : l))].join('\n'), 'group')).map((p) => p.shape)));
    expect(shapes).toEqual(new Set(['spiral', 'zigzag']));
    const waves = endlessWaves(40);
    const found = waves.flatMap((w) => patternsOf(w).map((p) => ({ w, p })));
    expect(found.filter(({ p }) => p.shape === 'spiral').length).toBeGreaterThan(3);
    expect(found.filter(({ p }) => p.shape === 'zigzag').length).toBeGreaterThan(3);
    for (const { w, p } of found) expect(asks(w, p), `${p.shape} ${p.first + 1} to ${p.last + 1}`).toBe(true);
  });
});

// Slice 4: endless mode, once chapter IV is passed.

describe('the endless waves', () => {
  const endless = (waves: readonly Wave[]) => [{ numeral: 'ENDLESS', name: '×2', waves }];
  const fastestStorm = Math.max(...(CHAPTERS[3]?.waves ?? []).map((w) => w.speed));
  const written = (p: Piece) => `${p.side} ${p.kind} ${p.motion} ${p.back}`;

  it('are drawn from one fixed seed: the same waves for every player, wave after wave', () => {
    expect(Number.isInteger(ENDLESS_SEED)).toBe(true);
    expect(endlessWave(0)).toEqual(endlessWave(0));
    expect(endlessWave(17)).toEqual(endlessWave(17));
    expect(endlessWaves(5)).toEqual([0, 1, 2, 3, 4].map((n) => endlessWave(n)));
    const shapes = new Set(endlessWaves(40).map((w) => JSON.stringify(w.pieces)));
    expect(shapes.size).toBeGreaterThan(10);
  });

  it('fall at chapter IV\'s speed or above, rising slowly and never falling back', () => {
    const waves = endlessWaves(200);
    expect(waves[0]?.speed).toBeGreaterThanOrEqual(fastestStorm);
    waves.forEach((w, i) => { if (i > 0) expect(w.speed, `wave ${i + 1}`).toBeGreaterThanOrEqual(waves[i - 1]?.speed ?? 0); });
    expect(waves[199]?.speed).toBeGreaterThan(waves[0]?.speed ?? Infinity);
  });

  it('use still, sliding and turning obstacles, all three among them', () => {
    const motions = new Set(endlessWaves(60).flatMap((w) => w.pieces.map((p) => p.motion)));
    expect(motions).toEqual(new Set(['still', 'slide', 'turn']));
  });

  it('never end: any wave number has a wave', () => {
    expect(endlessWave(100_000).pieces.length).toBeGreaterThan(0);
  });

  it('are built from one to three of chapter IV\'s own groups, each a run of one pose as chapter IV wrote it', () => {
    expect(ENDLESS_GROUPS.length).toBeGreaterThan(8);
    const storm = (CHAPTERS[3]?.waves ?? []).map((w) => w.pieces.map(written).join(' / '));
    for (const group of ENDLESS_GROUPS) {
      const pieces = parseWave(['speed 100', ...group.map((l, i) => (i === 0 ? `${l} · 0` : l))].join('\n'), 'group').pieces;
      expect(new Set(pieces.map((p) => POSE[p.kind].pose)).size, group.join(' / ')).toBe(1);
      expect(storm.some((w) => w.includes(pieces.map(written).join(' / '))), group.join(' / ')).toBe(true);
    }
    // A wave read back group by group: the fewest of chapter IV's groups that, one after another, say its obstacles.
    const groups = ENDLESS_GROUPS.map((g) => g.map((l) => l.split(' · ')[0] ?? ''));
    const fewest = (words: readonly string[], k = 0): number => (k === words.length ? 0
      : Math.min(Infinity, ...groups.filter((g) => g.every((w, i) => words[k + i] === w)).map((g) => 1 + fewest(words, k + g.length))));
    for (const [n, w] of endlessWaves(60).entries()) {
      const words = w.pieces.map((p) => `${p.side < 0 ? 'L ' : p.side > 0 ? 'R ' : ''}${p.kind}${p.motion === 'still' ? '' : ` ${p.motion}`}${p.back ? ' back' : ''}`);
      expect(fewest(words), `wave ${n + 1}: ${words.join(' / ')}`).toBeGreaterThanOrEqual(1);
      expect(fewest(words), `wave ${n + 1}: ${words.join(' / ')}`).toBeLessThanOrEqual(3);
    }
  });

  it('start just above chapter IV\'s fastest and rise, one more every two waves, to a ceiling of 170 px/s, about 3 R a second, in a few dozen waves', () => {
    const speeds = endlessWaves(200).map((w) => w.speed);
    expect(speeds).toEqual(speeds.map((_, n) => endlessSpeed(n)));
    expect(speeds[0]).toBeGreaterThan(fastestStorm);
    expect(speeds[0]).toBeLessThanOrEqual(fastestStorm + 3);
    expect(speeds[2]).toBe((speeds[0] ?? 0) + 1);
    const top = endlessSpeed(100_000);
    expect(top).toBe(170);
    expect(top / R).toBeGreaterThan(2.9);
    expect(top / R).toBeLessThan(3.1);
    const reached = speeds.indexOf(top);
    expect(reached).toBeGreaterThanOrEqual(24);
    expect(reached).toBeLessThanOrEqual(60);
  });

  it('pack the obstacles of one pose 1.25 R apart, and leave a change of pose or a turn the room the spacing rule asks', () => {
    const spaces = endlessWaves(200).flatMap((w) => w.pieces.slice(1).map((p, k) => {
      const before = w.pieces[k] as Piece;
      return { space: spaceBetween(before, p) / R, same: p.motion === 'still' && before.motion === 'still' && POSE[p.kind].pose === POSE[before.kind].pose };
    }));
    expect(Math.min(...spaces.filter((s) => s.same).map((s) => s.space))).toBeCloseTo(1.25, 9);
    expect(spaces.filter((s) => s.same && s.space < 1.5 * R).length).toBeGreaterThan(20);
    expect(Math.max(...spaces.filter((s) => !s.same).map((s) => s.space))).toBeLessThan(3);
  });

  it('stop rising at a ceiling: a slow rise, never past it', () => {
    const speeds = endlessWaves(200).map((w) => w.speed);
    expect(Math.max(...speeds)).toBe(speeds[199]);
    expect(endlessWave(100_000).speed).toBe(speeds[199]);
  });

  it('ask to turn the pair in every one of the first 200, and last 8 seconds at most', () => {
    const { bins } = ring();
    endlessWaves(200).forEach((w, i) => {
      let alive = Array.from({ length: bins }, (_, b) => (b / bins) * Math.PI * 2);
      for (let tick = 1; alive.length && !passedAt(w, tick); tick++) alive = alive.filter((a) => !struck(a, blocksAt(w, tick)));
      expect(alive, `wave ${i + 1}`).toEqual([]);
      expect(secondsOf(w), `wave ${i + 1}`).toBeLessThanOrEqual(8);
    });
  });

  it('pass for a person for the first 200, from any angle, holding anything: a hit begins the wave hit again from wherever the orbs stand', () => {
    expect(waveProblems(endless(endlessWaves(200)))).toEqual([]);
  });

  it('keep the chapters\' room to spare for the first 200', () => {
    expect(waveProblems(endless(endlessWaves(200)), { reactionSeconds: 0.4, orbRadius: RULES.orbRadius + 2 })).toEqual([]);
  });
});
