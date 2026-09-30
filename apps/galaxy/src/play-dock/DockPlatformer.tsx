'use client';
// SUPER OMNI WORLD in the play dock (PRD 817): the arcade's game on the tall grid, through its one
// way in (PlatformerScreen, which fetches Phaser only now) and its text layer, under the dock's rules
// (platformer.ts): a question pauses it at once and only START resumes it; Claude done lets it run
// to its end; it is silent. B from a screen over the stage goes back to the picker.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Hero } from '@omni/design';
import { createHeld } from '../arcade/held';
import { Press } from '../arcade/hint';
import type { Action } from '../arcade/keys';
import { Screen } from '../arcade/Screen';
import { TALL } from '../arcade/grid';
import { PlatformerScreen, type ScreenStatus } from '../arcade/platformer/PlatformerScreen';
import type { PlatformerEvent } from '../arcade/platformer/rules';
import { hearEvent } from '../arcade/platformer/session';
import { PlatformerOverlay } from '../arcade/scenes/platformer.tsx';
import { DOCK_INFO, useDockKeys } from './dock-keys';
import { askPf, newDockPf, pfPaused, pressPf } from './platformer';

const NONE: ReadonlySet<Action> = new Set();

export interface DockPlatformerProps {
  /** A question is open on the page: the game pauses, and presses wait for START. */
  asking: boolean;
  hero: Hero;
  team: string | null;
  /** What B's hint says it does: back to the picker. */
  back: string;
  /** B out of the game. */
  onBack: () => void;
  /** Esc, or SELECT on the pause: the dock folds. */
  onFold: () => void;
}

export function DockPlatformer({ asking, hero, team, back, onBack, onFold }: DockPlatformerProps) {
  const held = useMemo(() => createHeld(), []);
  const [pf, setPf] = useState(newDockPf);
  const pfRef = useRef(pf);
  pfRef.current = pf;
  const askingRef = useRef(asking);
  askingRef.current = asking;
  const out = useRef({ onBack, onFold });
  out.current = { onBack, onFold };

  // A question pauses the game the moment it arrives; it never resumes by itself.
  const lost = useCallback(() => { held.clear(); setPf(askPf); }, [held]);
  useEffect(() => { if (asking) lost(); }, [asking, lost]);

  const act = useCallback((action: Action) => {
    const r = pressPf(pfRef.current, action, askingRef.current);
    if (r.out === 'fold') return out.current.onFold();
    if (r.out === 'back') return out.current.onBack();
    if (r.pf !== pfRef.current) { pfRef.current = r.pf; setPf(r.pf); }
  }, []);
  const fold = useCallback(() => out.current.onFold(), []);
  useDockKeys(act, held, fold, lost);

  // The scene reads the held buttons each frame: none while a question is open.
  const buttons = useCallback(() => (askingRef.current ? NONE : held.buttons()), [held]);
  const onStatus = useCallback((status: ScreenStatus) => setPf((p) => ({ ...p, status })), []);
  const onEvent = useCallback((e: PlatformerEvent) => setPf((p) => ({ ...p, session: hearEvent(p.session, e) })), []);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  return (
    <Screen scene="platformer" frame={TALL} info={DOCK_INFO} canvasRef={canvasRef} onTap={() => act('a')}>
      <Press.Provider value={act}>
        <PlatformerScreen grid={TALL} hero={hero} team={team} held={buttons} paused={pfPaused(pf, asking)} retry={pf.retry} onEvent={onEvent} onStatus={onStatus} />
        <PlatformerOverlay session={pf.session} status={pf.status} back={back} />
      </Press.Provider>
    </Screen>
  );
}
