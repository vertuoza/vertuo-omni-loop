// What Super Omni World draws with (PRD 817): the stage's tiles from @omni/design in its palette,
// laid out as one strip Phaser reads as a tileset, and the player's own hero in three poses. The
// canvases are made here, in the browser, and handed to the scene; `tileFrame` says which tile of
// the strip each cell of a stage wears.
import { heroLook, heroPose, spriteImage, STAGE_PALETTES, TILES, type Hero, type Tint } from '@omni/design';
import { crewLook } from '../fleets';
import type { Stage } from './stages';

/** The sky behind each palette's stage. */
export const SKY: Readonly<Record<string, string>> = Object.freeze({ grass: '#6f9cff' });

/** The hero's poses in the game: standing, the two strides of the run, and the jump. */
export type Pose = 'stand' | 'run0' | 'run1' | 'jump';

export interface Art {
  /** The tiles, side by side in TILES order, 16px each. */
  tiles: HTMLCanvasElement;
  hero: Record<Pose, HTMLCanvasElement>;
  /** The flag at the top of the pole, its two frames. */
  flag: [HTMLCanvasElement, HTMLCanvasElement];
  /** A coin, its face and its edge: it turns as it waits to be taken. */
  coin: [HTMLCanvasElement, HTMLCanvasElement];
  /** The Entropy blob, its two frames of walking. */
  enemy: [HTMLCanvasElement, HTMLCanvasElement];
  sky: string;
}

const at = (name: string) => TILES.indexOf(name);

/**
 * The tile of the strip (its index in TILES) the cell at `row`, `col` wears; -1 for a cell with
 * none. Ground under open sky grows grass, ground under ground is soil, and a pipe wears its rim on
 * its top tile and its left or right half by where it stands in its run of pipe columns.
 */
export function tileFrame(stage: Stage, row: number, col: number): number {
  const t = stage.tiles[row]?.[col];
  const above = stage.tiles[row - 1]?.[col];
  switch (t) {
    case 'ground': return at(above === 'ground' ? 'tile-soil' : 'tile-ground');
    case 'brick': return at('tile-brick');
    case 'block': return at('tile-block');
    case 'stone': return at('tile-brick'); // castle stone arrives with its own tile and palette
    case 'pipe': {
      let first = col;
      while (stage.tiles[row][first - 1] === 'pipe') first -= 1;
      const side = (col - first) % 2 ? 'r' : 'l';
      return at(above === 'pipe' ? `tile-pipe-${side}` : `tile-pipe-top-${side}`);
    }
    default: return -1;
  }
}

/** The ? block once its coin is taken: the tile it turns into. */
export const EMPTY_BLOCK = at('tile-block-empty');
/** The ? block still holding its coin. */
export const BLOCK = at('tile-block');

/** The whole stage as tile indexes, row by row: what Phaser's tilemap is made from. */
export const tileData = (stage: Stage): number[][] => stage.tiles.map((line, row) => line.map((_, col) => tileFrame(stage, row, col)));

function canvas(w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  paint(ctx);
  return c;
}

const sprite = (name: string, tint: Tint | null, frame = 0) => {
  const img = spriteImage(name, { tint, frame });
  return canvas(img.width, img.height, (ctx) => ctx.drawImage(img, 0, 0));
};

/** Draws the art for a stage's palette and the player's hero, in their fleet's colour. Browser only. */
export function drawArt(hero: Hero, team: string | null, palette: string): Art {
  const tint = STAGE_PALETTES[palette] ?? STAGE_PALETTES.grass;
  const tiles = canvas(16 * TILES.length, 16, (ctx) => TILES.forEach((name, i) => ctx.drawImage(spriteImage(name, { tint }), i * 16, 0)));
  const color = crewLook(team).color;
  const look = heroLook(hero, color);
  const run = heroPose(hero, 'omni-run', color);
  const jump = heroPose(hero, 'omni-cheer', color);
  return {
    tiles,
    hero: {
      stand: sprite(look.sprite, look.tint),
      run0: sprite(run.sprite, run.tint, 0),
      run1: sprite(run.sprite, run.tint, 1),
      jump: sprite(jump.sprite, jump.tint),
    },
    flag: [sprite('flag', null, 0), sprite('flag', null, 1)],
    coin: [sprite('coin', null, 0), sprite('coin', null, 1)],
    enemy: [sprite('entropy', null, 0), sprite('entropy', null, 1)],
    sky: SKY[palette] ?? SKY.grass,
  };
}
