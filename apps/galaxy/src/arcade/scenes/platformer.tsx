'use client';
// Super Omni World's text layer (PRD 817), over the game's own canvas: the score line (the score,
// the coins, the lives, the stage and the time left) and the screen over the stage when one is up:
// the ready screen, the pause, the stage clear, the game over, and the way back when Phaser did not
// load. Laid out for the grid the game is drawn on (platformer.css).
import { Hint } from '../hint';
import type { ScreenStatus } from '../platformer/PlatformerScreen';
import type { Session } from '../platformer/session';
import { scoreText } from './invaders.tsx';
import './common.css';
import './platformer.css';

const two = (n: number) => String(Math.max(0, n)).padStart(2, '0');

export function PlatformerOverlay({ session, status, back = 'GAME ROOM' }: {
  session: Session;
  /** Where the game's import stands: the screens show once it runs. */
  status: ScreenStatus;
  /** Where leaving goes, as its hint says: the game room in the arcade. */
  back?: string;
}) {
  if (status === 'failed') return <p className="hint pf-back"><Hint k="A">RETRY</Hint> <Hint k="B">{back}</Hint></p>;
  if (status === 'loading') return <p className="hint pf-back"><Hint k="B">{back}</Hint></p>;
  const s = session;
  return (
    <div className="pf">
      <div className="pf-hud">
        <p className="pf-stat"><b>SCORE</b><span>{scoreText(s.score)}</span></p>
        <p className="pf-stat"><b>COINS</b><span>×{two(s.coins)}</span></p>
        <p className="pf-stat"><b>LIVES</b><span>×{s.lives}</span></p>
        <p className="pf-stat"><b>WORLD</b><span>{s.stage}</span></p>
        <p className="pf-stat"><b>TIME</b><span>{s.time}</span></p>
      </div>
      {s.phase === 'play' && <p className="hint pf-foot"><Hint k="ENTER">PAUSE</Hint></p>}
      {s.phase === 'ready' && (
        <div className="j-panel pf-panel">
          <p className="pf-title">{s.stage} · PRESS START</p>
          <p className="pf-sub">LIVES ×{s.lives}</p>
          <p className="hint"><Hint k="ENTER">PLAY</Hint> <Hint k="B">{back}</Hint></p>
        </div>
      )}
      {s.phase === 'paused' && (
        <div className="j-panel pf-panel">
          <p className="pf-title">PAUSED</p>
          <p className="pf-how">◀ ▶ MOVE · HOLD B TO RUN · A JUMPS, HIGHER HELD</p>
          <p className="hint"><Hint k="ENTER">RESUME</Hint> <Hint k="B">{back}</Hint></p>
        </div>
      )}
      {s.phase === 'clear' && (
        <div className="j-panel pf-panel">
          <p className="pf-title">STAGE CLEAR</p>
          <p className="pf-sub">WORLD {s.stage} · SCORE {scoreText(s.score)}</p>
          <p className="hint"><Hint k="A">{back}</Hint></p>
        </div>
      )}
      {s.phase === 'over' && (
        <div className="j-panel pf-panel">
          <p className="pf-title">GAME OVER</p>
          <p className="pf-sub">WORLD {s.stage} · SCORE {scoreText(s.score)}</p>
          <p className="hint"><Hint k="A">{back}</Hint></p>
        </div>
      )}
    </div>
  );
}
