'use client';
// What the play dock's device plays (PRD 757, PRD 817): the games this player may play, each on the
// tall grid. With one game open it goes straight into it, as before; with both, it opens on the
// picker, on the game chosen last, and B from a game's ready, pause or game-over screen comes back to
// it. Loaded only when the dock first opens (PlayDock's dynamic import), so a page where nobody opens
// it downloads none of this, and Phaser only when SUPER OMNI WORLD starts (PlatformerScreen).
import { useCallback, useMemo, useRef, useState } from 'react';
import type { WoundKind } from '@omni/galaxy';
import type { Hero } from '@omni/design';
import { RULEBOOK } from 'vertuo-omni-plan/game/rulebook.ts';
import { Press } from '../arcade/hint';
import type { Action } from '../arcade/keys';
import { supabaseAccount } from '../arcade/account-supabase';
import { backFromGame, dockStart, pickerPress, type DockGameId, type DockScreen } from './dock';
import { useDockKeys } from './dock-keys';
import { DockInvaders } from './DockInvaders';
import { DockPicker } from './DockPicker';
import { DockPlatformer } from './DockPlatformer';
import type { DockAccount } from './send';

const DEFAULT_HERO: Hero = { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 };

export interface DockGameProps {
  /** The games this player may play (dockDoor), Invaders alone when none is given. */
  games?: readonly DockGameId[];
  /** The game the picker chose last in this tab: its cursor starts there. */
  chosen?: string | null;
  /** A game was chosen on the picker: the dock keeps it for the tab. */
  onChoose?: (game: DockGameId) => void;
  /** A question is open on the page: the game pauses, and presses wait for START. */
  asking: boolean;
  /** The player's hero and fleet, drawn in the games. */
  hero?: Hero | null;
  team?: string | null;
  /** Each alien's value: the galaxy's `rules.woundClose`, the rulebook's by default. */
  values?: Readonly<Record<WoundKind, number>>;
  /** Where the score is saved: the arcade's Supabase account for the workspace, or one given. */
  supabase?: { url: string; key: string } | null;
  workspace?: string | null;
  account?: DockAccount | null;
  /** B on the picker, B out of the only game, or Esc: the dock folds. */
  onFold: () => void;
}

const INVADERS_ONLY: readonly DockGameId[] = ['invaders'];

/** The picker on the device, with the dock's keys: up and down choose, A plays, B folds. */
function PickerScreen({ games, sel, asking, onMove, onPlay, onFold }: {
  games: readonly DockGameId[];
  sel: number;
  asking: boolean;
  onMove: (sel: number) => void;
  onPlay: (game: DockGameId) => void;
  onFold: () => void;
}) {
  const live = useRef({ games, sel, asking, onMove, onPlay, onFold });
  live.current = { games, sel, asking, onMove, onPlay, onFold };
  const act = useCallback((action: Action) => {
    const l = live.current;
    if (l.asking && action !== 'b') return; // the question comes first: ANSWER, or fold
    const r = pickerPress(l.games, l.sel, action);
    if (!r) return;
    if ('fold' in r) return l.onFold();
    if ('play' in r) return l.onPlay(r.play);
    l.onMove(r.sel);
  }, []);
  const fold = useCallback(() => live.current.onFold(), []);
  const nothing = useCallback(() => {}, []);
  useDockKeys(act, null, fold, nothing);
  return (
    <Press.Provider value={act}>
      <DockPicker games={games} sel={sel} onPick={(g) => { if (!live.current.asking) onPlay(g); }} />
    </Press.Provider>
  );
}

export default function DockGame({ games = INVADERS_ONLY, chosen = null, onChoose, asking, hero, team = null, values = RULEBOOK.woundClose, supabase = null, workspace = null, account = null, onFold }: DockGameProps) {
  const scores = useMemo<DockAccount | null>(
    () => account ?? (supabase ? supabaseAccount({ url: supabase.url, key: supabase.key, workspace }) : null),
    [account, supabase, workspace],
  );
  const [screen, setScreen] = useState<DockScreen>(() => dockStart(games, chosen));
  const ship = hero ?? DEFAULT_HERO;
  const back = games.length > 1 ? 'GAMES' : 'FOLD';

  const play = useCallback((game: DockGameId) => { onChoose?.(game); setScreen({ kind: 'game', game }); }, [onChoose]);
  const leave = useCallback((game: DockGameId) => {
    const b = backFromGame(games, game);
    if (b.kind === 'fold') onFold();
    else setScreen(b);
  }, [games, onFold]);

  if (screen.kind === 'picker') {
    return <PickerScreen games={games} sel={screen.sel} asking={asking} onMove={(sel) => setScreen({ kind: 'picker', sel })} onPlay={play} onFold={onFold} />;
  }
  if (screen.game === 'platformer') {
    return <DockPlatformer asking={asking} hero={ship} team={team} back={back} onBack={() => leave('platformer')} onFold={onFold} />;
  }
  return <DockInvaders asking={asking} hero={ship} team={team} values={values} scores={scores} back={back} onBack={() => leave('invaders')} onFold={onFold} />;
}
