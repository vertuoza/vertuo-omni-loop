'use client';
// Super Omni World's text layer (PRD 817), over the game's own canvas: the score line (the score,
// the coins, the lives, the stage and the time left) and the screen over the stage when one is up:
// the ready screen, the pause, the stage clear, WORLD CLEAR, the game over with where sending its
// score stands, and the way back when Phaser did not load. Laid out for the grid the game is drawn
// on (platformer.css).
import { Hint } from '../hint';
import type { ScreenStatus } from '../platformer/PlatformerScreen';
import type { Session } from '../platformer/session';
import { scoreText } from './invaders.tsx';
import { canRetry, sendLine, type ScoreSend } from './invaders-score';
import './common.css';
import './platformer.css';

const two = (n: number) => String(Math.max(0, n)).padStart(2, '0');

/** The line on the end screen's score, and the way on: A retries a score not saved while it may. */
function EndSend({ send, back }: { send: ScoreSend | null; back: string }) {
  const line = sendLine(send);
  return (
    <>
      {line && <p className={`inv-send inv-${send!.state === 'saved' && send!.newBest ? 'best' : send!.state}`} role="status">{line}</p>}
      {canRetry(send)
        ? <p className="hint"><Hint k="A">RETRY</Hint> <Hint k="B">{back}</Hint></p>
        : <p className="hint"><Hint k="A">{back}</Hint></p>}
    </>
  );
}

export function PlatformerOverlay({ session, status, send = null, back = 'GAME ROOM' }: {
  session: Session;
  /** Where the game's import stands: the screens show once it runs. */
  status: ScreenStatus;
  /** Where sending the score stands at the game over or WORLD CLEAR; none where it is not sent. */
  send?: ScoreSend | null;
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
          <p className="inv-title">{s.stage} · PRESS START</p>
          <p className="pf-sub">LIVES ×{s.lives}</p>
          <p className="hint"><Hint k="ENTER">PLAY</Hint> <Hint k="B">{back}</Hint></p>
        </div>
      )}
      {s.phase === 'paused' && (
        <div className="j-panel pf-panel">
          <p className="inv-title">PAUSED</p>
          <p className="pf-how">◀ ▶ MOVE · HOLD B TO RUN · A JUMPS, HIGHER HELD</p>
          <p className="hint"><Hint k="ENTER">RESUME</Hint> <Hint k="B">{back}</Hint></p>
        </div>
      )}
      {s.phase === 'clear' && (
        <div className="j-panel pf-panel">
          <p className="inv-title">STAGE CLEAR</p>
          <p className="pf-sub">WORLD {s.stage} · SCORE {scoreText(s.score)}</p>
          <p className="hint"><Hint k="A">NEXT STAGE</Hint></p>
        </div>
      )}
      {s.phase === 'world' && (
        <div className="j-panel pf-panel">
          <p className="inv-title">WORLD CLEAR</p>
          <p className="pf-sub">SCORE {scoreText(s.score)}</p>
          <EndSend send={send} back={back} />
        </div>
      )}
      {s.phase === 'over' && (
        <div className="j-panel pf-panel">
          <p className="inv-title">GAME OVER</p>
          <p className="pf-sub">WORLD {s.stage} · SCORE {scoreText(s.score)}</p>
          <EndSend send={send} back={back} />
        </div>
      )}
    </div>
  );
}
