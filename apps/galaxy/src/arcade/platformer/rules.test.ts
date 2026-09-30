import { describe, expect, it } from 'vitest';
import { heroSpeed, JUMP, JUMP_IDLE, jumpStep, longestPit, PHYSICS, simulateJump, TILE } from './rules';

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
