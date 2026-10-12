'use client';
// OMNI DUET's text layer (PRD 1633), over the arcade's canvas: the loading line, the failure line with
// its way back, the ready screen (CHAPTER I · DRIFT · LIVES ×3 · PRESS START, or ENDLESS ×2 after a life
// lost in endless mode), the HUD in play (the score, CH II · 4/10 or ENDLESS ×2 · WAVE n, and the lives
// left), the wave's line in the middle of the playfield as each wave begins, faded out (issue 1692), a
// chapter's banner and ENDLESS · ×2, the pause, and the game over: the score, where the run got to,
// and the score's send (saving, NEW BEST, the best, or not saved with A to retry). Laid out for the
// grid the game is drawn on (duet.css).
import { Hint } from '../hint';
import {
  bannerLine, LOADING_LINE, NOT_LOADED, overLines, PAUSED_LINE, readyParts, waveLine, type ArcadeDuet, type DuetHud, type DuetStatus,
} from './duet.ts';
import { canRetry, sendLine, sendTone, type ScoreSend } from './invaders-score';
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

/** The HUD over the top of the playfield: the score, the chapter and wave, the lives left. */
function Stats({ hud }: { hud: DuetHud }) {
  return (
    <>
      <p className="inv-stat dt-score"><b>SCORE</b><span>{hud.score}</span></p>
      <p className="inv-stat dt-wave"><b>WAVE</b><span>{waveLine(hud)}</span></p>
      <p className="inv-stat dt-lives"><b>LIVES</b><span>×{hud.lives}</span></p>
    </>
  );
}

/** The game over: the score, the send's state, the waves passed and where the run got to, then A and B. */
function Over({ hud, send, back }: { hud: DuetHud; send: ScoreSend | null; back: string }) {
  const line = sendLine(send);
  const [passed, reached] = overLines(hud);
  return (
    <div className="dt">
      <div className="j-panel dt-panel dt-over">
        <p className="inv-title">GAME OVER</p>
        <p className="inv-final"><b>SCORE</b><span>{hud.score}</span></p>
        {line && send && <p className={`inv-send inv-${sendTone(send)}`} role="status">{line}</p>}
        <p className="inv-sub">{passed}</p>
        <p className="inv-sub">{reached}</p>
        <p className="hint">{canRetry(send) ? <Hint k="A">RETRY</Hint> : <Hint k="A">PLAY AGAIN</Hint>} <Hint k="B">{back}</Hint></p>
      </div>
    </div>
  );
}

export function DuetOverlay({ status, hud = null, send = null, back = 'GAME ROOM' }: {
  /** Where the game's import stands: the ready screen shows once it has loaded. */
  status: DuetStatus;
  /** What the run is showing, once it has loaded. */
  hud?: DuetHud | null;
  /** The score reached, being sent or sent, once the run is over. */
  send?: ScoreSend | null;
  /** Where leaving goes, as its hint says: the game room in the arcade. */
  back?: string;
}) {
  if (status !== 'ready' || !hud) return <Notice line={status === 'failed' ? NOT_LOADED : LOADING_LINE} back={back} />;
  if (hud.phase === 'play') {
    return (
      <div className="dt">
        <Stats hud={hud} />
        {hud.line && <p key={`${hud.chapter.numeral} ${hud.endless ? 'E' : ''}${hud.wave}`} className="dt-line" aria-live="polite">{hud.line}</p>}
      </div>
    );
  }
  if (hud.phase === 'chapter') {
    return (
      <div className="dt">
        <Stats hud={hud} />
        <p className="dt-banner inv-title" role="status">{bannerLine(hud)}</p>
      </div>
    );
  }
  if (hud.phase === 'paused') {
    return (
      <div className="dt">
        <Stats hud={hud} />
        <div className="j-panel dt-panel">
          <p className="inv-title">{PAUSED_LINE}</p>
          <p className="hint"><Hint k="ENTER">RESUME</Hint> <Hint k="TAB">END GAME</Hint></p>
        </div>
      </div>
    );
  }
  if (hud.phase === 'over') return <Over hud={hud} send={send} back={back} />;
  const [chapter, call] = readyParts(hud);
  return (
    <div className="dt">
      <div className="j-panel dt-panel">
        <p className="inv-title"><span className="dt-half">{chapter}</span> <span className="dt-half">{call}</span></p>
        <p className="hint"><Hint k="B">{hud.started ? 'END GAME' : back}</Hint></p>
      </div>
    </div>
  );
}

/** The arcade's OMNI DUET layer: its overlay once the cabinet has opened, nothing before. */
export function DuetLayer({ duet, send }: { duet: ArcadeDuet | null; send: ScoreSend | null }) {
  return duet ? <DuetOverlay status={duet.status} hud={duet.hud} send={send} /> : null;
}
