'use client';
// OMNI KART's text layer (PRD 1359), over the arcade's canvas: the loading line, the failure line with
// its way back, the ready screen (COMET RING · 3 LAPS · PRESS START), the countdown and its GO, and the
// pause. Later slices add the race's own screens. Laid out for the grid the game is drawn on (kart.css).
import { Hint } from '../hint';
import { ordinal } from '../fleets';
import { CHOICE_LINE, MULTI_CLOSED_LINE, MULTI_LINE, NOT_LOADED, PAUSED_LINE, raceTime, READY_LINE, SINGLE_LINE, type KartChoice, type KartHud, type KartItem, type KartStatus } from './kart.ts';
import { canRetry, sendLine, sendTone, type ScoreSend } from './invaders-score';
import './common.css';
import './invaders.css';
import './kart.css';

/** The place, the lap and the time in framed panels, and the held item as its icon in a frame of its own. */
function RaceLine({ run }: { run: NonNullable<KartHud['run']> }) {
  return (
    <div className="kt-run">
      <span className="kt-panelbox kt-place">{ordinal(run.place)}</span>
      <span className="kt-panelbox">LAP {run.lap}/{run.laps}</span>
      <span className="kt-panelbox">{raceTime(run.tenths)}</span>
      <ItemFrame item={run.item} />
    </div>
  );
}

function ItemFrame({ item }: { item: KartItem | null }) {
  if (!item) return <span className="kt-panelbox kt-item kt-empty" data-item="none" />;
  return (
    <span className="kt-panelbox kt-item" data-item={item}>
      <span className="kt-icon" aria-hidden="true" />
      <span className="kt-item-label">ITEM</span> <span className="kt-item-name">{item.toUpperCase()}</span>
    </span>
  );
}

/** The ready screen before the pick: the circuit, then SINGLE and MULTI with the cursor on one. */
function ChoicePanel({ choice, multi, back }: { choice: Extract<KartChoice, { step: 'choose' }>; multi: boolean; back: string }) {
  return (
    <div className="kt">
      <div className="j-panel kt-panel">
        <p className="inv-title">{CHOICE_LINE}</p>
        <ul className="kt-choice">
          <li data-cursor={choice.cursor === 'single'}>{choice.cursor === 'single' ? '▶ ' : ''}{SINGLE_LINE}</li>
          <li data-cursor={choice.cursor === 'multi'} aria-disabled={!multi}>{choice.cursor === 'multi' ? '▶ ' : ''}{multi ? MULTI_LINE : MULTI_CLOSED_LINE}</li>
        </ul>
        <p className="hint"><Hint k="B">{back}</Hint></p>
      </div>
    </div>
  );
}

/** The line over the screen while the game loads or when its import failed, with the way back. */
function Notice({ line, back }: { line: string; back: string }) {
  return (
    <>
      <p className="kt-notice" role="status">{line}</p>
      <p className="hint kt-back"><Hint k="B">{back}</Hint></p>
    </>
  );
}

/** The finish: the results table, the time that is sent and where sending it stands. */
function ResultsScreen({ results, send, back }: { results: NonNullable<KartHud['results']>; send: ScoreSend | null; back: string }) {
  const line = sendLine(send, 'time');
  return (
    <div className="kt">
      <div className="j-panel kt-panel kt-mid kt-results">
        <p className="inv-title">RESULTS</p>
        <ol className="kt-table">
          {results.rows.map((r) => (
            <li key={r.place} className={r.you ? 'kt-you' : undefined}>
              <span>{ordinal(r.place)}</span><span>{r.name}</span><span>{r.tenths === null ? '--' : raceTime(r.tenths)}</span>
            </li>
          ))}
        </ol>
        <p className="kt-score">TIME {raceTime(results.tenths)}</p>
        {line && send && <p className={`inv-send inv-${sendTone(send)}`} role="status">{line}</p>}
        {canRetry(send)
          ? <p className="hint"><Hint k="A">RETRY</Hint> <Hint k="B">{back}</Hint></p>
          : <p className="hint"><Hint k="A">RACE AGAIN</Hint> <Hint k="B">{back}</Hint></p>}
      </div>
    </div>
  );
}

/** The countdown, the race's line and the pause. */
function RaceScreen({ hud, back }: { hud: KartHud; back: string }) {
  return (
    <div className="kt">
      {hud.beat && <p className={`kt-beat${hud.beat === 'GO' ? ' kt-go' : ''}`} key={hud.beat} role="status">{hud.beat}</p>}
      {hud.run && <RaceLine run={hud.run} />}
      {hud.run?.final && hud.phase === 'race' && <p className="kt-final" role="status">FINAL LAP</p>}
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

export function KartOverlay({ status, hud = null, send = null, back = 'GAME ROOM', choice = null, multi = false }: {
  /** The ready screen's choice (PRD 1572); none reads as SINGLE picked, today's ready line. */
  choice?: KartChoice | null;
  /** Whether MULTI can be picked. */
  multi?: boolean;
  /** Where the game's import stands: the ready screen shows once it has loaded. */
  status: KartStatus;
  /** What the race is showing, once it has loaded: nothing yet reads as the ready screen. */
  hud?: KartHud | null;
  /** Where sending the score stands at the finish; none before it. */
  send?: ScoreSend | null;
  /** Where leaving goes, as its hint says: the game room in the arcade. */
  back?: string;
}) {
  if (status !== 'ready') return <Notice line={status === 'failed' ? NOT_LOADED : 'LOADING…'} back={back} />;
  if (hud?.results) return <ResultsScreen results={hud.results} send={send} back={back} />;
  if (hud && hud.phase !== 'ready') return <RaceScreen hud={hud} back={back} />;
  if (choice?.step === 'choose') return <ChoicePanel choice={choice} multi={multi} back={back} />;
  return (
    <div className="kt">
      <div className="j-panel kt-panel">
        <p className="inv-title">{READY_LINE}</p>
        <p className="hint"><Hint k="B">{back}</Hint></p>
      </div>
    </div>
  );
}
