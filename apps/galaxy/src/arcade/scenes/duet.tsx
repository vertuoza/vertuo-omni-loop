'use client';
// OMNI DUET's text layer (PRD 1633), over the arcade's canvas: the loading line, the failure line with
// its way back, and the ready screen (CHAPTER I · DRIFT · LIVES ×3 · PRESS START). Once play has
// started the playfield is left clear; later slices add the HUD, the banners, the pause and the game
// over screen. Laid out for the grid the game is drawn on (duet.css).
import { Hint } from '../hint';
import { LOADING_LINE, NOT_LOADED, readyLine, type DuetHud, type DuetStatus } from './duet.ts';
import './common.css';
import './invaders.css';
import './duet.css';

/** The line over the screen while the game loads or when its import failed, with the way back. */
function Notice({ line, back }: { line: string; back: string }) {
  return (
    <>
      <p className="dt-notice" role="status">{line}</p>
      <p className="hint dt-back"><Hint k="B">{back}</Hint></p>
    </>
  );
}

export function DuetOverlay({ status, hud = null, back = 'GAME ROOM' }: {
  /** Where the game's import stands: the ready screen shows once it has loaded. */
  status: DuetStatus;
  /** What the run is showing, once it has loaded. */
  hud?: DuetHud | null;
  /** Where leaving goes, as its hint says: the game room in the arcade. */
  back?: string;
}) {
  if (status !== 'ready' || !hud) return <Notice line={status === 'failed' ? NOT_LOADED : LOADING_LINE} back={back} />;
  if (hud.phase !== 'ready') return null;
  return (
    <div className="dt">
      <div className="j-panel dt-panel">
        <p className="inv-title">{readyLine(hud)}</p>
        <p className="hint"><Hint k="B">{back}</Hint></p>
      </div>
    </div>
  );
}
