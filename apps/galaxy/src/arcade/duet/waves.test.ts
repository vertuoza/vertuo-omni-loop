import { describe, expect, it } from 'vitest';
import { RULES } from './rules';
import {
  blocksAt, CHAPTERS, ENDLESS_SEED, endlessWave, endlessWaves, LEGEND, parseChapter, parseWave, passedAt, ring, SHAPE, struck, waveProblems, type Wave,
} from './waves';

// OMNI DUET's waves (PRD 1633, slice 3): the four chapters as text, the legend they are written in,
// the blocks they become, and the check that proves every wave passable.

const at = (wave: Wave, seconds: number) => blocksAt(wave, Math.round(seconds / RULES.subStep));

describe('the chapters', () => {
  it('are I · DRIFT, II · SLIDE, III · SPIN and IV · STORM, of about ten waves each', () => {
    expect(CHAPTERS.map((c) => `${c.numeral} · ${c.name}`)).toEqual(['I · DRIFT', 'II · SLIDE', 'III · SPIN', 'IV · STORM']);
    for (const c of CHAPTERS) {
      expect(c.waves.length, c.name).toBeGreaterThanOrEqual(8);
      expect(c.waves.length, c.name).toBeLessThanOrEqual(12);
    }
  });

  it('brings in still blocks first, then sliding ones, then turning ones, then all three faster', () => {
    const kinds = (i: number) => new Set(CHAPTERS[i]?.waves.flatMap((w) => w.pieces.map((p) => p.kind)));
    expect([...kinds(0)]).toEqual(['still']);
    expect(kinds(1).has('slide')).toBe(true);
    expect(kinds(1).has('turn')).toBe(false);
    expect(kinds(2).has('turn')).toBe(true);
    expect(kinds(3)).toEqual(new Set(['still', 'slide', 'turn']));
    const slowest = (i: number) => Math.min(...(CHAPTERS[i]?.waves.map((w) => w.speed) ?? []));
    const fastest = (i: number) => Math.max(...(CHAPTERS[i]?.waves.map((w) => w.speed) ?? []));
    expect(slowest(3)).toBeGreaterThan(fastest(2));
  });

  it('raises the speed wave after wave within each chapter', () => {
    for (const c of CHAPTERS) {
      c.waves.forEach((w, i) => { if (i > 0) expect(w.speed, `${c.name} wave ${i + 1}`).toBeGreaterThan(c.waves[i - 1]?.speed ?? 0); });
    }
  });
});

describe('the wave text', () => {
  it('reads the speed, the gap, the rows, and a run of one character as one block', () => {
    const wave = parseWave('speed 70 · gap 32\n##..>>>@*.\n..........\n.<<.......', 'test');
    expect(wave).toMatchObject({ speed: 70, gap: 32, rows: 3 });
    expect(wave.pieces).toEqual([
      { kind: 'still', dir: 1, row: 0, col: 0, len: 2 },
      { kind: 'slide', dir: 1, row: 0, col: 4, len: 3 },
      { kind: 'turn', dir: 1, row: 0, col: 7, len: 1 },
      { kind: 'turn', dir: -1, row: 0, col: 8, len: 1 },
      { kind: 'slide', dir: -1, row: 2, col: 1, len: 2 },
    ]);
    expect(parseWave('speed 60\n....##....', 'test').gap).toBe(0);
  });

  it('uses only the legend\'s characters', () => {
    const used = new Set(CHAPTERS.flatMap((c) => c.waves.flatMap((w) => w.pieces.map((p) => `${p.kind} ${p.dir}`))));
    const legend = new Set(Object.values(LEGEND).map((l) => `${l.kind} ${l.dir}`));
    for (const u of used) expect(legend.has(u), u).toBe(true);
  });

  it('refuses an unknown character with its chapter, wave and position', () => {
    expect(() => parseChapter('II', 'SLIDE', ['speed 60\n....##....', 'speed 60\n..........\n...#x.....']))
      .toThrow('chapter II · SLIDE, wave 2, row 2, column 5: "x" is not in the legend');
  });

  it('refuses a row of the wrong width, and a wave with no speed', () => {
    expect(() => parseChapter('I', 'DRIFT', ['speed 60\n....##...'])).toThrow('chapter I · DRIFT, wave 1, row 1: 9 cells, not 10');
    expect(() => parseChapter('I', 'DRIFT', ['....##....'])).toThrow('chapter I · DRIFT, wave 1: the first line is not');
    expect(() => parseChapter('I', 'DRIFT', ['speed 60'])).toThrow('chapter I · DRIFT, wave 1: no rows');
  });
});

describe('the blocks', () => {
  const wave = parseWave('speed 60\n....##....', 'test');

  it('enter from above the playfield and fall straight down at the wave\'s speed', () => {
    const [start] = at(wave, 0);
    expect(start).toEqual({ cx: 160, cy: -8, w: 32, h: SHAPE.thick, angle: 0 });
    const [later] = at(wave, 1);
    expect(later?.cx).toBe(160);
    expect(later?.cy).toBeCloseTo(52, 9);
  });

  it('wait above the playfield for the wave\'s gap before they enter', () => {
    const gapped = parseWave('speed 60 · gap 32\n....##....', 'test');
    expect(at(gapped, 0)[0]?.cy).toBe(-40);
  });

  it('slide between their two bounds, setting off the way they were written', () => {
    const slide = parseWave('speed 60\n....>>..<<', 'test');
    const xs = (s: number) => at(slide, s).map((b) => b.cx);
    expect(xs(0)).toEqual([160, 224]);
    const quarter = SHAPE.slideReach / SHAPE.slideSpeed;
    expect(xs(quarter)[0]).toBeCloseTo(160 + SHAPE.slideReach, 9);
    expect(xs(quarter)[1]).toBeCloseTo(224 - SHAPE.slideReach, 9);
    expect(xs(quarter * 3)[0]).toBeCloseTo(160 - SHAPE.slideReach, 9);
    for (let s = 0; s < 5; s += 0.05) {
      const [x] = xs(s);
      expect(Math.abs((x ?? 0) - 160)).toBeLessThanOrEqual(SHAPE.slideReach + 1e-9);
    }
  });

  it('turn about their centre at a constant rate, each the way it was written', () => {
    const spin = parseWave('speed 60\n..@@..**..', 'test');
    const quarter = 0.25 / SHAPE.spinTurnsPerSecond;
    const [a, c] = at(spin, quarter);
    expect(a?.angle).toBeCloseTo(Math.PI / 2, 9);
    expect(c?.angle).toBeCloseTo(-Math.PI / 2, 9);
    expect(a?.cx).toBe(128);
  });

  it('count a wave passed once its last block is entirely below the circle', () => {
    const bottom = RULES.centre.y + RULES.radius + RULES.orbRadius;
    // The block's top edge is at -14 + 60 t: it clears the circle's bottom once that passes `bottom`.
    const clear = (bottom + 14) / 60;
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

describe('every wave is passable', () => {
  it('turns on a ring of 48 bins, 1 a step: the run\'s own angles, exactly', () => {
    expect(ring()).toEqual({ bins: 48, move: 1 });
  });

  it('passes every chapter wave, each from where the wave before can leave the orbs', () => {
    expect(waveProblems(CHAPTERS)).toEqual([]);
  });

  it('names a deliberately impassable wave: a wall across the circle', () => {
    const walled = parseChapter('V', 'WALL', ['speed 60\n....##....', 'speed 60\n##########', 'speed 60\n##......##']);
    expect(waveProblems([walled])).toEqual(['chapter V · WALL, wave 2: no way through']);
  });

  it('names a wave whose rows ask for a quicker turn than the orbs can make', () => {
    // Two bars in one row leave a gap in the middle; the orbs must stand upright to pass it, and a bar
    // right behind on one side asks them to lie flat within one block's height: too quick a turn.
    const tight = parseChapter('V', 'TIGHT', ['speed 300\n####..####\n....##....']);
    expect(waveProblems([tight])).toEqual(['chapter V · TIGHT, wave 1: no way through']);
  });
});

// Slice 4: endless mode, once chapter IV is passed.

describe('the endless waves', () => {
  const endless = (waves: readonly Wave[]) => [{ numeral: 'ENDLESS', name: '×2', waves }];
  const fastestStorm = Math.max(...(CHAPTERS[3]?.waves ?? []).map((w) => w.speed));

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

  it('use only the legend\'s blocks, all three kinds among them', () => {
    const kinds = new Set(endlessWaves(60).flatMap((w) => w.pieces.map((p) => p.kind)));
    expect(kinds).toEqual(new Set(['still', 'slide', 'turn']));
  });

  it('never end: any wave number has a wave', () => {
    expect(endlessWave(100_000).pieces.length).toBeGreaterThan(0);
  });

  it('pass waveProblems for the first 200, each from where the wave before can leave the orbs', () => {
    expect(waveProblems(endless(endlessWaves(200)))).toEqual([]);
  });

  it('can each be begun again from any angle, as a hit in endless mode begins the wave hit again', () => {
    const stuck = endlessWaves(200).flatMap((w, i) => (waveProblems(endless([w])).length ? [i + 1] : []));
    expect(stuck).toEqual([]);
  });
});
