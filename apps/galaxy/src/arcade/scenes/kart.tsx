'use client';
// OMNI KART's text layer (PRD 1359), over the arcade's canvas: the loading line, the failure line with
// its way back, the ready screen (COMET RING · 3 LAPS · PRESS START), the countdown and its GO, and the
// pause. Later slices add the race's own screens. Laid out for the grid the game is drawn on (kart.css).
import { useEffect, useState, type ReactNode } from 'react';
import { Hint } from '../hint';
import { ordinal } from '../fleets';
import type { Tint } from '@omni/design';
import { HeroSprite, Sprite } from '../Sprite';
import { driveLine, keyLabel } from '../keys';
import { useScreen } from '../Screen';
import type { KartOptions, OptionsView } from '../kart/options';
import { choiceLine, GRID_JOINING_LINE, lapsOf, LEFT_LINE, KEY_RESERVED, MENU_LINE, MULTI_CLOSED_LINE, MULTI_LINE, NOT_LOADED, OPTIONS_LINE, PAUSED_LINE, PRESS_A_KEY, raceTime, readyLine, SINGLE_LINE, type KartChoice, type KartGridRow, type KartGridView, type KartHud, type KartItem, type KartStatus, type KartStep } from './kart.ts';
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
function ChoicePanel({ choice, multi, back, laps }: { choice: Extract<KartChoice, { step: 'choose' }>; multi: boolean; back: string; laps: number }) {
  return (
    <div className="kt">
      <div className="j-panel kt-panel">
        <p className="inv-title">{choiceLine(laps)}</p>
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
/** What the KART panel draws the player's kart with: its sprite for a view, and its tint (the game's look, which only the loaded game may import). */
export interface KartArt { sprite: (view: 'kart' | 'kart-left' | 'kart-right') => string; tint: Tint }

/** The lines of an OPTIONS panel, the cursor on one, and the way back. */
function Lines({ rows, cursor }: { rows: readonly (readonly [string, string])[]; cursor: string }) {
  return (
    <>
      <ul className="kt-choice">
        {rows.map(([id, text]) => <li key={id} data-cursor={cursor === id}>{cursor === id ? '▶ ' : ''}{text}</li>)}
      </ul>
      <p className="hint"><Hint k="B">BACK</Hint></p>
    </>
  );
}

const TURN = ['kart', 'kart-right', 'kart', 'kart-left'] as const;

/** The player's kart turning on the KART panel, in its look; still, from behind, under reduced motion. */
function KartTurn({ art }: { art: KartArt }) {
  const [at, setAt] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => { setAt((i) => (i + 1) % TURN.length); }, 350);
    return () => { window.clearInterval(id); };
  }, []);
  return <div className="kt-turn"><Sprite name={art.sprite(TURN[at] ?? 'kart')} tint={art.tint} scale={3} title="YOUR KART" /></div>;
}

function OptionsPanel({ view, options, art }: { view: OptionsView; options: KartOptions; art?: KartArt | null | undefined }) {
  if (view.screen === 'kart') {
    const rows: readonly [string, string][] = [['color', `COLOR ◀ ${options.look.color} ▶`], ['design', `DESIGN ◀ ${options.look.design} ▶`], ['defaults', 'DEFAULTS']];
    return (
      <div className="kt">
        <div className="j-panel kt-panel kt-mid kt-options">
          <p className="inv-title">KART</p>
          {art && <KartTurn art={art} />}
          <Lines rows={rows} cursor={view.cursor} />
        </div>
      </div>
    );
  }
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
    ['kart', 'KART ›'],
    ['laps', `LAPS ◀ ${options.laps} ▶`],
    ['difficulty', `DIFFICULTY ◀ ${options.difficulty.toUpperCase()} ▶`],
    ['defaults', 'DEFAULTS'],
  ];
  return (
    <div className="kt">
      <div className="j-panel kt-panel kt-mid kt-options">
        <p className="inv-title">{OPTIONS_LINE}</p>
        <Lines rows={lines} cursor={view.cursor} />
      </div>
    </div>
  );
}

/** The five actions the KEYS list names, in order. */
const DRIVE_ROWS = [['gas', 'GAS'], ['brake', 'BRAKE'], ['left', 'LEFT'], ['right', 'RIGHT'], ['item', 'ITEM']] as const;

/** A grid row's kart in its look, small, when the game's look is loaded to draw it. */
function kartArt(kartOf: ((row: KartGridRow) => KartArt | null) | undefined, row: KartGridRow) {
  const art = kartOf?.(row);
  return art ? <Sprite name={art.sprite('kart')} tint={art.tint} scale={1} title={`${row.name.toUpperCase()}'S KART`} /> : null;
}

/** The workspace's grid (PRD 1572): the players in their starting order, each with hero, name and best time, then the line that says what happens next. */
function GridPanel({ view, kartOf }: { view: KartGridView; kartOf?: ((row: KartGridRow) => KartArt | null) | undefined }) {
  return (
    <div className="kt">
      <div className="j-panel kt-panel kt-mid kt-grid">
        <p className="inv-title">{view.laps === undefined ? 'GRID' : `GRID · ${view.laps} ${view.laps === 1 ? 'LAP' : 'LAPS'}`}</p>
        <ol className="kt-table kt-gridlist">
          {view.rows.map((r) => (
            <li key={r.id} className={r.you ? 'kt-you' : undefined} data-seat={r.seat}>
              <HeroSprite hero={r.hero} team={r.fleet} scale={0.5} />
              {kartArt(kartOf, r)}
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

const CONFETTI = Array.from({ length: 14 }, (_, i) => i);

/** The podium (PRD 1762): the first three on their steps, each driver with their kart in its look, under confetti that holds still under reduced motion. */
function PodiumScreen({ podium, podiumKart }: { podium: NonNullable<KartHud['podium']>; podiumKart?: ((step: KartStep) => KartArt | null) | undefined }) {
  return (
    <div className="kt">
      <div className="kt-confetti" aria-hidden="true">{CONFETTI.map((i) => <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 5) * 0.3}s` }} data-hue={i % 4} />)}</div>
      <div className="j-panel kt-panel kt-mid kt-podium">
        <p className="inv-title">PODIUM</p>
        <ol className="kt-steps">
          {podium.steps.map((st) => {
            const art = st.filled ? podiumKart?.(st) : null;
            return (
              <li key={st.place} className={`kt-step${st.you ? ' kt-you' : ''}`} data-place={st.place} data-filled={st.filled}>
                {art && <Sprite name={art.sprite('kart')} tint={art.tint} scale={1} title={`${st.name}'S KART`} />}
                <span className="kt-step-name">{st.name}</span>
                <span className="kt-step-block">{st.filled ? ordinal(st.place) : '…'}</span>
              </li>
            );
          })}
        </ol>
        {podium.place && <p className="kt-score" role="status">{podium.place}</p>}
        <p className="hint"><Hint k="A">RESULTS</Hint></p>
      </div>
    </div>
  );
}

/** The finish: the podium first, then the results once A moves on. */
function FinishScreen({ hud, results, send, back, podiumKart }: { hud: KartHud; results: NonNullable<KartHud['results']>; send: ScoreSend | null; back: string; podiumKart?: ((step: KartStep) => KartArt | null) | undefined }) {
  return hud.podium ? <PodiumScreen podium={hud.podium} podiumKart={podiumKart} /> : <ResultsScreen results={results} send={send} back={back} />;
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
        <p className="kt-score">3-LAP TIME {raceTime(results.threeLap)}</p>
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

export function KartOverlay({ status, hud = null, send = null, back = 'GAME ROOM', choice = null, multi = false, lobby = null, options = null, art, kartOf, podiumKart }: {
  /** A podium step's kart in its look (PRD 1762). */
  podiumKart?: (step: KartStep) => KartArt | null;
  /** A grid row's kart in its look (PRD 1762), drawn beside the player. */
  kartOf?: (row: KartGridRow) => KartArt | null;
  /** The player's kart in its look, for the KART panel (PRD 1762). */
  art?: KartArt | null;
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
  if (choice?.step === 'grid') return <GridPanel view={lobby ?? { state: 'joining', rows: [], line: GRID_JOINING_LINE }} kartOf={kartOf} />;
  if (status !== 'ready') return <Notice line={status === 'failed' ? NOT_LOADED : 'LOADING…'} back={back} />;
  if (hud?.results) return <FinishScreen hud={hud} results={hud.results} send={send} back={back} podiumKart={podiumKart} />;
  if (hud && hud.phase !== 'ready') return <RaceScreen hud={hud} back={back} keys={options?.keys} />;
  return <ReadyScreen choice={choice} multi={multi} back={back} options={options} art={art} />;
}

/** The screens before the race: the OPTIONS panel, the choice between SINGLE, MULTI and OPTIONS, or the ready line. */
function ReadyScreen({ choice, multi, back, options, art }: { choice: KartChoice | null; multi: boolean; back: string; options: KartOptions | null; art?: KartArt | null | undefined }) {
  if (choice?.step === 'options' && options) return <OptionsPanel view={choice.view} options={options} art={art} />;
  if (choice?.step === 'choose') return <ChoicePanel choice={choice} multi={multi} back={back} laps={lapsOf(options)} />;
  return (
    <div className="kt">
      <div className="j-panel kt-panel">
        <p className="inv-title">{readyLine(lapsOf(options))}</p>
        <p className="hint"><Hint k="B">{back}</Hint></p>
      </div>
    </div>
  );
}
