'use client';
// The play dock (PRD 757): the corner pill "● ▶ Play while Claude works" while the page says Claude
// works, and, once pressed, a mini Game Boy about 260 px wide playing Entropy Invaders, or, from LV 2,
// a picker between it and SUPER OMNI WORLD (PRD 817) (DockGame, loaded on first open). Its open or
// folded state, and the game picked last, are kept for the tab, so it stays open across the page's tabs. Who plays is the arcade's rule (dockDoor): anyone else sees the arcade's own line and
// a way to it. A question pauses the game and points at it; Claude done lets the game end.
//
// A page mounts it with what it reads: the working state, the player's XP, and where the question
// is answered. Every prop crosses from a server page, so each is plain data.
import { useCallback, useEffect, useState, type ComponentType } from 'react';
import type { WoundKind } from '@omni/galaxy';
import type { Hero } from '@omni/design';
import { ARCADE_PATH, DOCK_LINE, dockDoor, dockView, readDock, writeDock, writeOpen, type DockGameId, type DockPlayer, type DockState, type DockView } from './dock';
import type { DockGameProps } from './DockGame';
import type { DockAccount } from './send';
import './play-dock.css';

/** The game's code, fetched the first time the dock opens: nothing of it is in the page before. */
export const loadGame = () => import('./DockGame').then((m) => m.default);

export interface PlayDockProps {
  /** What Claude is doing, as the page's live poll says. */
  state: DockState;
  /** Who is at the page: GitHub linked and their XP; null for a visitor. */
  player: DockPlayer | null;
  /** The player's hero and fleet, drawn in the game. */
  hero?: Hero | null;
  team?: string | null;
  /** Where ⏸ CLAUDE ASKED · ANSWER leads: the Questions tab, or the question on /ask. */
  answerHref: string;
  /** Each alien's value (the galaxy's `rules.woundClose`); the rulebook's when none is given. */
  values?: Readonly<Record<WoundKind, number>>;
  /** Where the score is saved: the arcade's Supabase project and the workspace played in. */
  supabase?: { url: string; key: string } | null;
  workspace?: string | null;
  /** A client parent's own account, in place of Supabase's (the demo). */
  account?: DockAccount | null;
  /** Fetches the game's code (a test's seam). */
  load?: () => Promise<ComponentType<DockGameProps>>;
}

/** What the corner draws for a view: nothing, the pill, or the device around what `children` plays. */
export function DockFrame({ view, answerHref, onOpen, onFold, children }: {
  view: DockView;
  answerHref: string;
  onOpen: () => void;
  onFold: () => void;
  children?: React.ReactNode;
}) {
  if (view.kind === 'hidden') return null;
  if (view.kind === 'folded') {
    return (
      <button type="button" className="pd-pill" onClick={onOpen} aria-label="Play a game while Claude works">
        <span className="pd-dot" aria-hidden="true">●</span> {DOCK_LINE.pill}
      </button>
    );
  }
  return (
    <section className={`pd-device pd-${view.kind}`} aria-label="Play dock">
      <header className="pd-top">
        <span className="pd-stripe">OMNI LOOP · PLAY DOCK</span>
        <button type="button" className="pd-fold" onClick={onFold} aria-label="Fold (Esc)" title="Fold (Esc)">✕</button>
      </header>
      <div className="pd-lens">
        {view.kind === 'refused' ? (
          <div className="pd-refused">
            <p className="pd-line">{view.line}</p>
            <a className="pd-go" href={ARCADE_PATH}>{DOCK_LINE.arcade}</a>
          </div>
        ) : children}
        {view.kind === 'asking' && (
          <a className="pd-banner pd-ask" href={answerHref}>{DOCK_LINE.asking}</a>
        )}
        {view.kind === 'done' && <p className="pd-banner pd-done" role="status">{DOCK_LINE.done}</p>}
      </div>
    </section>
  );
}

/** The views that play the game. */
const PLAYING: ReadonlyArray<DockView['kind']> = ['playing', 'asking', 'done'];

/** The window's width, once in the browser; 0 before. */
function useWindowWidth(): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const measure = () => setWidth(window.innerWidth);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  return width;
}

/** The game's code, fetched the first time it is to be played; null until then. */
function useGameCode(playing: boolean, load: () => Promise<ComponentType<DockGameProps>>) {
  const [Game, setGame] = useState<ComponentType<DockGameProps> | null>(null);
  useEffect(() => {
    if (!playing || Game) return;
    let live = true;
    load().then((g) => { if (live) setGame(() => g); }).catch((err) => console.error(err));
    return () => { live = false; };
  }, [playing, Game, load]);
  return Game;
}

export function PlayDock({ state, player, hero = null, team = null, answerHref, values, supabase = null, workspace = null, account = null, load = loadGame }: PlayDockProps) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const door = dockDoor(player);

  // The state kept for the tab, once in the browser.
  useEffect(() => {
    const kept = readDock(() => window.sessionStorage);
    setOpen(kept.open);
    setChosen(kept.game);
  }, []);
  const width = useWindowWidth();

  const view = dockView({ state, door, open, game: started, width });
  const playing = PLAYING.includes(view.kind);
  const Game = useGameCode(playing, load);
  useEffect(() => { if (playing && Game) setStarted(true); }, [playing, Game]);

  const show = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setStarted(false);
    writeOpen(() => window.sessionStorage, next);
  }, []);
  const choose = useCallback((game: DockGameId) => {
    setChosen(game);
    writeDock(() => window.sessionStorage, { game });
  }, []);

  return (
    <DockFrame view={view} answerHref={answerHref} onOpen={() => show(true)} onFold={() => show(false)}>
      {Game && playing
        ? <Game games={door.play ? door.games : undefined} chosen={chosen} onChoose={choose} asking={view.kind === 'asking'} hero={hero} team={team} values={values} supabase={supabase} workspace={workspace} account={account} onFold={() => show(false)} />
        : <p className="pd-loading">LOADING…</p>}
    </DockFrame>
  );
}
