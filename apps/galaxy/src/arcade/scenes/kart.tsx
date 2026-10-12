'use client';
// OMNI KART's text layer (PRD 1359), over the arcade's canvas: the loading line, the failure line with
// its way back, the ready screen (COMET RING · 3 LAPS · PRESS START), the countdown and its GO, and the
// pause. Later slices add the race's own screens. Laid out for the grid the game is drawn on (kart.css).
import type { ReactNode } from 'react';
import { Hint } from '../hint';
import { ordinal } from '../fleets';
import { HeroSprite } from '../Sprite';
import { driveLine, keyLabel } from '../keys';
import { useScreen } from '../Screen';
import type { KartOptions, OptionsView } from '../kart/options';
import { CHOICE_LINE, GRID_JOINING_LINE, LEFT_LINE, KEY_RESERVED, MENU_LINE, MULTI_CLOSED_LINE, MULTI_LINE, NOT_LOADED, OPTIONS_LINE, PAUSED_LINE, PRESS_A_KEY, raceTime, READY_LINE, SINGLE_LINE, type KartChoice, type KartGridView, type KartHud, type KartItem, type KartStatus } from './kart.ts';
import { canRetry, sendLine, sendTone, type ScoreSend } from './invaders-score';
import './common.css';
import './invaders.css';
import './kart.css';

/** The place, the lap and the time in framed panels, and the held item as its icon in a frame of its own. */
function RaceLine({ run, item: itemKey }: { run: NonNullable<KartHud['run']>; item?: string | undefined }) {
  return (
    <div className="kt-run">
      <span className="kt-panelbox kt-place">{ordinal(run.place)}</span>
      <span className="kt-panelbox">LAP {run.lap}/{run.laps}</span>
      <span className="kt-panelbox">{raceTime(run.tenths)}</span>
      <ItemFrame item={run.item} itemKey={itemKey} />
    </div>
  );
}

function ItemFrame({ item, itemKey }: { item: KartItem | null; itemKey?: string | undefined }) {
  // The panel names the key that fires the item (the player's own, PRD 1762) on a keyboard.
  const key = itemKey === undefined ? null : <span className="kt-item-key">{keyLabel(itemKey)}</span>;
  if (!item) return <span className="kt-panelbox kt-item kt-empty" data-item="none">{key}</span>;
  return (
    <span className="kt-panelbox kt-item" data-item={item}>
      {key}<span className="kt-icon" aria-hidden="true" />
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
          <li data-cursor={choice.cursor === 'options'}>{choice.cursor === 'options' ? '▶ ' : ''}{OPTIONS_LINE}</li>
        </ul>
        <p className="hint"><Hint k="B">{back}</Hint></p>
      </div>
    </div>
  );
}

/** The OPTIONS panel (PRD 1762): KEYS ›, LAPS ◀ 3 ▶, DIFFICULTY ◀ NORMAL ▶ and DEFAULTS; on KEYS, the five actions and the key each holds. */
function OptionsPanel({ view, options }: { view: OptionsView; options: KartOptions }) {
  if (view.screen === 'keys') {
    return (
      <div className="kt">
        <div className="j-panel kt-panel kt-mid kt-options">
          <p className="inv-title">KEYS</p>
          <ul className="kt-choice">
            {DRIVE_ROWS.map(([action, name]) => (
              <li key={action} data-cursor={view.cursor === action}>
                {view.cursor === action ? '▶ ' : ''}{name} {view.capture && view.cursor === action ? PRESS_A_KEY : keyLabel(options.keys[action])}
              </li>
            ))}
          </ul>
          {view.capture && view.refused && <p className="kt-score" role="status">{KEY_RESERVED}</p>}
          <p className="hint">{view.capture ? <Hint k="B">CANCEL</Hint> : <><Hint k="A">CHANGE</Hint> <Hint k="B">BACK</Hint></>}</p>
        </div>
      </div>
    );
  }
  const lines: [string, string][] = [
    ['keys', 'KEYS ›'],
    ['laps', `LAPS ◀ ${options.laps} ▶`],
    ['difficulty', `DIFFICULTY ◀ ${options.difficulty.toUpperCase()} ▶`],
    ['defaults', 'DEFAULTS'],
  ];
  return (
    <div className="kt">
      <div className="j-panel kt-panel kt-mid kt-options">
        <p className="inv-title">{OPTIONS_LINE}</p>
        <ul className="kt-choice">
          {lines.map(([id, text]) => <li key={id} data-cursor={view.cursor === id}>{view.cursor === id ? '▶ ' : ''}{text}</li>)}
        </ul>
        <p className="hint"><Hint k="B">BACK</Hint></p>
      </div>
    </div>
  );
}

/** The five actions the KEYS list names, in order. */
const DRIVE_ROWS = [['gas', 'GAS'], ['brake', 'BRAKE'], ['left', 'LEFT'], ['right', 'RIGHT'], ['item', 'ITEM']] as const;

/** The workspace's grid (PRD 1572): the players in their starting order, each with hero, name and best time, then the line that says what happens next. */
function GridPanel({ view }: { view: KartGridView }) {
  return (
    <div className="kt">
      <div className="j-panel kt-panel kt-mid kt-grid">
        <p className="inv-title">GRID</p>
        <ol className="kt-table kt-gridlist">
          {view.rows.map((r) => (
            <li key={r.id} className={r.you ? 'kt-you' : undefined} data-seat={r.seat}>
              <HeroSprite hero={r.hero} team={r.fleet} scale={0.5} />
              <span>{r.name}</span>
              <span>{r.best === null ? 'NO TIME' : raceTime(r.best)}</span>
            </li>
          ))}
        </ol>
        <p className="kt-score kt-gridline" role="status">{view.line}</p>
        <p className="hint"><Hint k="B">BACK</Hint></p>
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
              <span>{r.out ? '--' : ordinal(r.place)}</span><span>{r.name}</span><span>{r.out ? 'OUT' : r.tenths === null ? (results.live ? '—' : '--') : raceTime(r.tenths)}</span>
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

/** A panel over the middle of the race: its title and the keys it offers. */
function MidPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="j-panel kt-panel kt-mid">
      <p className="inv-title">{title}</p>
      <p className="hint">{children}</p>
    </div>
  );
}

/** What stands over the race, if anything: the pause, the MULTI race's menu, or the notice of a player who left. */
function RacePanel({ hud, back }: { hud: KartHud; back: string }) {
  if (hud.phase === 'left') return <MidPanel title={LEFT_LINE}><Hint k="A">GRID</Hint></MidPanel>;
  if (hud.phase === 'paused') return <MidPanel title={PAUSED_LINE}><Hint k="ENTER">RESUME</Hint> <Hint k="TAB">{back}</Hint></MidPanel>;
  if (hud.menu && hud.phase === 'race') return <MidPanel title={MENU_LINE}><Hint k="ENTER">BACK TO RACE</Hint> <Hint k="TAB">LEAVE RACE</Hint></MidPanel>;
  return null;
}

/** The notes around the race: the final lap, what stands over it, and the key that opens the pause (the menu in MULTI). */
function RaceNotes({ hud, back }: { hud: KartHud; back: string }) {
  const racing = hud.phase === 'race';
  return (
    <>
      {racing && hud.run?.final && <p className="kt-final" role="status">FINAL LAP</p>}
      <RacePanel hud={hud} back={back} />
      {racing && !hud.menu && <p className="hint kt-foot"><Hint k="ENTER">{hud.menu === undefined ? 'PAUSE' : 'MENU'}</Hint></p>}
    </>
  );
}

/** The countdown, the race's line and the pause. */
function RaceScreen({ hud, back, keys }: { hud: KartHud; back: string; keys?: KartOptions['keys'] | undefined }) {
  const { form } = useScreen();
  // The player's keys drive on a keyboard; the Game Boy's pad keeps A and B.
  const own = form === 'full' ? keys : undefined;
  return (
    <div className="kt">
      {hud.beat && <p className={`kt-beat${hud.beat === 'GO' ? ' kt-go' : ''}`} key={hud.beat} role="status">{hud.beat}</p>}
      {own && hud.phase === 'countdown' && <p className="kt-keys" data-keys="line">{driveLine(own)}</p>}
      {hud.run && <RaceLine run={hud.run} item={own?.item} />}
      <RaceNotes hud={hud} back={back} />
    </div>
  );
}

export function KartOverlay({ status, hud = null, send = null, back = 'GAME ROOM', choice = null, multi = false, lobby = null, options = null }: {
  /** The player's options (PRD 1762): their keys are named on the countdown and the item panel; the OPTIONS panel shows them. */
  options?: KartOptions | null;
  /** What the GRID shows once MULTI is picked (PRD 1572). */
  lobby?: KartGridView | null;
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
  // The grid needs nothing of the game: it shows while the game loads again behind it.
  if (choice?.step === 'grid') return <GridPanel view={lobby ?? { state: 'joining', rows: [], line: GRID_JOINING_LINE }} />;
  if (status !== 'ready') return <Notice line={status === 'failed' ? NOT_LOADED : 'LOADING…'} back={back} />;
  if (hud?.results) return <ResultsScreen results={hud.results} send={send} back={back} />;
  if (hud && hud.phase !== 'ready') return <RaceScreen hud={hud} back={back} keys={options?.keys} />;
  if (choice?.step === 'options' && options) return <OptionsPanel view={choice.view} options={options} />;
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
