import { describe, expect, it } from 'vitest';
import { end, newMatch, paddleX, step, type Match, type MatchEvent } from './match';
import { MATCH } from './rules';
import type { Steer } from './steer';

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);
const half = MATCH.paddle.h / 2;

/** A match in play: served, the ball on its way. */
function served(seed: number): Match {
  let m = newMatch({ seed });
  while (m.phase === 'serve') m = step(m, 'still', MATCH.subStep).match;
  return m;
}

/** Where the ball will cross `x`, walls folded in: what a player who reads the ball aims for. */
function interceptY(m: Match, x: number): number {
  const t = (x - m.ball.x) / m.ball.vx;
  const lo = MATCH.ball / 2, span = MATCH.field.h - MATCH.ball;
  const raw = m.ball.y - lo + m.ball.vy * t;
  const folded = ((raw % (2 * span)) + 2 * span) % (2 * span);
  return lo + (folded > span ? 2 * span - folded : folded);
}

/** A player that returns every ball it can reach: toward the ball's crossing when it comes, to the centre otherwise. */
function reader(m: Match): Steer {
  const coming = m.phase === 'play' && m.ball.vx < 0;
  const target = coming ? interceptY(m, paddleX('player')) : MATCH.field.h / 2;
  const gap = target - m.player;
  if (Math.abs(gap) < MATCH.playerSpeed * MATCH.subStep) return 'still';
  return gap < 0 ? 'up' : 'down';
}

/** A player that reads every ball, except the balls coming to it whose 1-based numbers are in `misses`: those it runs from. */
function readerMissing(misses: ReadonlySet<number>): (m: Match, approach: number) => Steer {
  return (m, approach) => {
    if (m.phase === 'play' && m.ball.vx < 0 && misses.has(approach)) return interceptY(m, paddleX('player')) < MATCH.field.h / 2 ? 'down' : 'up';
    return reader(m);
  };
}

interface Played { match: Match; events: MatchEvent[]; speeds: number[] }

/** Plays up to `seconds` in frames of `dt`, steered by `policy` (told how many balls have come to the player), until over. */
function play(seed: number, policy: (m: Match, approach: number) => Steer, seconds: number, dt = MATCH.subStep): Played {
  let m = newMatch({ seed });
  const events: MatchEvent[] = [];
  const speeds: number[] = [];
  let approach = 0, coming = false;
  for (let t = 0; t < seconds && m.phase !== 'over'; t += dt) {
    const nowComing = m.phase === 'play' && m.ball.vx < 0;
    if (nowComing && !coming) approach++;
    coming = nowComing;
    const s = step(m, policy(m, approach), dt);
    for (const e of s.events) {
      events.push(e);
      if (e === 'point') speeds.push(m.speed);
    }
    m = s.match;
  }
  return { match: m, events, speeds };
}

describe('a new match', () => {
  it('stands the player on the left and the AI on the right, both centred, the ball at the centre, three lives and no score', () => {
    const m = newMatch({ seed: 7 });
    expect(m).toMatchObject({ phase: 'serve', score: 0, lives: 3, player: MATCH.field.h / 2, ai: MATCH.field.h / 2, toward: 'player' });
    expect(m.ball).toMatchObject({ x: MATCH.field.w / 2, y: MATCH.field.h / 2, vx: 0, vy: 0 });
    expect(paddleX('player')).toBeLessThan(MATCH.field.w / 2);
    expect(paddleX('ai')).toBeGreaterThan(MATCH.field.w / 2);
  });

  it('serves from the centre toward the player after one second, at the serve speed and an angle drawn from the seed', () => {
    let m = newMatch({ seed: 7 });
    const steps = Math.round(MATCH.serveSeconds / MATCH.subStep);
    for (let i = 0; i < steps - 1; i++) m = step(m, 'still', MATCH.subStep).match;
    expect(m.phase).toBe('serve');
    const s = step(m, 'still', MATCH.subStep);
    expect(s.events).toContain('serve');
    expect(s.match.phase).toBe('play');
    expect(s.match.ball.vx).toBeLessThan(0);
    expect(Math.hypot(s.match.ball.vx, s.match.ball.vy)).toBeCloseTo(MATCH.serveSpeed, 6);
    const angles = new Set(SEEDS.slice(0, 20).map((seed) => served(seed).ball.vy.toFixed(3)));
    expect(angles.size).toBeGreaterThan(10);
    for (const seed of SEEDS) {
      const angle = Math.abs(Math.atan2(served(seed).ball.vy, -served(seed).ball.vx));
      expect(angle).toBeGreaterThanOrEqual(MATCH.serveAngle.min - 1e-9);
      expect(angle).toBeLessThanOrEqual(MATCH.serveAngle.max + 1e-9);
    }
  });
});

describe('the ball', () => {
  it('bounces off the top and bottom walls, keeping its speed', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const { events } = play(seed, reader, 30);
      expect(events).toContain('wall');
    }
    let m: Match = { ...served(3), ball: { x: MATCH.field.w / 2, y: MATCH.ball / 2 + 0.5, vx: -100, vy: -200 } };
    const s = step(m, 'still', MATCH.subStep);
    m = s.match;
    expect(s.events).toContain('wall');
    expect(m.ball.vy).toBe(200);
    expect(m.ball.y).toBeGreaterThanOrEqual(MATCH.ball / 2);
    const low = step({ ...m, ball: { x: 160, y: MATCH.field.h - MATCH.ball / 2 - 0.5, vx: 100, vy: 200 } }, 'still', MATCH.subStep);
    expect(low.events).toContain('wall');
    expect(low.match.ball.vy).toBe(-200);
    expect(low.match.ball.y).toBeLessThanOrEqual(MATCH.field.h - MATCH.ball / 2);
  });

  it('comes back off the player\'s paddle, faster by the factor', () => {
    const m = served(5);
    const face = paddleX('player') + MATCH.paddle.w / 2 + MATCH.ball / 2;
    const at: Match = { ...m, speed: 200, player: 144, ball: { x: face + 1, y: 144, vx: -200, vy: 0 } };
    const s = step(at, 'still', MATCH.subStep);
    expect(s.events).toContain('return');
    expect(s.match.ball.vx).toBeGreaterThan(0);
    expect(s.match.speed).toBeCloseTo(200 * MATCH.speedUp, 9);
    expect(Math.hypot(s.match.ball.vx, s.match.ball.vy)).toBeCloseTo(200 * MATCH.speedUp, 9);
  });

  it('comes back off the AI\'s paddle, faster by the factor', () => {
    const m = served(5);
    const face = paddleX('ai') - MATCH.paddle.w / 2 - MATCH.ball / 2;
    const at: Match = { ...m, speed: 200, ai: 100, ball: { x: face - 1, y: 100, vx: 200, vy: 0 } };
    const s = step(at, 'still', MATCH.subStep);
    expect(s.events).toContain('return');
    expect(s.match.ball.vx).toBeLessThan(0);
    expect(s.match.speed).toBeCloseTo(200 * MATCH.speedUp, 9);
  });

  it('never goes faster than the cap, however long the rally', () => {
    const m = served(5);
    const face = paddleX('player') + MATCH.paddle.w / 2 + MATCH.ball / 2;
    const s = step({ ...m, speed: MATCH.maxSpeed, player: 144, ball: { x: face + 1, y: 144, vx: -MATCH.maxSpeed, vy: 0 } }, 'still', MATCH.subStep);
    expect(s.events).toContain('return');
    expect(s.match.speed).toBe(MATCH.maxSpeed);
    for (const seed of SEEDS.slice(0, 50)) {
      let r = newMatch({ seed });
      for (let i = 0; i < 120 * 60 && r.phase !== 'over'; i++) {
        r = step(r, reader(r), MATCH.subStep).match;
        expect(r.speed).toBeLessThanOrEqual(MATCH.maxSpeed);
      }
    }
  });

  it('turns off the paddle by where it struck: above the centre goes up, below goes down', () => {
    const m = served(5);
    const face = paddleX('player') + MATCH.paddle.w / 2 + MATCH.ball / 2;
    const high = step({ ...m, speed: 200, player: 144, ball: { x: face + 1, y: 144 - half + 2, vx: -200, vy: 0 } }, 'still', MATCH.subStep);
    const low = step({ ...m, speed: 200, player: 144, ball: { x: face + 1, y: 144 + half - 2, vx: -200, vy: 0 } }, 'still', MATCH.subStep);
    expect(high.match.ball.vy).toBeLessThan(0);
    expect(low.match.ball.vy).toBeGreaterThan(0);
  });
});

describe('the paddles', () => {
  it('moves the player\'s paddle up, down or not at all, at one speed, and never off the field', () => {
    const m = served(5);
    const d = MATCH.playerSpeed * MATCH.subStep;
    expect(step(m, 'up', MATCH.subStep).match.player).toBeCloseTo(m.player - d, 9);
    expect(step(m, 'down', MATCH.subStep).match.player).toBeCloseTo(m.player + d, 9);
    expect(step(m, 'still', MATCH.subStep).match.player).toBe(m.player);
    let top = m;
    for (let i = 0; i < 600; i++) top = { ...step(top, 'up', MATCH.subStep).match, phase: 'play', ball: m.ball };
    expect(top.player).toBe(half);
    let bottom = m;
    for (let i = 0; i < 600; i++) bottom = { ...step(bottom, 'down', MATCH.subStep).match, phase: 'play', ball: m.ball };
    expect(bottom.player).toBe(MATCH.field.h - half);
  });

  it('never moves the AI\'s paddle faster than its top speed', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      let r = newMatch({ seed });
      for (let i = 0; i < 120 * 30 && r.phase !== 'over'; i++) {
        const next = step(r, reader(r), MATCH.subStep).match;
        expect(Math.abs(next.ai - r.ai)).toBeLessThanOrEqual(MATCH.ai.speed * MATCH.subStep + 1e-9);
        r = next;
      }
    }
  });

  it('follows the ball with its delay: it heads for where the ball was, not where it is', () => {
    const lag = Math.round(MATCH.ai.delay / MATCH.subStep);
    let m: Match = { ...served(5), ai: 144 };
    // The ball jumps to the top: for the delay, the AI still sees it where it was.
    m = { ...m, ball: { x: 160, y: 20, vx: 50, vy: 0 } };
    for (let i = 0; i < lag - 1; i++) {
      m = { ...step(m, 'still', MATCH.subStep).match, ball: { x: 160, y: 20, vx: 50, vy: 0 } };
    }
    expect(m.ai).toBe(144);
    m = step(m, 'still', MATCH.subStep).match;
    expect(m.ai).toBeLessThan(144);
  });
});

describe('the points', () => {
  it('adds one point when the AI misses, and serves toward the AI after one second', () => {
    const m = served(5);
    const s = step({ ...m, ai: 30, ball: { x: MATCH.field.w + 2, y: 260, vx: 300, vy: 0 } }, 'still', MATCH.subStep);
    expect(s.events).toEqual(['point']);
    expect(s.match).toMatchObject({ score: 1, lives: 3, phase: 'serve', toward: 'ai' });
    expect(s.match.ball).toMatchObject({ x: MATCH.field.w / 2, y: MATCH.field.h / 2, vx: 0, vy: 0 });
    let r = s.match;
    for (let i = 0; i < Math.round(MATCH.serveSeconds / MATCH.subStep); i++) r = step(r, 'still', MATCH.subStep).match;
    expect(r.phase).toBe('play');
    expect(r.ball.vx).toBeGreaterThan(0);
    expect(Math.hypot(r.ball.vx, r.ball.vy)).toBeCloseTo(MATCH.serveSpeed, 6);
  });

  it('costs a life and never changes the score when the player concedes, and serves toward the player', () => {
    const m = { ...served(5), score: 4 };
    const s = step({ ...m, player: 30, ball: { x: -2, y: 260, vx: -300, vy: 0 } }, 'still', MATCH.subStep);
    expect(s.events).toEqual(['conceded']);
    expect(s.match).toMatchObject({ score: 4, lives: 2, phase: 'serve', toward: 'player' });
    let r = s.match;
    for (let i = 0; i < Math.round(MATCH.serveSeconds / MATCH.subStep); i++) r = step(r, 'still', MATCH.subStep).match;
    expect(r.ball.vx).toBeLessThan(0);
  });

  it('ends the match at the third point conceded, the score kept, and moves no more', () => {
    let m: Match = { ...served(5), score: 6 };
    const events: MatchEvent[] = [];
    for (let i = 0; i < 3; i++) {
      while (m.phase === 'serve') m = step(m, 'still', MATCH.subStep).match;
      const s = step({ ...m, player: 30, ball: { x: -2, y: 260, vx: -300, vy: 0 } }, 'still', MATCH.subStep);
      events.push(...s.events);
      m = s.match;
    }
    expect(events).toEqual(['conceded', 'conceded', 'conceded', 'over']);
    expect(m).toMatchObject({ phase: 'over', lives: 0, score: 6 });
    const after = step(m, 'up', 0.05);
    expect(after.match).toBe(m);
    expect(after.events).toEqual([]);
  });

  it('a played-out match ends at its third concession with the points the AI missed', () => {
    const { match, events } = play(11, readerMissing(new Set([2, 4, 6])), 600);
    expect(match.phase).toBe('over');
    expect(events.filter((e) => e === 'conceded')).toHaveLength(3);
    expect(events.filter((e) => e === 'over')).toHaveLength(1);
    expect(match.score).toBe(events.filter((e) => e === 'point').length);
  });
});

describe('the end of a match', () => {
  it('quits into over once, the score kept, and never twice', () => {
    const m = { ...served(5), score: 3 };
    const quit = end(m);
    expect(quit.events).toEqual(['over']);
    expect(quit.match).toMatchObject({ phase: 'over', score: 3 });
    const again = end(quit.match);
    expect(again.events).toEqual([]);
    expect(again.match).toBe(quit.match);
  });

  it('tells over once whichever route led there: the third concession then a quit says it once', () => {
    const { match, events } = play(11, readerMissing(new Set([1, 2, 3])), 600);
    expect(events.filter((e) => e === 'over')).toHaveLength(1);
    expect(end(match).events).toEqual([]);
  });
});

describe('no death earns a point', () => {
  for (const rally of [1, 3, 5, 9]) {
    it(`for 200 seeds, conceding from the ${String(rally)}th ball on never ends higher than the same steering without the miss`, () => {
      for (const seed of SEEDS) {
        const without = play(seed, reader, 120).match;
        const withMiss = play(seed, readerMissing(new Set([rally, rally + 1, rally + 2])), 120).match;
        expect(withMiss.phase).toBe('over');
        expect(withMiss.score).toBeLessThanOrEqual(without.score);
      }
    });
  }

  it('a point conceded leaves the score as it was, at every concession of 200 matches', () => {
    for (const seed of SEEDS) {
      let m = newMatch({ seed });
      const policy = readerMissing(new Set([2, 4, 6]));
      let approach = 0, coming = false;
      for (let i = 0; i < 120 * 600 && m.phase !== 'over'; i++) {
        const nowComing = m.phase === 'play' && m.ball.vx < 0;
        if (nowComing && !coming) approach++;
        coming = nowComing;
        const s = step(m, policy(m, approach), MATCH.subStep);
        if (s.events.includes('conceded')) expect(s.match.score).toBe(m.score);
        m = s.match;
      }
      expect(m.phase).toBe('over');
    }
  });
});

describe('the AI misses', () => {
  it('for 200 seeds, with a player that returns every ball, the AI misses before the ball reaches its cap', () => {
    for (const seed of SEEDS) {
      const { events, speeds } = play(seed, reader, 120);
      expect(events).not.toContain('conceded');
      expect(speeds.length).toBeGreaterThan(0);
      expect(speeds[0]).toBeLessThan(MATCH.maxSpeed);
    }
  });
});

describe('determinism', () => {
  /** Steering that changes on a clock, never on the frame rate: up, still, down, still, every 0.4 s. */
  const clock = (t: number): Steer => (['up', 'still', 'down', 'still'] as const)[Math.floor(t / 0.4 + 1e-9) % 4] ?? 'still';

  function timed(seed: number, dt: number, seconds: number): Match {
    let m = newMatch({ seed });
    const frames = Math.round(seconds / dt);
    for (let i = 0; i < frames; i++) m = step(m, clock(i * dt), dt).match;
    return m;
  }

  it('the same seed and steering give the same match', () => {
    expect(timed(42, 1 / 60, 60)).toEqual(timed(42, 1 / 60, 60));
    expect(play(42, reader, 60).match).toEqual(play(42, reader, 60).match);
    expect(timed(42, 1 / 60, 20)).not.toEqual(timed(43, 1 / 60, 20));
  });

  it('the same steering stepped at 1/60 s and at 1/120 s gives the same match and score', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const at60 = timed(seed, 1 / 60, 90);
      const at120 = timed(seed, 1 / 120, 90);
      expect(at120.score).toBe(at60.score);
      expect(at120.lives).toBe(at60.lives);
      expect(at120.phase).toBe(at60.phase);
      expect(at120.ball.x).toBeCloseTo(at60.ball.x, 6);
      expect(at120.ball.y).toBeCloseTo(at60.ball.y, 6);
      expect(at120.player).toBeCloseTo(at60.player, 6);
      expect(at120.ai).toBeCloseTo(at60.ai, 6);
    }
  });

  it('plays a long frame as whole sub-steps, no more than the longest frame at once', () => {
    const m = served(5);
    const s = step(m, 'down', 10);
    expect(s.match.player).toBeCloseTo(m.player + MATCH.playerSpeed * Math.round(MATCH.maxDt / MATCH.subStep) * MATCH.subStep, 6);
  });
});
