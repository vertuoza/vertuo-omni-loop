// Super Omni World as the arcade holds it around the Phaser scene (PRD 817), which plays itself and
// reads the held buttons: the stage and the screen up, where Phaser's import stands, the retries
// asked for, and the grid the game started on (it keeps it, as Invaders does). Kept out of ArcadeApp,
// which only starts the game, answers its presses and draws it.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Grid } from '../grid';
import type { ScreenStatus } from './PlatformerScreen';
import type { PlatformerEvent } from './rules';
import { hearEvent, pauseSession, scoreToSend, type Session } from './session';

/** The game the arcade holds: none while another scene is up. */
export interface ArcadePf { session: Session; status: ScreenStatus; retry: number; grid: Grid }

/**
 * The game, and what the scene and the page tell it: the score at the game's end is sent under `game`
 * through `send`, and `playing` says whether the game is the scene up, the only time an outside pause
 * reaches it.
 */
export function usePlatformer(send: { current: (game: string, score: number) => void }, game: string, playing: () => boolean) {
  const [pf, setPf] = useState<ArcadePf | null>(null);
  const pfRef = useRef(pf);
  pfRef.current = pf;
  const onEvent = useCallback((e: PlatformerEvent) => {
    setPf((p) => {
      if (!p) return p;
      const session = hearEvent(p.session, e);
      return session === p.session ? p : { ...p, session };
    });
  }, []);
  // The game's end, game over or WORLD CLEAR, sends its score once: on the move into it.
  const session = pf?.session ?? null;
  const sessionRef = useRef<Session | null>(null);
  useEffect(() => {
    const before = sessionRef.current;
    sessionRef.current = session;
    const score = before && session ? scoreToSend(before, session) : null;
    if (score !== null) send.current(game, score);
  }, [session, send, game]);
  const onStatus = useCallback((status: ScreenStatus) => {
    setPf((p) => (p && p.status !== status ? { ...p, status } : p));
  }, []);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const pause = useCallback(() => {
    setPf((p) => (p && playingRef.current() ? { ...p, session: pauseSession(p.session) } : p));
  }, []);
  return { pf, pfRef, setPf, onEvent, onStatus, pause };
}
