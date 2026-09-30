// How Super Omni World's scene reads what Phaser's arcade physics reports (PRD 817): a touch with an
// enemy is a stomp or a hurt, a tile bumped from below may be a ? block, a fall below the stage is a
// pit, and the pole is the flag. Pure: the shapes below are the parts of Phaser's bodies and tiles
// the scene hands in, so a test stubs them and nothing here loads Phaser.
import { TILE } from './rules';

/** How far below an enemy's head the hero's feet may have been a step ago and still stomp it, in px. */
const STOMP_SLACK = 6;
/** How far into the hero's head a tile may reach and still count as over it, in px. */
const HEAD_SLACK = 2;

/** The hero's body as Phaser keeps it: where it is, where it was a step ago, how fast it falls. */
export interface HeroBody {
  top: number;
  height: number;
  center: { x: number };
  prev: { y: number };
  velocity: { y: number };
}

/**
 * A touch with an enemy: a stomp when the hero comes down on it (falling, its feet over the enemy's
 * head a step ago), and a hurt any other way.
 */
export function enemyContact(hero: HeroBody, enemy: { top: number }): 'stomp' | 'hurt' {
  const wasAbove = hero.prev.y + hero.height <= enemy.top + STOMP_SLACK;
  return hero.velocity.y > 0 && wasAbove ? 'stomp' : 'hurt';
}

/**
 * Whether a tile the hero collided with was hit from below: it sits right over the hero's head, and
 * over its middle, so of two blocks side by side only the one under the hero's middle answers.
 */
export function blockBumped(hero: Pick<HeroBody, 'top' | 'center'>, tile: { pixelX: number; pixelY: number; width: number; height: number }): boolean {
  const over = tile.pixelY + tile.height <= hero.top + HEAD_SLACK;
  const under = tile.pixelX <= hero.center.x && hero.center.x < tile.pixelX + tile.width;
  return over && under;
}

/** A pit: the hero's head has dropped below the stage's floor. */
export const heroFell = (heroTop: number, stageHeight: number): boolean => heroTop > stageHeight;

/** The flag: the hero has reached its pole. */
export const heroAtFlag = (heroX: number, flagX: number): boolean => heroX >= flagX;

/**
 * Which way an enemy walks next: back the other way when it walks into a wall, or when the ground
 * ahead of it ends (so it never walks off a ledge); on otherwise.
 */
export function enemyTurn(dir: 1 | -1, o: { left: boolean; right: boolean; groundAhead: boolean }): 1 | -1 {
  if ((dir < 0 && o.left) || (dir > 0 && o.right) || !o.groundAhead) return dir < 0 ? 1 : -1;
  return dir;
}

/** An enemy starts walking once it is within two tiles of the screen's right edge. */
export const enemyWakes = (enemyX: number, cameraRight: number): boolean => enemyX <= cameraRight + 2 * TILE;

/** The whole seconds the clock passed going from `before` to `after`, in seconds of play. */
export const clockSeconds = (before: number, after: number): number => Math.floor(after) - Math.floor(before);
