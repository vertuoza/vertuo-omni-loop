'use client';
// OMNI PONG's text layer (PRD 2101), over the arcade's canvas: the loading line, the failure line with
// its way back, and the ready screen: the title, the limit (◀ PITCH · MID ▶), how to steer
// (HIGH ▲ · LOW ▼) and A to turn on the microphone; once it is on, the pitch meter live and START to
// play; refused or missing, MIC REQUIRED with its reason and A to ask again. Then the match's HUD (the
// score and the lives), the pause (with MIC REQUIRED's reason when resuming was refused), MIC LOST, and
// the game over with the score's send (saving, NEW BEST, the best, or not saved with A to retry). Laid
// out for the grid the game is drawn on (pong.css); the loading and failure lines are OMNI DUET's own
// (duet.css).
import {
  LOADING_LINE, livesLine, METER_SIGN, meterAt, meterBand, MIC_LOST, MIC_REASON, NOT_LOADED, OVER_LINE, PAUSED_LINE, PONG_TITLE, readyLines,
  type ArcadePong, type PongHud, type PongStatus,
} from './pong.ts';
import { Hint } from '../hint';
import { canRetry, sendLine, sendTone, type ScoreSend } from './invaders-score';
import './common.css';
import './invaders.css';
import './duet.css';
import './pong.css';

/** The line over the screen while the game loads or when its import failed, with the way back. */
function Notice({ line, back }: { line: string; back: string }) {
  return (
    <>
      <p className="dt-notice" role="status">{line}</p>
      <p className="hint dt-back"><Hint k="B">{back}</Hint></p>
    </>
  );
}

/** The pitch meter: what the steering reads, and a bar marking the heard pitch against the limit and its still band. */
function Meter({ hud }: { hud: PongHud }) {
  const at = meterAt(hud.hz, hud.limitHz);
  const band = meterBand(hud.band);
  return (
    <span className="pg-meter" role="meter" aria-label="PITCH" aria-valuemin={0} aria-valuemax={1} aria-valuenow={at ?? 0.5}>
      <span className="pg-dir">{METER_SIGN[hud.steer]}</span>
      <span className="pg-bar">
        <span className="pg-band" style={{ left: `${band.left * 100}%`, width: `${band.width * 100}%` }} />
        <span className="pg-lim" />
        {at !== null && <span className="pg-hz" style={{ left: `calc(${at * 100}% - 3px)` }} />}
      </span>
    </span>
  );
}

function Ready({ hud, back }: { hud: PongHud; back: string }) {
  const lines = readyLines(hud);
  return (
    <div className="pg">
      <p className="pg-title">{PONG_TITLE}</p>
      <div className="pg-lines">
        {lines.kind === 'refused' ? (
          <>
            <span className="pg-warn" role="alert">{lines.warn}</span>
            <span className="pg-why">{lines.why}</span>
            <span className="pg-key"><Hint k="A"> · {lines.call}</Hint></span>
          </>
        ) : (
          <>
            <span className="pg-pitch" aria-label={lines.pitch}>◀ PITCH · <b>{hud.limit}</b> ▶</span>
            {lines.kind === 'meter' ? <Meter hud={hud} /> : <span className="pg-why">{lines.steer}</span>}
            <span className="pg-key">{lines.kind === 'meter' ? <Hint k="START"> · {lines.call}</Hint> : <Hint k="A"> · {lines.call}</Hint>}</span>
          </>
        )}
      </div>
      <p className="hint pg-foot"><Hint k="B">{back}</Hint></p>
    </div>
  );
}

/** The match's HUD: the points scored, and the lives left as hearts. */
function Stats({ hud }: { hud: PongHud }) {
  return (
    <>
      <p className="inv-stat pg-score"><b>SCORE</b><span>{hud.score}</span></p>
      <p className="inv-stat pg-lives" aria-label={`LIVES ${hud.lives}`}><span>{livesLine(hud.lives)}</span></p>
    </>
  );
}

/** The match held: PAUSED (with why the microphone did not come back, if it did not) or MIC LOST, then the keys. */
function Held({ hud }: { hud: PongHud }) {
  const refused = hud.mic === 'blocked' || hud.mic === 'missing' ? MIC_REASON[hud.mic] : null;
  return (
    <div className="pg">
      <Stats hud={hud} />
      <div className="j-panel pg-panel">
        {hud.phase === 'lost' ? (
          <p className="inv-title pg-head pg-lost" role="alert">{MIC_LOST}</p>
        ) : (
          <>
            <p className="inv-title pg-head">{PAUSED_LINE}</p>
            {refused && <p className="inv-sub pg-refused" role="alert">{refused}</p>}
          </>
        )}
        <p className="hint">
          {hud.phase === 'lost' ? <Hint k="A"> · RETRY</Hint> : <Hint k="ENTER"> · RESUME</Hint>} <Hint k="TAB"> · QUIT</Hint>
        </p>
      </div>
    </div>
  );
}

/** The game over: the score and the send's state, then A (retrying a send that failed, or playing again) and B to the room. */
function Over({ hud, send }: { hud: PongHud; send: ScoreSend | null }) {
  const saving = send ? sendLine(send) : null;
  return (
    <div className="pg">
      <div className="j-panel pg-panel">
        <p className="inv-title pg-head">{OVER_LINE}</p>
        <p className="inv-final"><b>SCORE</b><span>{hud.score}</span></p>
        {send && saving && <p className={`inv-send inv-${sendTone(send)}`} role="status">{saving}</p>}
        <p className="hint"><Hint k="A"> · {canRetry(send) ? 'RETRY' : 'AGAIN'}</Hint> <Hint k="B"> · ROOM</Hint></p>
      </div>
    </div>
  );
}

/** The match in play: the HUD, and how to pause at the foot. */
function Playing({ hud }: { hud: PongHud }) {
  return (
    <div className="pg">
      <Stats hud={hud} />
      <p className="hint pg-foot"><Hint k="ENTER">PAUSE</Hint></p>
    </div>
  );
}

/** The screen the loaded game shows for its phase. */
function PhaseScreen({ hud, send, back }: { hud: PongHud; send: ScoreSend | null; back: string }) {
  switch (hud.phase) {
    case 'ready': return <Ready hud={hud} back={back} />;
    case 'play': return <Playing hud={hud} />;
    case 'paused': case 'lost': return <Held hud={hud} />;
    case 'over': return <Over hud={hud} send={send} />;
  }
}

export function PongOverlay({ status, hud = null, back = 'BACK', send = null }: {
  /** Where the game's import stands: the ready screen shows once it has loaded. */
  status: PongStatus;
  /** What the game is showing, once it has loaded. */
  hud?: PongHud | null;
  /** Where leaving goes, as its hint says. */
  back?: string;
  /** The score reached, being sent or sent, once the match is over. */
  send?: ScoreSend | null;
}) {
  if (status === 'ready' && hud) return <PhaseScreen hud={hud} send={send} back={back} />;
  return <Notice line={status === 'failed' ? NOT_LOADED : LOADING_LINE} back={back} />;
}

/** The arcade's OMNI PONG layer: its overlay once the cabinet has opened, nothing before. */
export function PongLayer({ pong, send = null }: { pong: ArcadePong | null; send?: ScoreSend | null }) {
  return pong ? <PongOverlay status={pong.status} hud={pong.hud} send={send} /> : null;
}
