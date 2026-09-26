import { describe, expect, it } from 'vitest';
import type { WoundKind } from '@omni/galaxy';
import type { Action } from '../keys';
import {
  alienAt, FIELDS, hudOf, LIVES, marchEvery, newGame, pause, press, rowKinds, SCORE_CAP, step, type Game,
} from './invaders';

// The close values the view passes in: made up here, so a test sees the engine pay what it is given.
const VALUES: Record<WoundKind, number> = {
  beacon: 31, 'fault-line': 23, 'unconfirmed-ground': 17, 'under-fire': 11, transmission: 7, aftershock: 99,
};
const FRAME = 1 / 60;
const NONE: ReadonlySet<Action> = new Set();
const hold = (...a: Action[]): ReadonlySet<Action> => new Set(a);

/** A game past its ready screen, with the formation's fire held back unless a test wants it. */
function playing(o: Partial<Game> = {}, layout: 'wide' | 'tall' = 'wide'): Game {
  const g = newGame({ layout, values: VALUES, seed: 7 });
  return { ...press(g, 'a').game, bombIn: 999, ...o };
}

/** `n` frames with `held` held. */
function run(g: Game, held: ReadonlySet<Action>, n: number): Game[] {
  const out: Game[] = [];
  for (let i = 0; i < n; i++) out.push(g = step(g, held, FRAME));
  return out;
}

const alive = (g: Game) => g.alive.filter(Boolean).length;

describe('a new game', () => {
  it('lines up 5 rows of 10 over four shields on the wide grid, and 5 rows of 6 over three on the tall one', () => {
    const wide = newGame({ layout: 'wide', values: VALUES, seed: 1 });
    expect([wide.rows, wide.cols, alive(wide), wide.shields.length]).toEqual([5, 10, 50, 4]);
    const tall = newGame({ layout: 'tall', values: VALUES, seed: 1 });
    expect([tall.rows, tall.cols, alive(tall), tall.shields.length]).toEqual([5, 6, 30, 3]);
    for (const g of [wide, tall]) {
      const f = FIELDS[g.layout];
      for (let col = 0; col < g.cols; col++) {
        const a = alienAt(g, 0, col), b = alienAt(g, g.rows - 1, col);
        expect(a.x).toBeGreaterThanOrEqual(0);
        expect(b.x + b.size).toBeLessThanOrEqual(f.w);
        expect(b.y + b.size).toBeLessThan(f.hero.y);
      }
      for (const s of g.shields) expect(s.x + f.shields.cols * f.shields.cell).toBeLessThanOrEqual(f.w);
    }
  });

  it('gives each row one kind of Entropy, the one that pays most on top, each paying the value passed in', () => {
    const g = newGame({ layout: 'wide', values: VALUES, seed: 1 });
    expect(g.kinds).toEqual(['beacon', 'fault-line', 'unconfirmed-ground', 'under-fire', 'transmission']);
    expect(g.values).toEqual([31, 23, 17, 11, 7]);
    expect(rowKinds({ ...VALUES, transmission: 50 })[0]).toBe('transmission');
  });

  it('opens on its ready screen with three lives and no score, and plays once the ready time is up or A is pressed', () => {
    const g = newGame({ layout: 'wide', values: VALUES, seed: 1 });
    expect(hudOf(g)).toMatchObject({ phase: 'ready', score: 0, lives: LIVES, wave: 1 });
    expect(LIVES).toBe(3);
    expect(hudOf(run(g, NONE, 200).at(-1)!).phase).toBe('play');
    expect(hudOf(press(g, 'a').game).phase).toBe('play');
    expect(press(g, 'b').leave).toBe(true);
  });

  it('plays the same game from the same seed', () => {
    const a = run({ ...playing(), bombIn: 0.1 }, hold('right', 'a'), 400).at(-1)!;
    const b = run({ ...playing(), bombIn: 0.1 }, hold('right', 'a'), 400).at(-1)!;
    expect(b).toEqual(a);
  });
});

describe('the hero', () => {
  it('moves while a direction is held, and stands still otherwise', () => {
    const g = playing();
    const right = run(g, hold('right'), 30).at(-1)!;
    expect(right.heroX).toBeGreaterThan(g.heroX);
    const left = run(g, hold('left'), 30).at(-1)!;
    expect(left.heroX).toBeLessThan(g.heroX);
    expect(run(g, NONE, 30).at(-1)!.heroX).toBe(g.heroX);
    expect(run(g, hold('left', 'right'), 30).at(-1)!.heroX).toBe(g.heroX);
  });

  it('stays on the field', () => {
    const g = playing();
    const f = FIELDS.wide;
    expect(run(g, hold('left'), 600).at(-1)!.heroX).toBeGreaterThanOrEqual(0);
    const far = run(g, hold('right'), 600).at(-1)!;
    expect(far.heroX + f.hero.w).toBeLessThanOrEqual(f.w);
  });

  it('fires one bolt at a time while A is held', () => {
    const frames = run(playing(), hold('a'), 120);
    expect(frames.every((g) => (g.bolt ? 1 : 0) <= 1)).toBe(true);
    const fired = frames.filter((g) => g.events.includes('fire')).length;
    expect(fired).toBeGreaterThanOrEqual(1);
    // A new bolt leaves only once the last one is gone.
    frames.forEach((g, i) => { if (g.events.includes('fire') && i > 0) expect(frames[i - 1].bolt).toBeNull(); });
  });
});

describe('a hit', () => {
  it('removes the alien and adds its kind\'s value, as passed in', () => {
    for (const row of [0, 4]) {
      const g = playing();
      const a = alienAt(g, row, 3);
      const next = step({ ...g, bolt: { x: a.x + 10, y: a.y + 12 } }, NONE, FRAME);
      expect(next.alive[row * g.cols + 3]).toBe(false);
      expect(alive(next)).toBe(alive(g) - 1);
      expect(next.score).toBe(g.values[row]);
      expect(next.bolt).toBeNull();
      expect(next.events).toContain('hit');
    }
  });

  it('never takes the score past 9,999,999', () => {
    expect(SCORE_CAP).toBe(9_999_999);
    const g = playing({ score: SCORE_CAP - 3 });
    const a = alienAt(g, 0, 0);
    expect(step({ ...g, bolt: { x: a.x + 10, y: a.y + 12 } }, NONE, FRAME).score).toBe(SCORE_CAP);
  });

  it('wears a shield away, from below and from above', () => {
    const g = playing();
    const s = g.shields[0];
    const cells = (x: Game) => x.shields[0].cells.filter(Boolean).length;
    const f = FIELDS.wide.shields;
    const up = step({ ...g, bolt: { x: s.x + 20, y: s.y + f.rows * f.cell - 4 } }, NONE, FRAME);
    expect(cells(up)).toBeLessThan(cells(g));
    expect(up.bolt).toBeNull();
    const down = step({ ...g, bombs: [{ x: s.x + 20, y: s.y - 6 }] }, NONE, FRAME);
    expect(cells(down)).toBeLessThan(cells(g));
    expect(down.bombs).toEqual([]);
  });
});

describe('the formation', () => {
  it('marches side to side, one step at a time', () => {
    const g = playing({ marchIn: 0 });
    const next = step(g, NONE, FRAME);
    expect(next.fx).toBe(g.fx + FIELDS.wide.march);
    expect(next.fy).toBe(g.fy);
    expect(next.events).toContain('march');
  });

  it('steps down at an edge, and turns back', () => {
    const f = FIELDS.wide;
    const g = playing();
    const room = f.w - f.margin - (alienAt(g, 0, g.cols - 1).x + f.alien);
    const atEdge = playing({ fx: room, marchIn: 0 });
    const next = step(atEdge, NONE, FRAME);
    expect(next.fy).toBe(atEdge.fy + f.drop);
    expect(next.fx).toBe(atEdge.fx);
    expect(next.dir).toBe(-1);
    expect(step({ ...next, marchIn: 0 }, NONE, FRAME).fx).toBe(atEdge.fx - f.march);
  });

  it('marches faster as it thins out', () => {
    const g = playing();
    const thin = { ...g, alive: g.alive.map((_, i) => i < 5) };
    expect(marchEvery(thin)).toBeLessThan(marchEvery(g));
  });

  it('starts the next wave, faster, once the last alien is hit', () => {
    const g = playing();
    const last = { ...g, alive: g.alive.map((_, i) => i === 0) };
    const a = alienAt(last, 0, 0);
    const next = step({ ...last, bolt: { x: a.x + 10, y: a.y + 12 } }, NONE, FRAME);
    expect(next.wave).toBe(2);
    expect(next.events).toContain('wave');
    expect(alive(next)).toBe(50);
    expect([next.fx, next.fy]).toEqual([0, 0]);
    expect(next.score).toBe(g.values[0]);
    expect(marchEvery(next)).toBeLessThan(marchEvery(g));
  });

  it('fires back', () => {
    const frames = run(playing({ bombIn: 0.2 }), NONE, 60);
    expect(frames.some((g) => g.bombs.length > 0)).toBe(true);
    const max = FIELDS.wide.bomb.max;
    expect(run(playing({ bombIn: 0 }), NONE, 600).every((g) => g.bombs.length <= max)).toBe(true);
  });
});

describe('lives and the end of the game', () => {
  const onHero = (g: Game) => ({ x: g.heroX + FIELDS.wide.hero.w / 2, y: FIELDS.wide.hero.y + 20 });

  it('takes a life for a hit, and ends the game at no lives', () => {
    const g = playing();
    const hit = step({ ...g, bombs: [onHero(g)] }, NONE, FRAME);
    expect(hit.lives).toBe(LIVES - 1);
    expect(hit.events).toContain('hurt');
    expect(hudOf(hit).phase).toBe('play');
    const lastLife = playing({ lives: 1 });
    const over = step({ ...lastLife, bombs: [onHero(lastLife)] }, NONE, FRAME);
    expect(over.lives).toBe(0);
    expect(over.events).toContain('over');
    expect(hudOf(over).phase).toBe('over');
  });

  it('ends the game when the formation reaches the hero\'s row', () => {
    const f = FIELDS.wide;
    const g = playing();
    const lowest = alienAt(g, g.rows - 1, 0);
    const room = f.w - f.margin - (alienAt(g, 0, g.cols - 1).x + f.alien);
    const fy = f.hero.y - (lowest.y + f.alien) - f.drop + 1; // one step down from the hero's head
    const next = step(playing({ fx: room, fy, marchIn: 0 }), NONE, FRAME);
    expect(next.events).toContain('over');
    expect(hudOf(next).phase).toBe('over');
    expect(next.lives).toBe(g.lives);
  });

  it('stops everything at game over, and leaves on a key once the score has shown for a moment', () => {
    const over = playing({ over: true, overAt: 10, t: 10 });
    const later = run(over, hold('right', 'a'), 30).at(-1)!;
    expect([later.heroX, later.bolt, later.fx, later.score]).toEqual([over.heroX, over.bolt, over.fx, over.score]);
    expect(press(over, 'a').leave).toBe(false);
    expect(press(run(over, NONE, 90).at(-1)!, 'a').leave).toBe(true);
  });
});

describe('pause', () => {
  it('leaves a paused game as it was, whatever is held', () => {
    const g = pause(run(playing({ bombIn: 0.1 }), hold('right', 'a'), 30).at(-1)!);
    expect(hudOf(g).phase).toBe('paused');
    expect(step(g, hold('left', 'a'), FRAME)).toBe(g);
    expect(run(g, hold('left', 'a'), 120).at(-1)).toBe(g);
  });

  it('pauses with START, resumes with START, and leaves for the room with B from the pause', () => {
    const g = playing();
    const paused = press(g, 'start');
    expect([hudOf(paused.game).phase, paused.leave]).toEqual(['paused', false]);
    expect(hudOf(press(paused.game, 'start').game).phase).toBe('play');
    expect(press(paused.game, 'b').leave).toBe(true);
    expect(press(g, 'left').game).toBe(g);
  });

  it('never pauses a game that is over', () => {
    const over = playing({ over: true, overAt: 0 });
    expect(hudOf(pause(over)).phase).toBe('over');
  });
});
