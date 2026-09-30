'use client';
// The play dock's game (PRD 757): Entropy Invaders on the tall grid, inside the mini Game Boy. It is
// the arcade's game, unchanged — its engine (games/invaders.ts), its canvas scene and text layer
// (scenes/invaders.ts, .tsx) and its score sending (send.ts) — with none of the arcade's menus: B
// from the ready screen, the pause or the game over folds the dock. Loaded only when the dock first
// opens (PlayDock's dynamic import), so a page where nobody opens it downloads none of this.
//
// A question on the page pauses the game at once, and nothing but START resumes it; Claude done
// leaves the game running to its end. It is silent: a page someone reads is no arcade.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

export default function DockGame({ asking, hero, team = null, values = RULEBOOK.woundClose, supabase = null, workspace = null, account = null, onFold }: DockGameProps) {
  const { theme, mark } = useMemo(() => brandLook(HOUSE_BRAND), []);
  const scores = useMemo<DockAccount | null>(
    () => account ?? (supabase ? supabaseAccount({ url: supabase.url, key: supabase.key, workspace }) : null),
    [account, supabase, workspace],
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const held = useMemo(() => createHeld(), []);
  const fresh = useCallback(() => newGame({ layout: 'tall', values, seed: Math.floor(Math.random() * 2 ** 31) }), [values]);
  const gameRef = useRef<Game>(null as unknown as Game);
  if (!gameRef.current) gameRef.current = fresh();
  const [hud, setHud] = useState<GameHud>(() => hudOf(gameRef.current));
  const hudRef = useRef(hud);
  const [send, setSend] = useState<ScoreSend | null>(null);
  const sendRef = useRef<ScoreSend | null>(null);
  const show = useCallback((s: ScoreSend) => { sendRef.current = s; setSend(s); }, []);
  const askingRef = useRef(asking);
  askingRef.current = asking;
  const foldRef = useRef(onFold);
  foldRef.current = onFold;

  const showHud = useCallback((g: Game) => {
    const next = hudOf(g);
    if (sameHud(next, hudRef.current)) return;
    hudRef.current = next;
    setHud(next);
  }, []);

  // A question pauses the game the moment it arrives; it never resumes by itself.
  useEffect(() => {
    if (!asking) return;
    held.clear();
    gameRef.current = pause(gameRef.current);
    showHud(gameRef.current);
  }, [asking, held, showHud]);

  const act = useCallback((action: Action) => {
    const g = gameRef.current;
    if (askingRef.current && action !== 'b') return; // the question comes first: ANSWER, or fold
    const s = sendRef.current;
    if (g.over && s?.state === 'failed' && g.t - g.overAt >= OVER_SECONDS && overPress(s, action) === 'retry') {
      void sendScore(scores, s.score, show, null, s.tries + 1);
      return;
    }
    const { game, leave } = press(g, action);
    if (leave) return foldRef.current();
    gameRef.current = game;
    showHud(game);
  }, [scores, show, showHud]);

  // The keyboard, while the device is open: Esc folds it, the pad's keys play, and keys typed into a
  // field of the page stay the page's.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') { e.preventDefault(); return foldRef.current(); }
      const action = keyAction(e.key);
      if (!action || action === 'select') return;
      e.preventDefault();
      held.keyDown(e.key);
      if (!e.repeat) act(action);
    };
    const up = (e: KeyboardEvent) => held.keyUp(e.key);
    const lost = () => {
      held.clear();
      gameRef.current = pause(gameRef.current);
      showHud(gameRef.current);
    };
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
  }, [act, held, showHud]);

  // The canvas loop: the game plays the time since the last frame with the buttons held, and its
  // score is sent once, at game over.
  const frameRef = useRef({ theme, mark, hero: hero ?? DEFAULT_HERO, team });
  frameRef.current = { theme, mark, hero: hero ?? DEFAULT_HERO, team };
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
      const g = step(gameRef.current, askingRef.current ? new Set<Action>() : held.buttons(), dt);
      gameRef.current = g;
      showHud(g);
      if (g.over && !sendRef.current) void sendScore(scores, g.score, show);
      const f = frameRef.current;
      const t = (now - start) / 1000;
      const frame: FrameState = {
        scene: 'invaders', grid: TALL, page: 0, view: null, layout: [], sel: 0, fleetSel: 0, t, sceneT: t,
        reduced: reduced.matches, mark: f.mark, theme: f.theme, game: g,
        join: { fleets: [], pick: 0, lockedAt: null, team: f.team, hero: f.hero, away: false },
      };
      drawInvaders(ctx, frame);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [held, scores, show, showHud]);

  return (
    <Screen scene="invaders" frame={TALL} info={INFO} canvasRef={canvasRef} onTap={() => act('a')}>
      <Press.Provider value={act}>
        <InvadersOverlay hud={hud} values={values} hero={hero ?? DEFAULT_HERO} team={team} send={send} back="FOLD" />
      </Press.Provider>
    </Screen>
  );
}
