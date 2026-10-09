'use client';
// OMNI KART's text layer (PRD 1359), over the arcade's canvas: the loading line, the failure line with
// its way back, the ready screen (COMET RING · 3 LAPS · PRESS START), the countdown and its GO, and the
// pause. Later slices add the race's own screens. Laid out for the grid the game is drawn on (kart.css).
import { Hint } from '../hint';
import { NOT_LOADED, PAUSED_LINE, READY_LINE, type KartHud, type KartStatus } from './kart.ts';
import './common.css';
import './invaders.css';
import './kart.css';

export function KartOverlay({ status, hud = null, back = 'GAME ROOM' }: {
  /** Where the game's import stands: the ready screen shows once it has loaded. */
  status: KartStatus;
  /** What the race is showing, once it has loaded: nothing yet reads as the ready screen. */
  hud?: KartHud | null;
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
  if (hud && hud.phase !== 'ready') {
    return (
      <div className="kt">
        {hud.beat && <p className="kt-beat" role="status">{hud.beat}</p>}
        {hud.phase === 'paused' && (
          <div className="j-panel kt-panel kt-mid">
            <p className="inv-title">{PAUSED_LINE}</p>
            <p className="hint"><Hint k="ENTER">RESUME</Hint> <Hint k="TAB">{back}</Hint></p>
          </div>
        )}
        {hud.phase === 'race' && <p className="hint kt-foot"><Hint k="ENTER">PAUSE</Hint></p>}
      </div>
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
