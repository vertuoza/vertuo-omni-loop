// OMNI KART's live race inside the arcade shell (PRD 1572, slice 4): how a race begins over the grid's
// session, how a player goes back to the grid, and what a hidden tab does. A hook of ArcadeApp, which
// owns the state these act on.
import { useCallback, useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { GridSession, RaceStart } from '../kart/index';
import type { GridPlayer } from '../kart/net';
import type { createHeld } from '../held';
import type { ScoreSend } from './invaders-score';
import type { KartOptions } from '../kart/options';
import type { ArcadeKart, CircuitCard, KartGame } from './kart.ts';

type Ref<T> = RefObject<T>;

export interface KartLiveParts {
  kartRef: Ref<ArcadeKart | null>;
  /** The scene the arcade is on. */
  sceneRef: Ref<{ scene: string }>;
  lobbyRef: Ref<GridSession | null>;
  lobbyTurn: Ref<number>;
  whoRef: Ref<GridPlayer | null>;
  runRef: Ref<number>;
  /** What the grid calls when a start arrives from the player who starts: set here. */
  startRef: Ref<(start: RaceStart) => void>;
  /** The kart state: its game is closed when it is replaced or left. */
  kart: ArcadeKart | null;
  held: ReturnType<typeof createHeld>;
  setKart: Dispatch<SetStateAction<ArcadeKart | null>>;
  showSend: (send: ScoreSend | null) => void;
  showKartHud: (game: KartGame) => void;
  openLobby: () => void;
}

/** The live race's three moves: `beginRace` (START RACE, or a start heard), `backToGrid` and `awayKart` (a hidden tab). */
export function useKartLive(p: KartLiveParts) {
  const { kartRef, sceneRef, lobbyRef, lobbyTurn, whoRef, runRef, startRef, kart, held, setKart, showSend, showKartHud, openLobby } = p;
  // A race starts: the game for it is made over the grid's session, and its countdown begins at once.
  const beginRace = useCallback((start: RaceStart) => {
    const session = lobbyRef.current;
    const me = whoRef.current;
    const now = kartRef.current;
    if (!session || !me || !now || now.choice.step !== 'grid') return;
    const turn = lobbyTurn.current;
    held.clear();
    runRef.current += 1;
    showSend(null);
    const onGrid = (): ArcadeKart | null => {
      const cur = kartRef.current;
      return turn === lobbyTurn.current && lobbyRef.current === session && cur?.choice.step === 'grid' ? cur : null;
    };
    import('../kart/index').then(async ({ joinRace }) => {
      if (!onGrid()) return;
      const game = joinRace({ session, start, me });
      await game.ready(); // the circuit's ground, built while the grid still shows (bug 2152)
      const cur = onGrid();
      if (!cur) { game.close(); return; } // left the grid meanwhile: the race is left too
      setKart({ ...cur, choice: { step: 'live' }, status: 'ready', game, hud: game.hud(), lobby: null });
    }).catch((err: unknown) => { console.error(err); });
  }, [held, showSend, kartRef, lobbyRef, lobbyTurn, whoRef, runRef, setKart]);
  startRef.current = beginRace;
  // Back to the grid from a race (its menu, its results, YOU LEFT THE RACE): the single game is loaded again behind the grid, which the session still holds.
  const backToGrid = useCallback((k: ArcadeKart) => {
    k.game?.close();
    held.clear();
    setKart({ ...k, choice: { step: 'grid' }, status: 'loading', retry: k.retry + 1, game: null, hud: null, lobby: lobbyRef.current?.view() ?? null });
    if (!lobbyRef.current) openLobby();
  }, [held, openLobby, lobbyRef, setKart]);
  // A game that is replaced or left says so (a race in play sends its `leave`) and stops listening.
  const game = kart?.game ?? null;
  useEffect(() => () => { game?.close(); }, [game]);
  // A hidden tab: a MULTI race is left at once; a SINGLE race pauses.
  const awayKart = useCallback(() => {
    const playing = sceneRef.current.scene === 'kart' ? kartRef.current?.game ?? null : null;
    if (!playing) return;
    playing.away();
    showKartHud(playing);
  }, [showKartHud, sceneRef, kartRef]);
  return { beginRace, backToGrid, awayKart };
}

/** The kart state once its game has loaded (or failed to): a MULTI race that began while it was loading keeps its own game. */
export function loadedInto(k: ArcadeKart | null, game: KartGame | null, options: KartOptions | null = k?.options ?? null, circuits: readonly CircuitCard[] = k?.circuits ?? []): ArcadeKart | null {
  if (!k) return k;
  if (k.choice.step === 'live') return options && !k.options ? { ...k, options, circuits } : k;
  return { ...k, status: game ? 'ready' : 'failed', game, hud: game ? game.hud() : null, options, circuits };
}
