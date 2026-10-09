'use client';
// OMNI KART's text layer (PRD 1359), over the arcade's canvas: the loading line, the failure line with
// its way back, and the ready screen (COMET RING · 3 LAPS · PRESS START). Later slices add the race's
// own screens. Laid out for the grid the game is drawn on (kart.css).
import { Hint } from '../hint';
import { NOT_LOADED, READY_LINE, type KartStatus } from './kart.ts';
import './common.css';
import './invaders.css';
import './kart.css';

export function KartOverlay({ status, back = 'GAME ROOM' }: {
  /** Where the game's import stands: the ready screen shows once it has loaded. */
  status: KartStatus;
  /** Where leaving goes, as its hint says: the game room in the arcade. */
  back?: string;
}) {
  if (status === 'failed') {
    return (
      <>
        <p className="kt-notice" role="status">{NOT_LOADED}</p>
        <p className="hint kt-back"><Hint k="B">{back}</Hint></p>
      </>
    );
  }
  if (status === 'loading') {
    return (
      <>
        <p className="kt-notice" role="status">LOADING…</p>
        <p className="hint kt-back"><Hint k="B">{back}</Hint></p>
      </>
    );
  }
  return (
    <div className="kt">
      <div className="j-panel kt-panel">
        <p className="inv-title">{READY_LINE}</p>
        <p className="hint"><Hint k="B">{back}</Hint></p>
      </div>
    </div>
  );
}
