'use client';
// OMNI PONG's text layer (PRD 2101), over the arcade's canvas: the loading line, the failure line with
// its way back, and the ready screen: the title, the limit (◀ PITCH · MID ▶), how to steer
// (HIGH ▲ · LOW ▼) and A to turn on the microphone; once it is on, the pitch meter live and START to
// play; refused or missing, MIC REQUIRED with its reason and A to ask again. Laid out for the grid the
// game is drawn on (pong.css); the loading and failure lines are OMNI DUET's own (duet.css).
import { Hint } from '../hint';
import {
  LOADING_LINE, METER_SIGN, meterAt, meterBand, NOT_LOADED, PONG_TITLE, readyLines, type ArcadePong, type PongHud, type PongStatus,
} from './pong.ts';
import './common.css';
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

export function PongOverlay({ status, hud = null, back = 'BACK' }: {
  /** Where the game's import stands: the ready screen shows once it has loaded. */
  status: PongStatus;
  /** What the game is showing, once it has loaded. */
  hud?: PongHud | null;
  /** Where leaving goes, as its hint says. */
  back?: string;
}) {
  if (status !== 'ready' || !hud) return <Notice line={status === 'failed' ? NOT_LOADED : LOADING_LINE} back={back} />;
  return <Ready hud={hud} back={back} />;
}

/** The arcade's OMNI PONG layer: its overlay once the cabinet has opened, nothing before. */
export function PongLayer({ pong }: { pong: ArcadePong | null }) {
  return pong ? <PongOverlay status={pong.status} hud={pong.hud} /> : null;
}
