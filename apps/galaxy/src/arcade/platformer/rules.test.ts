import { describe, expect, it } from 'vitest';
import { hearRun, heroSpeed, highestLedge, JUMP, JUMP_IDLE, jumpStep, LIFE_EVENTS, LIVES, longestPit, newRun, nextRun, nextStage, PHYSICS, SCORE, simulateJump, STAGE_SECONDS, TILE, WORLD, type Outcome, type PlatformerEvent, type Run } from './rules';

// Super Omni World's rules without Phaser (PRD 817): the numbers the scene plays by, and the jump
// that grows with how long A is held.

describe('the jump', () => {
  it('goes higher the longer A is held', () => {
    const tap = simulateJump(0).height;
    const short = simulateJump(0.05).height;
    const long = simulateJump(0.1).height;
    expect(tap).toBeGreaterThan(TILE);
    expect(short).toBeGreaterThan(tap);
    expect(long).toBeGreaterThan(short);
  });

  it('stops growing at the cap, however long A stays held', () => {
    const capped = simulateJump(JUMP.holdMax).height;
    expect(simulateJump(JUMP.holdMax * 3).height).toBeCloseTo(capped, 5);
    expect(simulateJump(5).height).toBeCloseTo(capped, 5);
    expect(capped).toBeGreaterThan(simulateJump(JUMP.holdMax / 2).height);
  });

  it('clears the hero\'s own height at full hold, and stays under the screen', () => {
    const top = simulateJump(JUMP.holdMax).height;
    expect(top).toBeGreaterThan(PHYSICS.heroH);
    expect(top).toBeLessThan(TILE * 8);
  });

  it('lands on a ledge five tiles over the ground, where the stages put their bricks and ? blocks', () => {
    expect(highestLedge()).toBeGreaterThanOrEqual(5);
  });

  it('starts only from the ground, on a fresh press of A', () => {
    const ground = { a: true, onGround: true };
    const up = jumpStep(JUMP_IDLE, ground, 1 / 60);
    expect(up.vy).toBe(-JUMP.speed);
    // A still held on landing does not jump again: it takes a new press.
    const landed = jumpStep({ ...up.state, holding: false }, ground, 1 / 60);
    expect(landed.vy).toBeNull();
  });

  it('never starts in mid-air, however A is pressed', () => {
    const released = jumpStep(JUMP_IDLE, { a: false, onGround: false }, 1 / 60);
    const pressed = jumpStep(released.state, { a: true, onGround: false }, 1 / 60);
    expect(pressed.vy).toBeNull();
    expect(pressed.state.holding).toBe(false);
  });

  it('ends the hold once A is let go: pressing it again in the air does not lift the hero', () => {
    let s = jumpStep(JUMP_IDLE, { a: true, onGround: true }, 1 / 60).state;
    s = jumpStep(s, { a: false, onGround: false }, 1 / 60).state;
    const again = jumpStep(s, { a: true, onGround: false }, 1 / 60);
    expect(again.vy).toBeNull();
  });
});

describe('running', () => {
  it('walks with ◀ or ▶, runs with B held, and stands still with neither or both', () => {
    expect(heroSpeed(new Set(['right']))).toBe(PHYSICS.walk);
    expect(heroSpeed(new Set(['left']))).toBe(-PHYSICS.walk);
    expect(heroSpeed(new Set(['right', 'b']))).toBe(PHYSICS.run);
    expect(heroSpeed(new Set(['left', 'b']))).toBe(-PHYSICS.run);
    expect(heroSpeed(new Set(['b']))).toBe(0);
    expect(heroSpeed(new Set(['left', 'right']))).toBe(0);
    expect(PHYSICS.run).toBeGreaterThan(PHYSICS.walk);
  });

  it('clears a pit a few tiles wide at a run, and no more than the run-jump reaches', () => {
    const pit = longestPit();
    expect(pit).toBeGreaterThanOrEqual(3);
    const { airtime } = simulateJump(JUMP.holdMax);
    expect((pit * TILE + PHYSICS.heroW)).toBeLessThanOrEqual(PHYSICS.run * airtime);
  });
});

describe('the score', () => {
  it('adds 10 for a coin and counts it, and 50 for a stomp', () => {
    const coin = hearRun(newRun(), 'coin');
    expect(coin).toEqual({ run: { ...newRun(), score: 10, coins: 1 }, outcome: 'play' });
    const stomp = hearRun(coin.run, 'stomp');
    expect(stomp).toEqual({ run: { ...coin.run, score: 60 }, outcome: 'play' });
    expect(SCORE).toEqual({ coin: 10, stomp: 50, perSecond: 10 });
  });

  it('adds 10 per second left at the flag, and clears the stage', () => {
    let run = { ...newRun(), score: 60 };
    for (let i = 0; i < 100; i += 1) run = hearRun(run, 'second').run;
    expect(run.time).toBe(STAGE_SECONDS - 100);
    expect(hearRun(run, 'flag')).toEqual({ run: { ...run, score: 60 + 10 * 200 }, outcome: 'clear' });
  });
});

describe('lives', () => {
  it('starts a game on 1-1 with 3 lives, 300 seconds, and nothing scored', () => {
    expect(newRun()).toEqual({ stage: '1-1', score: 0, coins: 0, lives: 3, time: 300 });
    expect(LIVES).toBe(3);
    expect(STAGE_SECONDS).toBe(300);
  });

  it.each(['hurt', 'pit'] as const)('loses one to a %s, restarting the current stage with the score and coins kept', (e) => {
    const run = { ...newRun(), score: 120, coins: 3, time: 42 };
    expect(hearRun(run, e)).toEqual({ run: { ...run, lives: 2, time: STAGE_SECONDS }, outcome: 'life' });
    expect(LIFE_EVENTS.has(e)).toBe(true);
  });

  it('loses one when the timer reaches 0', () => {
    const run = { ...newRun(), score: 70, time: 2 };
    const one = hearRun(run, 'second');
    expect(one).toEqual({ run: { ...run, time: 1 }, outcome: 'play' });
    expect(hearRun(one.run, 'second')).toEqual({ run: { ...run, lives: 2, time: STAGE_SECONDS }, outcome: 'life' });
  });

  it('ends the game when the last one is lost, the score kept', () => {
    let run = { ...newRun(), score: 500 };
    const outcomes: string[] = [];
    for (const e of ['hurt', 'pit', 'hurt'] as const) { const r = hearRun(run, e); run = r.run; outcomes.push(r.outcome); }
    expect(outcomes).toEqual(['life', 'life', 'over']);
    expect(run).toMatchObject({ lives: 0, score: 500 });
  });

  it('costs nothing for a coin, a stomp, a second or the flag', () => {
    for (const e of ['coin', 'stomp', 'second', 'flag'] as const) expect(LIFE_EVENTS.has(e), e).toBe(false);
  });
});

describe('the world', () => {
  it('is three stages, played in order: 1-1, 1-2, then 1-3', () => {
    expect(WORLD).toEqual(['1-1', '1-2', '1-3']);
    expect(nextStage('1-1')).toBe('1-2');
    expect(nextStage('1-2')).toBe('1-3');
    expect(nextStage('1-3')).toBeNull();
    expect(nextStage('9-9')).toBeNull();
  });

  it('moves on to the next stage with the score, the coins and the lives kept, and a full clock', () => {
    const run: Run = { stage: '1-1', score: 2100, coins: 4, lives: 2, time: 87 };
    expect(nextRun(run)).toEqual({ stage: '1-2', score: 2100, coins: 4, lives: 2, time: STAGE_SECONDS });
    expect(nextRun({ ...run, stage: '1-3' })).toEqual({ ...run, stage: '1-3' });
  });

  it('plays the three stages in order to WORLD CLEAR, each flag paying its time bonus', () => {
    let run = newRun();
    const seen: [string, Outcome][] = [];
    const hear = (e: PlatformerEvent) => { const r = hearRun(run, e); run = r.run; return r.outcome; };
    for (const stage of WORLD) {
      expect(run.stage).toBe(stage);
      hear('coin');
      for (let i = 0; i < 100; i += 1) hear('second');
      const outcome = hear('flag');
      seen.push([stage, outcome]);
      if (outcome === 'clear') run = nextRun(run);
    }
    expect(seen).toEqual([['1-1', 'clear'], ['1-2', 'clear'], ['1-3', 'world']]);
    expect(run).toEqual({ stage: '1-3', score: 3 * (10 + 10 * 200), coins: 3, lives: 3, time: 200 });
  });

  it('can end in a game over on any stage, the score kept', () => {
    let run: Run = { ...nextRun(nextRun(newRun())), lives: 1, score: 900 };
    const r = hearRun(run, 'pit');
    run = r.run;
    expect(r.outcome).toBe('over');
    expect(run).toMatchObject({ stage: '1-3', lives: 0, score: 900 });
  });
});
