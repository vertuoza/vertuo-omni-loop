import { describe, expect, expectTypeOf, it } from 'vitest';
import { phaserNarrow, type PhaserClasses } from './phaser-narrow';
import type { PhaserModule } from './platformer/scene';

// Stand-ins for the four Phaser classes: the checks read nothing but the class an object was made from.
class Body { readonly made = 'body'; }
class Sprite { readonly made = 'sprite'; }
class Tile { readonly made = 'tile'; }
class TilemapLayer { readonly made = 'layer'; }
class Other { readonly made = 'other'; }

const P = { Physics: { Arcade: { Body, Sprite } }, Tilemaps: { Tile, TilemapLayer } } as unknown as PhaserClasses;
const { bodyOf, spriteOf, tileOf, layerOf } = phaserNarrow(P);

describe('phaserNarrow', () => {
  it('is made from the Phaser module the scene is made from', () => {
    expectTypeOf<PhaserModule>().toExtend<PhaserClasses>();
  });

  it("bodyOf answers a game object's arcade body, and throws on any other body or none", () => {
    const body = new Body();
    expect(bodyOf({ body })).toBe(body);
    expect(() => bodyOf({ body: new Other() })).toThrow('phaser-narrow: expected an arcade body, got an Other');
    expect(() => bodyOf({ body: null })).toThrow('phaser-narrow: expected an arcade body, got null');
  });

  it('spriteOf answers an arcade sprite, and throws on anything else', () => {
    const sprite = new Sprite();
    expect(spriteOf(sprite)).toBe(sprite);
    expect(() => spriteOf(new Tile())).toThrow('phaser-narrow: expected an arcade sprite, got a Tile');
    expect(() => spriteOf(undefined)).toThrow('phaser-narrow: expected an arcade sprite, got undefined');
  });

  it('tileOf answers a tile, and throws on anything else', () => {
    const tile = new Tile();
    expect(tileOf(tile)).toBe(tile);
    expect(() => tileOf(new Sprite())).toThrow('phaser-narrow: expected a tile, got a Sprite');
  });

  it('layerOf answers a tilemap layer, and throws on null or anything else', () => {
    const layer = new TilemapLayer();
    expect(layerOf(layer)).toBe(layer);
    expect(() => layerOf(null)).toThrow('phaser-narrow: expected a tilemap layer, got null');
    expect(() => layerOf({})).toThrow('phaser-narrow: expected a tilemap layer, got an Object');
    expect(() => layerOf(3)).toThrow('phaser-narrow: expected a tilemap layer, got a number');
  });
});
