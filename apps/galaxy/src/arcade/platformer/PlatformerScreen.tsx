'use client';
// The one way into Super Omni World (PRD 817), for the arcade's `platformer` scene and the play
// dock alike. It imports Phaser on demand, the first time it mounts, so no other page or scene ever
// downloads it; starts a pixel-art Phaser.Game in its own box on the grid it is given; hands the
// scene the arcade's held buttons each frame; pauses and resumes when told; and destroys the game,
// its canvas and every listener, on unmount. When the import fails it says so, and A retries.
import { useEffect, useRef, useState } from 'react';
import type { Hero } from '@omni/design';
import type { Grid } from '../grid';
import type { Action } from '../keys';
import { drawArt } from './art';
import { PHYSICS, type PlatformerEvent } from './rules';
import { makeScene, type PhaserModule } from './scene';
import { STAGES } from './stages';
import './platformer.css';

/** Where the screen stands: Phaser on its way, the game running, or the import failed. */
export type ScreenStatus = 'loading' | 'ready' | 'failed';

export const NOT_LOADED = 'GAME DID NOT LOAD · A TO RETRY';

/** The Phaser module, the real one fetched on demand, or whatever a test hands in its place. */
type PhaserLike = Pick<PhaserModule, 'AUTO'> & { Game: new (config: Record<string, unknown>) => GameLike; Scale: { NONE: unknown } };
interface GameLike { pause(): void; resume(): void; destroy(removeCanvas: boolean): void }

export interface PlatformerOptions {
  grid: Grid;
  hero: Hero;
  team: string | null;
  /** The buttons held now: the scene reads them once a frame. */
  held: () => ReadonlySet<Action>;
  onEvent: (e: PlatformerEvent) => void;
}

export interface ScreenDeps {
  load: () => Promise<PhaserLike>;
  /** The scene the game plays, made from the module loaded. */
  scene: (P: PhaserLike, o: PlatformerOptions) => unknown;
  onStatus: (s: ScreenStatus) => void;
}

export interface Platformer {
  status(): ScreenStatus;
  /** Settles once the current import has started the game or failed. */
  readonly ready: Promise<void>;
  pause(): void;
  resume(): void;
  /** Imports Phaser again after a failure; does nothing otherwise. */
  retry(): Promise<void>;
  destroy(): void;
}

/** The real Phaser, fetched only when a platformer screen mounts. */
export const loadPhaser = () => import('phaser') as unknown as Promise<PhaserLike>;

/** The real scene: the first stage, drawn in its palette with the player's hero. */
const realScene: ScreenDeps['scene'] = (P, o) => {
  const stage = STAGES[0];
  return makeScene(P as unknown as PhaserModule, { stage, art: drawArt(o.hero, o.team, stage.palette), held: o.held, onEvent: o.onEvent });
};

/** What a press does on the failed screen: A imports again, B goes back (to the room, or the dock's picker). */
export function failedPress(action: Action): 'retry' | 'back' | null {
  return action === 'a' ? 'retry' : action === 'b' ? 'back' : null;
}

/** Starts the game in `host`: what the screen runs on mount. */
export function startPlatformer(host: HTMLElement, o: PlatformerOptions, deps: ScreenDeps): Platformer {
  let status: ScreenStatus = 'loading';
  let game: GameLike | null = null;
  let paused = false;
  let gone = false;
  const set = (s: ScreenStatus) => { status = s; deps.onStatus(s); };

  const boot = async () => {
    set('loading');
    try {
      const P = await deps.load();
      if (gone) return;
      game = new P.Game({
        type: P.AUTO,
        parent: host,
        width: o.grid.w,
        height: o.grid.h,
        pixelArt: true,
        banner: false,
        backgroundColor: '#000000',
        scale: { mode: P.Scale.NONE },
        input: { keyboard: false, mouse: false, touch: false, gamepad: false },
        audio: { noAudio: true },
        physics: { default: 'arcade', arcade: { gravity: { x: 0, y: PHYSICS.gravity } } },
        scene: deps.scene(P, o),
      });
      if (paused) game.pause();
      set('ready');
    } catch (err) {
      if (gone) return;
      console.error(err);
      set('failed');
    }
  };

  const p: { ready: Promise<void> } & Omit<Platformer, 'ready'> = {
    ready: boot(),
    status: () => status,
    pause() { paused = true; if (!gone) game?.pause(); },
    resume() { paused = false; if (!gone) game?.resume(); },
    retry() {
      if (gone || status !== 'failed') return Promise.resolve();
      p.ready = boot();
      return p.ready;
    },
    destroy() {
      if (gone) return;
      gone = true;
      game?.destroy(true);
      game = null;
    },
  };
  return p;
}

/** The line over the box while there is no game to show: loading, or the import failed. */
export function ScreenNotice({ status }: { status: ScreenStatus }) {
  if (status === 'ready') return null;
  return <p className="pf-notice" role="status">{status === 'failed' ? NOT_LOADED : 'LOADING…'}</p>;
}

export interface PlatformerScreenProps {
  grid: Grid;
  hero: Hero;
  team: string | null;
  held: () => ReadonlySet<Action>;
  /** True pauses the game; false resumes it. */
  paused: boolean;
  /** Each increase retries a failed import: the arcade bumps it on A over the failed line. */
  retry?: number;
  onEvent?: (e: PlatformerEvent) => void;
  onStatus?: (s: ScreenStatus) => void;
  /** Where Phaser comes from; the real module unless a test says otherwise. */
  load?: ScreenDeps['load'];
}

export function PlatformerScreen({ grid, hero, team, held, paused, retry = 0, onEvent, onStatus, load = loadPhaser }: PlatformerScreenProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const game = useRef<Platformer | null>(null);
  const [status, setStatus] = useState<ScreenStatus>('loading');
  // What changes between renders reaches the running game through here, never by restarting it.
  const live = useRef({ held, onEvent, onStatus, paused });
  live.current = { held, onEvent, onStatus, paused };
  const heroKey = JSON.stringify(hero);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const p = startPlatformer(host, {
      grid, hero, team,
      held: () => live.current.held(),
      onEvent: (e) => live.current.onEvent?.(e),
    }, {
      load,
      scene: realScene,
      onStatus: (s) => { setStatus(s); live.current.onStatus?.(s); },
    });
    if (live.current.paused) p.pause();
    game.current = p;
    return () => { p.destroy(); game.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, heroKey, team, load]);

  useEffect(() => {
    if (paused) game.current?.pause();
    else game.current?.resume();
  }, [paused]);

  useEffect(() => {
    if (retry > 0) void game.current?.retry();
  }, [retry]);

  return (
    <div className="pf-screen" style={{ width: grid.w, height: grid.h }}>
      <div className="pf-host" ref={hostRef} />
      <ScreenNotice status={status} />
    </div>
  );
}
