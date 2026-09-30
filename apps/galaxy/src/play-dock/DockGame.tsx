'use client';
// The play dock's game (PRD 757): Entropy Invaders on the tall grid, inside the mini Game Boy. It is
// the arcade's game, unchanged — its engine (games/invaders.ts), its canvas scene and text layer
// (scenes/invaders.ts, .tsx) and its score sending (send.ts) — with none of the arcade's menus: B
// from the ready screen, the pause or the game over folds the dock. Loaded only when the dock first
// opens (PlayDock's dynamic import), so a page where nobody opens it downloads none of this.
//
// A question on the page pauses the game at once, and nothing but START resumes it; Claude done
// leaves the game running to its end. It is silent: a page someone reads is no arcade.
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { WoundKind } from '@omni/galaxy';
import type { Hero } from '@omni/design';
import { RULEBOOK } from 'vertuo-omni-plan/game/rulebook.mjs';
import { brandLook, HOUSE_BRAND } from '../arcade/brand';
import { createHeld } from '../arcade/held';
import { Press } from '../arcade/hint';
import { keyAction, type Action } from '../arcade/keys';
import { Screen, type ScreenInfo } from '../arcade/Screen';
import { TALL } from '../arcade/grid';
import { hudOf, newGame, OVER_SECONDS, pause, press, sameHud, step, type Game, type GameHud } from '../arcade/games/invaders';
import { drawInvaders } from '../arcade/scenes/invaders.ts';
import { InvadersOverlay } from '../arcade/scenes/invaders.tsx';
import { overPress, type ScoreSend } from '../arcade/scenes/invaders-score';
import { supabaseAccount } from '../arcade/account-supabase';
import type { FrameState } from '../arcade/scenes/common.ts';
import { sendScore, type DockAccount } from './send';

const DEFAULT_HERO: Hero = { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 };
const INFO: ScreenInfo = { form: 'full', grid: TALL, page: 0, pages: 1 };

export interface DockGameProps {
  /** A question is open on the page: the game pauses, and presses wait for START. */
  asking: boolean;
  /** The player's hero and fleet, drawn as the ship and the lives left. */
  hero?: Hero | null;
  team?: string | null;
  /** Each alien's value: the galaxy's `rules.woundClose`, the rulebook's by default. */
  values?: Readonly<Record<WoundKind, number>>;
  /** Where the score is saved: the arcade's Supabase account for the workspace, or one given. */
  supabase?: { url: string; key: string } | null;
  workspace?: string | null;
  account?: DockAccount | null;
  /** B out of the game: the dock folds. */
  onFold: () => void;
}

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');

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

// The keyboard, while the device is open: Esc folds it, the pad's keys play, and keys typed into a
// field of the page stay the page's. Leaving the window or the tab pauses the game.
function useDockKeys(act: (action: Action) => void, held: ReturnType<typeof createHeld>, fold: () => void, lost: () => void) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') { e.preventDefault(); return fold(); }
      const action = keyAction(e.key);
      if (!action || action === 'select') return;
      e.preventDefault();
      held.keyDown(e.key);
      if (!e.repeat) act(action);
    };
    const up = (e: KeyboardEvent) => held.keyUp(e.key);
    const hidden = () => { if (document.hidden) lost(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', lost);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', lost);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [act, held, fold, lost]);
}

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
    return () => cancelAnimationFrame(raf);
  }, [canvasRef, tick, lookRef]);
}

/** The game and its HUD: a fresh game of the tall grid, redrawn only when the HUD changes; `pauseGame`
 * lets go of every button and pauses. */
function useGameState(values: Readonly<Record<WoundKind, number>>, held: ReturnType<typeof createHeld>) {
  const fresh = useCallback(() => newGame({ layout: 'tall', values, seed: Math.floor(Math.random() * 2 ** 31) }), [values]);
  const gameRef = useRef<Game>(null as unknown as Game);
  if (!gameRef.current) gameRef.current = fresh();
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
function useInvaders({ asking, values, scores, onFold }: {
  asking: boolean;
  values: Readonly<Record<WoundKind, number>>;
  scores: DockAccount | null;
  onFold: () => void;
}) {
  const held = useMemo(() => createHeld(), []);
  const { gameRef, hud, showHud, pauseGame } = useGameState(values, held);
  const { send, sendRef, show } = useScoreSend();
  const askingRef = useRef(asking);
  askingRef.current = asking;
  const foldRef = useRef(onFold);
  foldRef.current = onFold;

  // A question pauses the game the moment it arrives; it never resumes by itself.
  useEffect(() => {
    if (asking) pauseGame();
  }, [asking, pauseGame]);

  const act = useCallback((action: Action) => {
    const g = gameRef.current;
    if (askingRef.current && action !== 'b') return; // the question comes first: ANSWER, or fold
    const s = sendRef.current;
    if (retries(g, s, action)) {
      void sendScore(scores, s.score, show, null, s.tries + 1);
      return;
    }
    const { game, leave } = press(g, action);
    if (leave) return foldRef.current();
    gameRef.current = game;
    showHud(game);
  }, [gameRef, sendRef, scores, show, showHud]);

  const fold = useCallback(() => foldRef.current(), []);
  useDockKeys(act, held, fold, pauseGame);

  // The time since the last frame, played with the buttons held; the score is sent once, at game over.
  const tick = useCallback((dt: number) => {
    const g = step(gameRef.current, askingRef.current ? new Set<Action>() : held.buttons(), dt);
    gameRef.current = g;
    showHud(g);
    if (g.over && !sendRef.current) void sendScore(scores, g.score, show);
    return g;
  }, [gameRef, sendRef, held, scores, show, showHud]);

  return { hud, send, act, tick };
}

export default function DockGame({ asking, hero, team = null, values = RULEBOOK.woundClose, supabase = null, workspace = null, account = null, onFold }: DockGameProps) {
  const { theme, mark } = useMemo(() => brandLook(HOUSE_BRAND), []);
  const scores = useMemo<DockAccount | null>(
    () => account ?? (supabase ? supabaseAccount({ url: supabase.url, key: supabase.key, workspace }) : null),
    [account, supabase, workspace],
  );
  const ship = hero ?? DEFAULT_HERO;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { hud, send, act, tick } = useInvaders({ asking, values, scores, onFold });

  // The canvas loop, drawn in the dock's look.
  const lookRef = useRef<Look>({ theme, mark, hero: ship, team });
  lookRef.current = { theme, mark, hero: ship, team };
  useCanvasLoop(canvasRef, tick, lookRef);

  return (
    <Screen scene="invaders" frame={TALL} info={INFO} canvasRef={canvasRef} onTap={() => act('a')}>
      <Press.Provider value={act}>
        <InvadersOverlay hud={hud} values={values} hero={ship} team={team} send={send} back="FOLD" />
      </Press.Provider>
    </Screen>
  );
}
