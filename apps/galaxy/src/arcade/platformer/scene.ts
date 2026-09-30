// Super Omni World's Phaser scene (PRD 817): the stage as a tilemap, the hero in the arcade
// physics, the camera following to the right, the Entropy blobs walking, the coins to take and the
// ? blocks to bump. It only plays: the arcade's held buttons come in each frame (`held`), and what
// happens goes out as events (`onEvent`: a coin, a stomp, a hurt, a pit, the flag, and each second
// of the stage's clock), for the rules and the text layer to answer. A life lost (a hurt, a pit, the
// clock run out) starts the stage again from its start. Phaser reaches this file only as the
// module PlatformerScreen imported on demand: the types below are erased, and nothing here imports
// Phaser at run time.
import type Phaser from 'phaser';
import type { Action } from '../keys';
import type { Art, Pose } from './art';
import { BLOCK, EMPTY_BLOCK, tileData } from './art';
import { blockBumped, clockSeconds, enemyContact, enemyTurn, enemyWakes, heroAtFlag, heroFell } from './contact';
import { heroSpeed, JUMP_IDLE, jumpStep, LIFE_EVENTS, PHYSICS, STAGE_SECONDS, TILE, type JumpState, type PlatformerEvent } from './rules';
import type { Stage } from './stages';

export type PhaserModule = typeof import('phaser');

export interface SceneOptions {
  stage: Stage;
  art: Art;
  /** The buttons held now, read once a frame. */
  held: () => ReadonlySet<Action>;
  onEvent: (e: PlatformerEvent) => void;
}

// How fast the stride turns over: faster at a run.
const STRIDE = { walk: 8, run: 13 };
// The longest frame the physics plays in one go: a stalled tab never throws the hero through a wall.
const MAX_DT = 1 / 20;

type Body = Phaser.Physics.Arcade.Body;
type Sprite = Phaser.Physics.Arcade.Sprite;

/** The scene class for one stage, made from the Phaser module the screen loaded. */
export function makeScene(P: PhaserModule, o: SceneOptions): typeof Phaser.Scene {
  const { stage, art } = o;
  const width = stage.cols * TILE, height = stage.rows * TILE;
  const [start] = stage.starts;
  const [flag] = stage.flags;
  const startX = start.col * TILE + TILE / 2, startY = (start.row + 1) * TILE - PHYSICS.heroH / 2 - 4;
  const flagX = flag.col * TILE + TILE / 2;

  return class PlatformerScene extends P.Scene {
    hero!: Sprite;
    layer!: Phaser.Tilemaps.TilemapLayer;
    enemies!: Phaser.Physics.Arcade.Group;
    jump: JumpState = JUMP_IDLE;
    facing = 1;
    /** Seconds of play on this try at the stage. */
    t = 0;
    /** The clock's seconds told so far on this try. */
    told = 0;
    done = false;
    skyTop = 0;

    constructor() { super({ key: `stage-${stage.id}` }); }

    /** Each try at the stage starts afresh: Phaser runs this on the first start and on every restart. */
    init() {
      this.jump = JUMP_IDLE;
      this.facing = 1;
      this.t = 0;
      this.told = 0;
      this.done = false;
    }

    create() {
      const tex = this.textures;
      const add = (key: string, c: HTMLCanvasElement) => { if (!tex.exists(key)) tex.addCanvas(key, c); };
      add('tiles', art.tiles);
      for (const [pose, c] of Object.entries(art.hero)) add(`hero-${pose}`, c);
      art.flag.forEach((c, i) => add(`flag-${i}`, c));
      art.coin.forEach((c, i) => add(`coin-${i}`, c));
      art.enemy.forEach((c, i) => add(`enemy-${i}`, c));

      const map = this.make.tilemap({ data: tileData(stage), tileWidth: TILE, tileHeight: TILE });
      const tileset = map.addTilesetImage('tiles', 'tiles', TILE, TILE)!;
      const layer = map.createLayer(0, tileset, 0, 0) as Phaser.Tilemaps.TilemapLayer;
      layer.setCollisionByExclusion([-1]);
      this.layer = layer;

      // The flag: a pole eight tiles tall down to its foot, the flag at its top.
      const top = Math.max(0, flag.row - 7) * TILE;
      this.add.rectangle(flagX, top, 2, (flag.row + 1) * TILE - top, 0xd8dcf0).setOrigin(0.5, 0);
      this.add.image(flagX + 7, top + 8, 'flag-0');

      // The world ends at the stage's sides; its floor is open, so a pit is a fall.
      this.physics.world.setBounds(0, 0, width, height + 4 * TILE, true, true, true, false);
      this.hero = this.physics.add.sprite(startX, startY, 'hero-stand');
      const body = this.hero.body as Body;
      body.setSize(PHYSICS.heroW, PHYSICS.heroH).setOffset((32 - PHYSICS.heroW) / 2, 48 - PHYSICS.heroH);
      body.setMaxVelocity(PHYSICS.run, PHYSICS.maxFall);
      this.hero.setCollideWorldBounds(true);
      this.physics.add.collider(this.hero, layer, (_hero, tile) => this.bump(tile as Phaser.Tilemaps.Tile));

      // The coins lying in the stage, each in the middle of its tile.
      const coins = this.physics.add.staticGroup();
      for (const c of stage.coins) coins.create(c.col * TILE + TILE / 2, c.row * TILE + TILE / 2, 'coin-0');
      this.physics.add.overlap(this.hero, coins, (_hero, coin) => {
        if (this.done) return;
        (coin as Sprite).destroy();
        this.emit('coin');
      });

      // The blobs, standing on their tiles' floor, asleep until the screen comes near them.
      this.enemies = this.physics.add.group({ collideWorldBounds: true });
      for (const e of stage.enemies) {
        const blob = this.enemies.create(e.col * TILE + TILE / 2, (e.row + 1) * TILE - 12, 'enemy-0') as Sprite;
        const b = blob.body as Body;
        b.setSize(PHYSICS.enemyW, PHYSICS.enemyH).setOffset((24 - PHYSICS.enemyW) / 2, 24 - PHYSICS.enemyH);
        b.enable = false;
        blob.setData('dir', -1);
      }
      this.physics.add.collider(this.enemies, layer);
      this.physics.add.overlap(this.hero, this.enemies, (_hero, blob) => this.touch(blob as Sprite));

      // The stage stands on the screen's floor: on the wide grid, taller than the stage, the sky
      // goes on above it.
      const cam = this.cameras.main;
      this.skyTop = Math.min(0, height - cam.height);
      cam.setBounds(0, this.skyTop, width, height - this.skyTop).setBackgroundColor(art.sky);
      cam.setScroll(0, this.skyTop);
    }

    /** Tells the rules what happened; a life lost starts the stage again. */
    emit(e: PlatformerEvent) {
      o.onEvent(e);
      if (LIFE_EVENTS.has(e)) this.again();
    }

    /** Starts the stage again from its start, its blocks, coins and blobs as they were. */
    again() {
      this.done = true;
      this.scene.restart();
    }

    /** A tile the hero collided with: a ? block hit from below gives its coin and turns empty. */
    bump(tile: Phaser.Tilemaps.Tile) {
      if (this.done || tile.index !== BLOCK || !blockBumped(this.hero.body as Body, tile)) return;
      tile.index = EMPTY_BLOCK;
      const coin = this.add.image(tile.pixelX + TILE / 2, tile.pixelY - TILE / 2, 'coin-0');
      this.tweens.add({ targets: coin, y: coin.y - 20, alpha: 0, duration: 350, onComplete: () => coin.destroy() });
      this.emit('coin');
    }

    /** The hero touching a blob: a stomp from above kills it and bounces the hero; any other touch hurts. */
    touch(blob: Sprite) {
      if (this.done || !blob.active) return;
      const hero = this.hero.body as Body;
      if (enemyContact(hero, blob.body as Body) === 'hurt') return this.emit('hurt');
      blob.disableBody(true, true);
      hero.setVelocityY(-PHYSICS.bounce);
      this.jump = { ...this.jump, holding: false };
      this.emit('stomp');
    }

    update(_time: number, delta: number) {
      if (this.done) return;
      const dt = Math.min(delta / 1000, MAX_DT);
      const before = this.t;
      this.t += dt;
      for (let n = clockSeconds(before, this.t); n > 0; n -= 1) {
        this.told += 1;
        o.onEvent('second');
        if (this.told >= STAGE_SECONDS) return this.again();
      }
      const held = o.held();
      const body = this.hero.body as Body;
      const onGround = body.blocked.down;

      let vx = heroSpeed(held);
      // The camera never scrolls back: the screen's left edge is a wall.
      const cam = this.cameras.main;
      if (this.hero.x - PHYSICS.heroW / 2 <= cam.scrollX && vx < 0) vx = 0;
      body.setVelocityX(vx);

      const step = jumpStep(this.jump, { a: held.has('a'), onGround }, dt);
      this.jump = body.blocked.up ? { ...step.state, holding: false } : step.state;
      if (step.vy !== null && !body.blocked.up) body.setVelocityY(step.vy);

      if (vx) this.facing = Math.sign(vx);
      const rate = Math.abs(vx) > PHYSICS.walk ? STRIDE.run : STRIDE.walk;
      const pose: Pose = !onGround ? 'jump' : vx ? (Math.floor(this.t * rate) % 2 ? 'run1' : 'run0') : 'stand';
      this.hero.setTexture(`hero-${pose}`).setFlipX(this.facing < 0);

      // The camera follows to the right only.
      const target = Math.min(width - cam.width, this.hero.x - cam.width / 2);
      if (target > cam.scrollX) cam.setScroll(Math.round(target), this.skyTop);

      this.walkEnemies(cam.scrollX + cam.width);

      if (heroFell(this.hero.y - PHYSICS.heroH / 2, height)) {
        this.emit('pit');
      } else if (heroAtFlag(this.hero.x, flagX)) {
        this.done = true;
        body.setVelocity(0, 0);
        this.physics.pause();
        this.hero.setTexture('hero-stand');
        o.onEvent('flag');
      }
    }

    /** Wakes the blobs the screen nears, turns them at walls and ledges, and drops the fallen. */
    walkEnemies(cameraRight: number) {
      const frame = Math.floor(this.t * 4) % 2;
      for (const blob of this.enemies.getChildren() as Sprite[]) {
        if (!blob.active) continue;
        const b = blob.body as Body;
        if (!b.enable) {
          if (!enemyWakes(blob.x, cameraRight)) continue;
          b.enable = true;
        }
        if (blob.y > height + 2 * TILE) { blob.destroy(); continue; }
        let dir = blob.getData('dir') as 1 | -1;
        if (b.blocked.down) {
          const ahead = this.layer.getTileAtWorldXY(blob.x + dir * (PHYSICS.enemyW / 2 + 1), b.bottom + 1);
          dir = enemyTurn(dir, { left: b.blocked.left, right: b.blocked.right, groundAhead: Boolean(ahead?.collides) });
          blob.setData('dir', dir);
        }
        b.setVelocityX(dir * PHYSICS.enemy);
        blob.setTexture(`enemy-${frame}`).setFlipX(dir > 0);
      }
    }
  };
}
