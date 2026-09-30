'use client';
// Super Omni World's text layer (PRD 817), over the game's own canvas: the stage, the way to pause,
// and the screen over the stage when one is up: the pause, the stage clear, and the way back when
// Phaser did not load. Laid out for the grid the game is drawn on (platformer.css).
import { Hint } from '../hint';
import type { ScreenStatus } from '../platformer/PlatformerScreen';
import type { Session } from '../platformer/session';
import './common.css';
import './platformer.css';

export function PlatformerOverlay({ session, status, back = 'GAME ROOM' }: {
  session: Session;
  /** Where the game's import stands: the screens show once it runs. */
  status: ScreenStatus;
  /** Where leaving goes, as its hint says: the game room in the arcade. */
  back?: string;
}) {
  if (status === 'failed') return <p className="hint pf-back"><Hint k="A">RETRY</Hint> <Hint k="B">{back}</Hint></p>;
  if (status === 'loading') return <p className="hint pf-back"><Hint k="B">{back}</Hint></p>;
  return (
    <div className="pf">
      <p className="pf-stat"><b>WORLD</b><span>{session.stage}</span></p>
      {session.phase === 'play' && <p className="hint pf-foot"><Hint k="ENTER">PAUSE</Hint></p>}
      {session.phase === 'paused' && (
        <div className="j-panel pf-panel">
          <p className="pf-title">PAUSED</p>
          <p className="pf-how">◀ ▶ MOVE · HOLD B TO RUN · A JUMPS, HIGHER HELD</p>
          <p className="hint"><Hint k="ENTER">RESUME</Hint> <Hint k="B">{back}</Hint></p>
        </div>
      )}
      {session.phase === 'clear' && (
        <div className="j-panel pf-panel">
          <p className="pf-title">STAGE CLEAR</p>
          <p className="pf-sub">WORLD {session.stage}</p>
          <p className="hint"><Hint k="A">{back}</Hint></p>
        </div>
      )}
    </div>
  );
}
