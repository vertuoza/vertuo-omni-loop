import { describe, expect, it } from 'vitest';
import type { Block } from './collide';
import { RULES } from './rules';
import {
  blocksAt, CHAPTERS, ENDLESS_GROUPS, ENDLESS_SEED, endlessWave, endlessWaves, parseChapter, parseWave, passedAt, POSE, reachOf, ring, route,
  SHAPE, spaceBetween, spacingProblems, struck, turnSeconds, waveProblems, type Piece, type Wave,
} from './waves';

// OMNI DUET's waves (PRD 1633, slice 3; issue 1672): the vocabulary of obstacles set on the circle,
// each dodged by one clear pose, the four chapters written in it, the spacing a turn asks for, and the
// check that proves every wave passable by a person (issue 1663).

const R = RULES.radius;
const at = (wave: Wave, seconds: number) => blocksAt(wave, Math.round(seconds / RULES.subStep));
const UPRIGHT = Math.PI / 2, LEVEL = 0;

/** The first two blocks of a wave, which the test wrote. */
function two(blocks: readonly Block[]): [Block, Block] {
  const [a, b] = blocks;
  if (!a || !b) throw new Error('not two blocks');
  return [a, b];
}

/** Every obstacle the legend can write: each kind on each of its sides, still, sliding and turning, either way round. */
const EVERY = ['L half', 'R half', 'centre'].flatMap((w) => ['', ' slide', ' slide back', ' turn', ' turn back'].map((m) => `${w}${m}`));

/** Whether orbs held at `angle`, `r` wide, are struck by a wave of `words` alone, at any sub-step until it is passed. */
function strikes(words: string, angle: number, { speed = 60, distance = '0', r = RULES.orbRadius }: { speed?: number; distance?: string; r?: number } = {}): boolean {
  const wave = parseWave(`speed ${speed}\n${words} · ${distance}`, 'test');
  for (let tick = 1; !passedAt(wave, tick); tick++) if (struck(angle, blocksAt(wave, tick), r)) return true;
  return false;
}

describe('the vocabulary', () => {
  const posed = (words: string) => POSE[parseWave(`speed 60\n${words} · 0`, 'test').pieces[0]?.kind ?? 'centre'];

  it('asks the pair upright for half bars, and level for the centre block', () => {
    expect(posed('L half').pose).toBe('upright');
    expect(posed('R half turn').pose).toBe('upright');
    expect(posed('centre slide').pose).toBe('level');
  });

  it('holds two obstacles only, as Duet has: no upright bar', () => {
    expect(Object.keys(POSE)).toEqual(['half', 'centre']);
    expect(() => parseWave('speed 100\nL upright · 0', 'test')).toThrow('test, line 2: "upright" is not in the legend');
  });

  it.each(EVERY)('%s: its one pose clears it, with room for orbs 2 pixels wider; the other pose hits it', (words) => {
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

  it('uses every kind of obstacle on both sides', () => {
    const used = new Set(CHAPTERS.flatMap((_, i) => pieces(i).map((p) => `${p.side} ${p.kind}`)));
    expect(used).toEqual(new Set(['-1 half', '1 half', '0 centre']));
  });

  it('raises the speed wave after wave within each chapter', () => {
    for (const c of CHAPTERS) {
      c.waves.forEach((w, i) => { if (i > 0) expect(w.speed, `${c.name} wave ${i + 1}`).toBeGreaterThan(c.waves[i - 1]?.speed ?? 0); });
    }
  });
});

describe('the wave text', () => {
  it('reads the speed, then one obstacle a line, each its distance behind the one before', () => {
    const wave = parseWave('speed 70\nL half · 0\ncentre slide · 2R\nR half turn back · 1.5R', 'test');
    expect(wave.speed).toBe(70);
    expect(wave.pieces.map(({ kind, side, motion, back }) => ({ kind, side, motion, back }))).toEqual([
      { kind: 'half', side: -1, motion: 'still', back: false },
      { kind: 'centre', side: 0, motion: 'slide', back: false },
      { kind: 'half', side: 1, motion: 'turn', back: true },
    ]);
    const [a, b, c] = wave.pieces as [Piece, Piece, Piece];
    expect(a.above).toBeCloseTo(reachOf(a), 9);
    expect(spaceBetween(a, b)).toBeCloseTo(2 * R, 9);
    expect(spaceBetween(b, c)).toBeCloseTo(1.5 * R, 9);
  });

  it('counts a turning obstacle at the disc it sweeps', () => {
    expect(reachOf({ kind: 'half', motion: 'turn' })).toBeCloseTo(Math.hypot(2 * R, 0.3 * R) / 2, 9);
    expect(reachOf({ kind: 'half', motion: 'slide' })).toBeCloseTo(0.15 * R, 9);
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

  it('slide within their reach: a half bar only away from the centre line and back, a centre block either side', () => {
    const slide = parseWave('speed 60\nL half slide · 0\ncentre slide back · 0', 'test');
    const xs = (s: number) => at(slide, s).map((b) => b.cx);
    const [half0 = 0, centre0 = 0] = xs(0);
    expect(centre0).toBe(160);
    for (let s = 0; s < 8; s += 0.05) {
      const [half = 0, centre = 0] = xs(s);
      expect(half).toBeLessThanOrEqual(half0 + 1e-9);
      expect(half0 - half).toBeLessThanOrEqual(SHAPE.slideReach.half * R + 1e-9);
      expect(Math.abs(centre - 160)).toBeLessThanOrEqual(SHAPE.slideReach.centre * R + 1e-9);
    }
    const quarter = SHAPE.slideReach.centre / SHAPE.slideSpeed;
    expect(xs(quarter)[1]).toBeCloseTo(160 - SHAPE.slideReach.centre * R, 0);
  });

  it('turn about their middle at a constant rate, each the way it was written, standing as written as they cross the centre\'s height', () => {
    const quarter = 0.25 / SHAPE.spinTurnsPerSecond;
    for (const [words, way] of [['centre turn', 1], ['R half turn back', -1]] as const) {
      const spin = parseWave(`speed 60\n${words} · 0`, 'test');
      const crossing = (RULES.centre.y + (spin.pieces[0]?.above ?? 0)) / 60;
      expect(at(spin, crossing)[0]?.angle, words).toBeCloseTo(0, 1);
      const [later] = at(spin, crossing + quarter);
      expect(later?.angle, words).toBeCloseTo((way * Math.PI) / 2, 1);
      expect(later?.cx, words).toBe(at(spin, 0)[0]?.cx);
    }
  });

  it('count a wave passed once its last obstacle is entirely below the circle', () => {
    const bottom = RULES.centre.y + RULES.radius + RULES.orbRadius;
    // The block's top edge is at -side + 60 t: it clears the circle's bottom once that passes `bottom`.
    const clear = (bottom + side) / 60;
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
    expect(turnSeconds('half', 'half')).toBe(0);
    expect(turnSeconds('centre', 'centre')).toBe(0);
    const quarter = 0.25 / RULES.turnsPerSecond + RULES.reactionSeconds;
    expect(turnSeconds('half', 'centre')).toBeCloseTo(quarter, 9);
    expect(turnSeconds('centre', 'half')).toBeCloseTo(quarter, 9);
  });

  it('stands every chapter obstacle that asks another pose far enough behind the one before, at its wave\'s speed', () => {
    expect(spacingProblems(CHAPTERS)).toEqual([]);
  });

  it('names an obstacle too close behind one of the other pose, and lets one of the same pose follow closely', () => {
    const close = parseChapter('V', 'CLOSE', ['speed 100\nL half · 0\nR half · 0.25R\ncentre · 1R']);
    expect(spacingProblems([close])).toEqual(['chapter V · CLOSE, wave 1, line 4: 56.0 px behind, not 66.7']);
  });

  it('keeps the endless waves to it too, for the first 200', () => {
    expect(spacingProblems([{ numeral: 'ENDLESS', name: '×2', waves: endlessWaves(200) }])).toEqual([]);
  });
});

describe('every wave is passable by a person', () => {
  /** A person who reacts slower than the check's, with orbs 2 pixels wider: the room every wave keeps to spare. */
  const SPARE = { reactionSeconds: 0.4, orbRadius: RULES.orbRadius + 2 };

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
  const seconds = (wave: Wave) => {
    let tick = 1;
    while (!passedAt(wave, tick)) tick++;
    const first = wave.pieces[0];
    const enters = first ? (first.above - reachOf(first)) / wave.speed : 0;
    return tick * RULES.subStep - enters;
  };

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

  it('keeps chapter I the gentlest: still half bars and centre blocks, two changes of pose a wave at the least, 1.75 R before a change, 1.5 R within a run', () => {
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
    const groups = new Set(ENDLESS_GROUPS.map((g) => g.map((l) => l.split(' · ')[0]).join(' / ')));
    for (const w of endlessWaves(60)) {
      const runs: string[][] = [];
      w.pieces.forEach((p, k) => {
        const before = w.pieces[k - 1];
        const words = `${p.side < 0 ? 'L ' : p.side > 0 ? 'R ' : ''}${p.kind}${p.motion === 'still' ? '' : ` ${p.motion}`}${p.back ? ' back' : ''}`;
        if (before && spaceBetween(before, p) < 2.5 * R - 1e-9) runs.at(-1)?.push(words);
        else runs.push([words]);
      });
      expect(runs.length).toBeGreaterThanOrEqual(1);
      expect(runs.length).toBeLessThanOrEqual(3);
      for (const run of runs) expect(groups.has(run.join(' / ')), run.join(' / ')).toBe(true);
    }
  });

  it('stop rising at a ceiling: a slow rise, never past it', () => {
    const speeds = endlessWaves(200).map((w) => w.speed);
    expect(Math.max(...speeds)).toBe(speeds[199]);
    expect(endlessWave(100_000).speed).toBe(speeds[199]);
  });

  it('pass for a person for the first 200, from any angle, holding anything: a hit begins the wave hit again from wherever the orbs stand', () => {
    expect(waveProblems(endless(endlessWaves(200)))).toEqual([]);
  });

  it('keep the chapters\' room to spare for the first 200', () => {
    expect(waveProblems(endless(endlessWaves(200)), { reactionSeconds: 0.4, orbRadius: RULES.orbRadius + 2 })).toEqual([]);
  });
});
