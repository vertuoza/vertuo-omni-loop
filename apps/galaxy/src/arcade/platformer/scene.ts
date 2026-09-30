// Super Omni World's Phaser scene (PRD 817): the stage as a tilemap, the hero in the arcade
// physics, the camera following to the right. It only plays: the arcade's held buttons come in each
// frame (`held`), and what happens goes out as events (`onEvent`), for the rules and the text layer
// to answer. Phaser reaches this file only as the module PlatformerScreen imported on demand: the
// types below are erased, and nothing here imports Phaser at run time.
import type Phaser from 'phaser';
import type { Action } from '../keys';
import type { Art, Pose } from './art';
import { tileData } from './art';
import { heroSpeed, JUMP_IDLE, jumpStep, PHYSICS, TILE, type JumpState, type PlatformerEvent } from './rules';
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

/** The scene class for one stage, made from the Phaser module the screen loaded. */
export function makeScene(P: PhaserModule, o: SceneOptions): typeof Phaser.Scene {
  const { stage, art } = o;
  const width = stage.cols * TILE, height = stage.rows * TILE;
  const [start] = stage.starts;
  const [flag] = stage.flags;
  const startX = start.col * TILE + TILE / 2, startY = (start.row + 1) * TILE - PHYSICS.heroH / 2 - 4;
  const flagX = flag.col * TILE + TILE / 2;

  return class PlatformerScene extends P.Scene {
    hero!: Phaser.Physics.Arcade.Sprite;
    jump: JumpState = JUMP_IDLE;
    facing = 1;
    t = 0;
    done = false;

    constructor() { super({ key: `stage-${stage.id}` }); }

    create() {
      const tex = this.textures;
      tex.addCanvas('tiles', art.tiles);
      for (const [pose, c] of Object.entries(art.hero)) tex.addCanvas(`hero-${pose}`, c);
      art.flag.forEach((c, i) => tex.addCanvas(`flag-${i}`, c));

      const map = this.make.tilemap({ data: tileData(stage), tileWidth: TILE, tileHeight: TILE });
      const tileset = map.addTilesetImage('tiles', 'tiles', TILE, TILE)!;
      const layer = map.createLayer(0, tileset, 0, 0) as Phaser.Tilemaps.TilemapLayer;
      layer.setCollisionByExclusion([-1]);

      // The flag: a pole eight tiles tall down to its foot, the flag at its top.
      const top = Math.max(0, flag.row - 7) * TILE;
      this.add.rectangle(flagX, top, 2, (flag.row + 1) * TILE - top, 0xd8dcf0).setOrigin(0.5, 0);
      this.add.image(flagX + 7, top + 8, 'flag-0');

      // The world ends at the stage's sides; its floor is open, so a pit is a fall.
      this.physics.world.setBounds(0, 0, width, height + 4 * TILE, true, true, true, false);
      this.hero = this.physics.add.sprite(startX, startY, 'hero-stand');
      const body = this.hero.body as Phaser.Physics.Arcade.Body;
      body.setSize(PHYSICS.heroW, PHYSICS.heroH).setOffset((32 - PHYSICS.heroW) / 2, 48 - PHYSICS.heroH);
      body.setMaxVelocity(PHYSICS.run, PHYSICS.maxFall);
      this.hero.setCollideWorldBounds(true);
      this.physics.add.collider(this.hero, layer);

      this.cameras.main.setBounds(0, 0, width, height).setBackgroundColor(art.sky);
      this.cameras.main.setScroll(0, 0);
    }

    update(_time: number, delta: number) {
      if (this.done) return;
      const dt = Math.min(delta / 1000, MAX_DT);
      this.t += dt;
      const held = o.held();
      const body = this.hero.body as Phaser.Physics.Arcade.Body;
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
      if (target > cam.scrollX) cam.setScroll(Math.round(target), 0);

      if (this.hero.y - PHYSICS.heroH / 2 > height) {
        o.onEvent('pit');
        this.respawn();
      } else if (this.hero.x >= flagX) {
        this.done = true;
        body.setVelocity(0, 0);
        this.physics.pause();
        this.hero.setTexture('hero-stand');
        o.onEvent('flag');
      }
    }

    respawn() {
      this.hero.setPosition(startX, startY);
      (this.hero.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      this.jump = JUMP_IDLE;
      this.cameras.main.setScroll(0, 0);
    }
  };
}
