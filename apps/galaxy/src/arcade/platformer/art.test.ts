import { STAGE_PALETTES, TILES, woundTint } from '@omni/design';
import { describe, expect, it } from 'vitest';
import { enemyTint, SKY, tileData, tileFrame } from './art';
import { STAGES } from './stages';

// What Super Omni World draws each stage with (PRD 817): the tile each cell wears, the sky, and the
// blobs' colour, one look per stage. The canvases themselves are drawn in the browser.

describe('tileFrame', () => {
  it('draws castle stone with its own tile, and every solid cell of every stage with some tile', () => {
    const castle = STAGES.find((s) => s.id === '1-3')!;
    expect(tileFrame(castle, 0, 0)).toBe(TILES.indexOf('tile-stone'));
    for (const stage of STAGES) {
      const data = tileData(stage);
      stage.tiles.forEach((line, row) => line.forEach((t, col) => {
        expect(data[row][col] >= 0, `${stage.id} ${row},${col}`).toBe(t !== 'empty');
      }));
    }
  });
});

describe('each stage\'s look', () => {
  it('has a sky and a palette for every stage', () => {
    for (const stage of STAGES) {
      expect(SKY[stage.palette], stage.id).toMatch(/^#[0-9a-f]{6}$/);
      expect(STAGE_PALETTES[stage.palette], stage.id).toBeDefined();
    }
    expect(new Set(STAGES.map((s) => SKY[s.palette])).size).toBe(STAGES.length);
  });

  it('tints the blobs per stage with a wound kind\'s colours, 1-1 keeping Entropy\'s own', () => {
    expect(enemyTint('grass')).toBeNull();
    expect(enemyTint('underground')).toEqual(woundTint('transmission'));
    expect(enemyTint('castle')).toEqual(woundTint('beacon'));
    expect(enemyTint('unknown')).toBeNull();
  });
});
