// The Phaser checking helpers (PRD 1030): each gives a Phaser object its real type by asking which
// class made it, and throws when the answer is not the one the scene relies on. The engine makes
// the guarantee (physics.add gives the hero an arcade body, the enemies group makes sprites), so the
// helpers never fire in practice; the compiler checks it instead of taking a comment's word.
//
// Phaser reaches the arcade only as the module PlatformerScreen imports on demand (the lazy loading
// guard, play-dock/lazy-phaser.test.ts), so nothing here imports it at run time: the helpers are
// made from the module the scene was made from, `const { bodyOf } = phaserNarrow(P)`.
import type Phaser from 'phaser';

type Body = Phaser.Physics.Arcade.Body;
type Sprite = Phaser.Physics.Arcade.Sprite;
type Tile = Phaser.Tilemaps.Tile;
type Layer = Phaser.Tilemaps.TilemapLayer;

/** A class whose instances are `T`, whatever its constructor takes. */
type ClassOf<T> = abstract new (...args: never[]) => T;

/** The slice of the Phaser module the helpers read: the four classes they test against. */
export interface PhaserClasses {
  Physics: { Arcade: { Body: ClassOf<Body>; Sprite: ClassOf<Sprite> } };
  Tilemaps: { Tile: ClassOf<Tile>; TilemapLayer: ClassOf<Layer> };
}

/** What a value is, for the error: its class's name, or its type; never its contents. */
function kindOf(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return `a ${typeof value}`;
  const name = value.constructor.name || 'object';
  return `${/^[AEIOU]/.test(name) ? 'an' : 'a'} ${name}`;
}

function check<T>(Class: ClassOf<T>, value: unknown, what: string): T {
  if (value instanceof Class) return value;
  throw new Error(`phaser-narrow: expected ${what}, got ${kindOf(value)}`);
}

/** The four checks, against the classes of the Phaser module `P`. */
export function phaserNarrow(P: PhaserClasses) {
  const { Body, Sprite } = P.Physics.Arcade;
  const { Tile, TilemapLayer } = P.Tilemaps;
  return {
    /** A game object's arcade body: physics.add and an arcade group give one to what they make. */
    bodyOf: (gameObject: { readonly body: unknown }): Body => check(Body, gameObject.body, 'an arcade body'),
    /** An arcade sprite: a group's child, or an overlap's other party. */
    spriteOf: (value: unknown): Sprite => check(Sprite, value, 'an arcade sprite'),
    /** A tile: what a collider with a tilemap layer answers. */
    tileOf: (value: unknown): Tile => check(Tile, value, 'a tile'),
    /** A tilemap layer: what createLayer answers for a tileset the scene loaded, never null. */
    layerOf: (value: unknown): Layer => check(TilemapLayer, value, 'a tilemap layer'),
  };
}
