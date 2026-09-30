import { describe, expect, it } from 'vitest';
import { blockBumped, clockSeconds, enemyContact, enemyTurn, enemyWakes, heroFell, heroAtFlag } from './contact';
import { PHYSICS, TILE } from './rules';

// How Super Omni World's scene turns what Phaser's arcade physics reports into the rules' events
// (PRD 817), with Phaser stubbed: the bodies and tiles below are plain objects shaped like the ones
// Phaser hands the scene's collision callbacks, and nothing here loads Phaser.

/** A hero's body as Phaser keeps it: where it is now and where it was a step ago, its speed. */
const hero = (o: { y: number; prevY?: number; vy: number; x?: number }) => ({
  x: o.x ?? 100, y: o.y, width: PHYSICS.heroW, height: PHYSICS.heroH,
  top: o.y, bottom: o.y + PHYSICS.heroH, center: { x: (o.x ?? 100) + PHYSICS.heroW / 2 },
  prev: { y: o.prevY ?? o.y }, velocity: { y: o.vy },
});
/** An enemy's body, 20 wide, standing with its top at `top`. */
const enemy = (top: number) => ({ top });
/** A tile of the stage layer, at column `col` and row `row`. */
const tile = (col: number, row: number) => ({ pixelX: col * TILE, pixelY: row * TILE, width: TILE, height: TILE });

describe('touching an enemy', () => {
  it('is a stomp when the hero comes down on it from above', () => {
    // Its feet were over the blob's head a step ago, and it is falling.
    expect(enemyContact(hero({ y: 160 - PHYSICS.heroH + 3, prevY: 160 - PHYSICS.heroH - 2, vy: 200 }), enemy(160))).toBe('stomp');
  });

  it('is a hurt when the hero walks into it from the side', () => {
    expect(enemyContact(hero({ y: 150, vy: 0 }), enemy(160))).toBe('hurt');
  });

  it('is a hurt when the hero jumps up into it from below', () => {
    expect(enemyContact(hero({ y: 180, prevY: 184, vy: -300 }), enemy(160))).toBe('hurt');
  });

  it('is a hurt when the hero falls onto it with its feet already below the blob\'s head', () => {
    expect(enemyContact(hero({ y: 160 - PHYSICS.heroH + 14, prevY: 160 - PHYSICS.heroH + 10, vy: 200 }), enemy(160))).toBe('hurt');
  });
});

describe('bumping a tile', () => {
  it('hits a ? block from below: the tile sits right over the hero\'s head, over its middle', () => {
    const body = hero({ y: 5 * TILE, vy: 0, x: 3 * TILE - 1 });
    expect(blockBumped(body, tile(3, 4))).toBe(true);
  });

  it('does not hit a block beside the hero\'s head, or one its middle is not under', () => {
    const body = hero({ y: 5 * TILE, vy: 0, x: 3 * TILE - 1 });
    expect(blockBumped(body, tile(2, 5))).toBe(false); // a wall at its side
    expect(blockBumped(body, tile(5, 4))).toBe(false); // over its shoulder, two columns on
  });

  it('does not hit the block the hero stands on', () => {
    const body = hero({ y: 5 * TILE - PHYSICS.heroH, vy: 0, x: 3 * TILE - 1 });
    expect(blockBumped(body, tile(3, 5))).toBe(false);
  });
});

describe('the pit and the flag', () => {
  it('reports a pit once the hero\'s head has dropped below the stage', () => {
    expect(heroFell(18 * TILE + 1, 18 * TILE)).toBe(true);
    expect(heroFell(17 * TILE, 18 * TILE)).toBe(false);
  });

  it('reports the flag once the hero reaches its pole', () => {
    expect(heroAtFlag(200, 200)).toBe(true);
    expect(heroAtFlag(199, 200)).toBe(false);
  });
});

describe('enemies', () => {
  it('turn at a wall they walk into', () => {
    expect(enemyTurn(-1, { left: true, right: false, groundAhead: true })).toBe(1);
    expect(enemyTurn(1, { left: false, right: true, groundAhead: true })).toBe(-1);
  });

  it('turn at a ledge rather than walk off it', () => {
    expect(enemyTurn(-1, { left: false, right: false, groundAhead: false })).toBe(1);
    expect(enemyTurn(1, { left: false, right: false, groundAhead: true })).toBe(1);
  });

  it('wake up as they come near the screen\'s right edge, and not before', () => {
    expect(enemyWakes(300, 320)).toBe(true);
    expect(enemyWakes(320 + 2 * TILE, 320)).toBe(true);
    expect(enemyWakes(320 + 2 * TILE + 1, 320)).toBe(false);
  });
});

describe('the clock', () => {
  it('ticks each whole second gone by, however the frames fall', () => {
    expect(clockSeconds(0.4, 0.9)).toBe(0);
    expect(clockSeconds(0.9, 1.05)).toBe(1);
    expect(clockSeconds(2.99, 3)).toBe(1);
  });
});
