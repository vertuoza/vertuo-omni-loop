'use client';
// Entropy Invaders in the play dock (PRD 757): the tall grid, inside the mini Game Boy. It is the
// arcade's game, unchanged — its engine (games/invaders.ts), its canvas scene and text layer
// (scenes/invaders.ts, .tsx) and its score sending (send.ts) — with none of the arcade's menus: B
// from the ready screen, the pause or the game over goes back, to the dock's picker when it has one
// (PRD 817), else folding the dock. Part of DockGame, loaded only when the dock first opens.
//
// A question on the page pauses the game at once, and nothing but START resumes it; Claude done
// leaves the game running to its end. It is silent: a page someone reads is no arcade.
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { WoundKind } from '@omni/galaxy';
import type { Hero } from '@omni/design';
import { brandLook, HOUSE_BRAND } from '../arcade/brand';
import { createHeld } from '../arcade/held';
import { Press } from '../arcade/hint';
import type { Action } from '../arcade/keys';
import { Screen } from '../arcade/Screen';
import { TALL } from '../arcade/grid';
import { hudOf, newGame, OVER_SECONDS, pause, press, sameHud, step, type Game, type GameHud } from '../arcade/games/invaders';
import { drawInvaders } from '../arcade/scenes/invaders.ts';
import { InvadersOverlay } from '../arcade/scenes/invaders.tsx';
import { overPress, type ScoreSend } from '../arcade/scenes/invaders-score';
import type { FrameState } from '../arcade/scenes/common.ts';
import { DOCK_INFO, useDockKeys } from './dock-keys';
import { sendScore, type DockAccount } from './send';

/** The room's key for this game, which its score is saved under. */
const INVADERS = 'invaders';

/** Whether `action` retries the score that failed to send: on the game over, once it takes presses. */
const retries = (g: Game, s: ScoreSend | null, action: Action): s is Extract<ScoreSend, { state: 'failed' }> =>
  g.over && s?.state === 'failed' && g.t - g.overAt >= OVER_SECONDS && overPress(s, action) === 'retry';

/** How the dock draws the game: the house brand, and the player's hero and fleet. */
type Look = Pick<FrameState, 'theme' | 'mark'> & { hero: Hero; team: string | null };

/** The canvas's frame of the game `g`, `t` seconds in. */
const frameOf = (g: Game, look: Look, t: number, reduced: boolean): FrameState => ({
  scene: 'invaders', grid: TALL, page: 0, view: null, layout: [], sel: 0, fleetSel: 0, t, sceneT: t,
  reduced, mark: look.mark, theme: look.theme, game: g,
  join: { fleets: [], pick: 0, lockedAt: null, team: look.team, hero: look.hero, away: false },
});

// Draws a frame on the canvas at every animation frame, after `tick` plays the time since the last one.
function useCanvasLoop(canvasRef: RefObject<HTMLCanvasElement | null>, tick: (dt: number) => Game, lookRef: RefObject<Look>) {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const start = performance.now();
    let last = start, raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      drawInvaders(ctx, frameOf(tick(dt), lookRef.current, (now - start) / 1000, reduced.matches));
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); };
  }, [canvasRef, tick, lookRef]);
}

/** The game and its HUD: a fresh game of the tall grid, redrawn only when the HUD changes; `pauseGame`
 * lets go of every button and pauses. */
function useGameState(values: Readonly<Record<WoundKind, number>>, held: ReturnType<typeof createHeld>) {
  const fresh = useCallback(() => newGame({ layout: 'tall', values, seed: Math.floor(Math.random() * 2 ** 31) }), [values]);
  // The first game is dealt once, on the first render, as the ref's start.
  const [first] = useState(fresh);
  const gameRef = useRef<Game>(first);
  const [hud, setHud] = useState<GameHud>(() => hudOf(gameRef.current));
  const hudRef = useRef(hud);

  const showHud = useCallback((g: Game) => {
    const next = hudOf(g);
    if (sameHud(next, hudRef.current)) return;
    hudRef.current = next;
    setHud(next);
  }, []);

  const pauseGame = useCallback(() => {
    held.clear();
    gameRef.current = pause(gameRef.current);
    showHud(gameRef.current);
  }, [held, showHud]);

  return { gameRef, hud, showHud, pauseGame };
}

/** Where the score's sending stands, kept for the overlay and for the presses that read it. */
function useScoreSend() {
  const [send, setSend] = useState<ScoreSend | null>(null);
  const sendRef = useRef<ScoreSend | null>(null);
  const show = useCallback((s: ScoreSend) => { sendRef.current = s; setSend(s); }, []);
  return { send, sendRef, show };
}

/** The game as the dock plays it: `act` presses a button, `tick` plays some seconds. */
function useInvaders({ asking, values, scores, onBack, onFold }: {
  asking: boolean;
  values: Readonly<Record<WoundKind, number>>;
  scores: DockAccount | null;
  onBack: () => void;
  onFold: () => void;
}) {
  const held = useMemo(() => createHeld(), []);
  const { gameRef, hud, showHud, pauseGame } = useGameState(values, held);
  const { send, sendRef, show } = useScoreSend();
  const askingRef = useRef(asking);
  askingRef.current = asking;
  const backRef = useRef(onBack);
  backRef.current = onBack;
  const foldRef = useRef(onFold);
  foldRef.current = onFold;

  // A question pauses the game the moment it arrives; it never resumes by itself.
  useEffect(() => {
    if (asking) pauseGame();
  }, [asking, pauseGame]);

  const act = useCallback((action: Action) => {
    const g = gameRef.current;
    if (askingRef.current && action !== 'b') return; // the question comes first: ANSWER, or go back
    const s = sendRef.current;
    if (retries(g, s, action)) {
      void sendScore(scores, INVADERS, s.score, show, null, s.tries + 1);
      return;
    }
    const { game, leave } = press(g, action);
    if (leave) { backRef.current(); return; }
    gameRef.current = game;
    showHud(game);
  }, [gameRef, sendRef, scores, show, showHud]);

  const fold = useCallback(() => { foldRef.current(); }, []);
  useDockKeys(act, held, fold, pauseGame);

  // The time since the last frame, played with the buttons held; the score is sent once, at game over.
  const tick = useCallback((dt: number) => {
    const g = step(gameRef.current, askingRef.current ? new Set<Action>() : held.buttons(), dt);
    gameRef.current = g;
    showHud(g);
    if (g.over && !sendRef.current) void sendScore(scores, INVADERS, g.score, show);
    return g;
  }, [gameRef, sendRef, held, scores, show, showHud]);

  return { hud, send, act, tick };
}

export interface DockInvadersProps {
  /** A question is open on the page: the game pauses, and presses wait for START. */
  asking: boolean;
  /** The player's hero, drawn as the ship and the lives left, and their fleet. */
  hero: Hero;
  team: string | null;
  /** Each alien's value: the galaxy's `rules.woundClose`. */
  values: Readonly<Record<WoundKind, number>>;
  /** Where the score is saved; none leaves it not saved. */
  scores: DockAccount | null;
  /** What B's hint says it does: back to the picker, or folding the dock. */
  back: string;
  /** B out of the game. */
  onBack: () => void;
  /** Esc: the dock folds. */
  onFold: () => void;
}

export function DockInvaders({ asking, hero, team, values, scores, back, onBack, onFold }: DockInvadersProps) {
  const { theme, mark } = useMemo(() => brandLook(HOUSE_BRAND), []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { hud, send, act, tick } = useInvaders({ asking, values, scores, onBack, onFold });

  // The canvas loop, drawn in the dock's look.
  const lookRef = useRef<Look>({ theme, mark, hero, team });
  lookRef.current = { theme, mark, hero, team };
  useCanvasLoop(canvasRef, tick, lookRef);

  return (
    <Screen scene="invaders" frame={TALL} info={DOCK_INFO} canvasRef={canvasRef} onTap={() => { act('a'); }}>
      <Press.Provider value={act}>
        <InvadersOverlay hud={hud} values={values} hero={hero} team={team} send={send} back={back} />
      </Press.Provider>
    </Screen>
  );
}
