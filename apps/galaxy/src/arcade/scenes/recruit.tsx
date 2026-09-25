'use client';
// The recruit group's text layer: the fleet select (and the change-fleet confirmation), the name entry
// and the hero builder, laid over the canvas in recruit.ts on the grid the scene is drawn on. The
// classes place each part per grid (recruit.css, under `.grid-tall`); on the tall grid the parts that
// sit side by side on the wide one stack, and nothing is left out.
import { Fragment, type ReactNode } from 'react';
import type { Hero } from '@omni/sprites';
import { BUILDER_ROWS, rowValue, type BuilderRow } from '../builder';
import { fleet } from '../fleets';
import { Hint } from '../hint';
import { hintKey } from '../keys';
import { NAME_MAX, WHEEL, type NameState } from '../name-entry';
import { useScreen } from '../Screen';
import type { FleetRow } from '../types';
import { cardRow } from './recruit.ts';
import './common.css';
import './recruit.css';

// Ends a sentence on a fleet's label without doubling its own full stop (C.I.A.).
const stop = (label: string) => (label.endsWith('.') ? '' : '.');

/**
 * The key hints at the bottom of the screen. On the wide grid they are spaced as they always were
 * (`sep[i]` is the text between hint `i` and the next); on the tall grid one space parts them, and the
 * line wraps between two hints, never inside one.
 */
function HintLine({ sep, children }: { sep: string[]; children: ReactNode[] }) {
  const tall = useScreen().grid.name === 'tall';
  return (
    <p className="j-hint r-hint">
      {children.map((hint, i) => <Fragment key={i}>{i > 0 && (tall ? ' ' : sep[i - 1])}{hint}</Fragment>)}
    </p>
  );
}

const SPACED = '   ';

export function SelectOverlay({ fleets, pick, change, locked, confirm, current, disbanded, crew, onPick }: {
  fleets: FleetRow[]; pick: number; change: boolean; locked: boolean; confirm: boolean;
  current: string | null; disbanded: boolean; crew: Record<string, number>; onPick: (i: number) => void;
}) {
  const { grid } = useScreen();
  const f = fleets[pick];
  if (!f) return <div className="j-center r-select-none"><p className="j-h">NO FLEETS YET</p></div>;
  const from = fleet(current);
  const count = crew[f.name] ?? 0;
  const row = cardRow(fleets.length, pick, grid);
  return (
    <>
      <div className="j-center r-select-head">
        <p className="j-h">{change ? 'CHANGE FLEET' : 'SELECT YOUR FLEET'}</p>
        {disbanded && <p className="j-sub j-warn">YOUR FLEET WAS DISBANDED. CHOOSE A NEW ONE.</p>}
      </div>
      <span className="j-arrow r-arrow-left blink" style={{ color: f.color }} aria-hidden="true">◀</span>
      <span className="j-arrow r-arrow-right blink" style={{ color: f.color }} aria-hidden="true">▶</span>
      <div className="j-center r-select-info" aria-live="polite">
        <p className="j-fleet" style={{ color: f.color }}>{f.label}</p>
        <p className="j-txt">{f.motto}</p>
        <p className="j-tiny j-dim">{count ? `CREW ${count}` : 'NEW FLEET · BE THE FIRST'}{f.name === current ? ' · YOUR FLEET' : ''}</p>
      </div>
      <div className="j-cards">
        {fleets.slice(row.first, row.first + row.count).map((fl, k) => {
          const i = row.first + k;
          return (
            <button key={fl.name} type="button" className="j-card" aria-label={fl.label} aria-pressed={i === pick} onClick={() => onPick(i)}
              style={{ left: row.x0 + k * (row.w + row.gap), top: row.y, width: row.w, height: row.h + row.lift }} />
          );
        })}
      </div>
      <HintLine sep={[SPACED, SPACED]}>{[
        <Hint key="move" k="◀ ▶">MOVE</Hint>, <Hint key="a" k="A">LOCK IN</Hint>, <Hint key="b" k="B">BACK</Hint>,
      ]}</HintLine>
      {locked && <div className="j-center j-zoom r-locked"><p className="j-big" style={{ ['--glow' as string]: f.color }}>{f.label}!</p></div>}
      {confirm && (
        <div className="j-panel r-confirm" role="dialog" aria-label="Confirm the change of fleet">
          <p>YOUR FUTURE POINTS GO TO <span style={{ color: f.color }}>{f.label}</span>{stop(f.label)}</p>
          <p>YOUR PAST POINTS STAY WITH <span style={{ color: from.color }}>{from.label}</span>{stop(from.label)}</p>
          <p className="j-tiny j-dim"><Hint k="A">CONFIRM</Hint> &nbsp; <Hint k="B">CANCEL</Hint></p>
        </div>
      )}
    </>
  );
}

export function NameOverlay({ state, shake, team, error }: { state: NameState; shake: boolean; team: string | null; error: string | null }) {
  const tall = useScreen().grid.name === 'tall';
  const f = fleet(team);
  const cur = state.cursor < NAME_MAX ? state.cursor : -1;
  const badge = team && <span className="j-badge r-badge" style={{ ['--fc' as string]: f.color }}>{f.label}</span>;
  const alert = error && <p className="j-txt j-error" role="alert">{error}</p>;
  return (
    <>
      <div className="j-center r-name-head">
        <p className="j-h">ENTER YOUR NAME</p>
        <p className="j-sub">UP TO 10 · A–Z 0–9 AND -</p>
      </div>
      <div className={`j-slots${shake ? ' j-shake' : ''}`} aria-label={`Name: ${state.chars.join('') || 'empty'}`}>
        {Array.from({ length: NAME_MAX }, (_, i) => {
          const c = state.chars[i] ?? '';
          const on = i === cur;
          const at = c ? WHEEL.indexOf(c) : 0;
          return (
            <span key={i} className={`j-slot${on ? ' on' : ''}${on && !c ? ' blinky' : ''}`}>
              {c || (on ? '_' : '')}
              {on && <span className="j-wheel up" aria-hidden="true">{WHEEL[(at + WHEEL.length - 1) % WHEEL.length]}</span>}
              {on && <span className="j-wheel down" aria-hidden="true">{WHEEL[(at + 1) % WHEEL.length]}</span>}
            </span>
          );
        })}
      </div>
      {/* Tall: the error right under the slots, the badge and the note beside the mascot. */}
      {tall && alert && <div className="j-center r-name-error">{alert}</div>}
      <div className="j-center r-name-note">
        {tall && badge}
        <p className="j-txt j-dim">Your name shows in the Hall of Heroes, next to your hero.</p>
        {!tall && alert}
      </div>
      {!tall && badge}
      <HintLine sep={[' ', '  ', '  ', '  ']}>{[
        <Hint key="type" k="TYPE">OR</Hint>, <Hint key="spin" k="▲▼">SPIN</Hint>, <Hint key="move" k="◀▶">MOVE</Hint>,
        <Hint key="erase" k="⌫">ERASE</Hint>, <Hint key="done" k="ENTER">DONE</Hint>,
      ]}</HintLine>
    </>
  );
}

export function BuilderOverlay({ hero, row, team, name, error, onRow }: {
  hero: Hero; row: number; team: string | null; name: string; error: string | null; onRow: (i: number) => void;
}) {
  const { form } = useScreen();
  const f = fleet(team);
  return (
    <>
      <p className="j-h j-left r-hero-head">BUILD YOUR HERO</p>
      <span className="j-tiny r-hero-name" style={{ color: f.color }}>{name}</span>
      <div className="j-rows" role="listbox" aria-label="Hero options">
        {BUILDER_ROWS.map((r: BuilderRow, i) => {
          const on = row === i;
          if (r === 'RANDOM' || r === 'DONE') {
            return (
              <button key={r} type="button" role="option" aria-selected={on} className={`j-row j-btn${on ? ' on' : ''}`} onClick={() => onRow(i)}>
                <span className="j-cur">{on ? '▶' : ''}</span><span className="j-lab">{r === 'RANDOM' ? `RANDOM (${hintKey('TAB', form)})` : 'DONE'}</span>
              </button>
            );
          }
          const v = rowValue(hero, r, f.color);
          return (
            <button key={r} type="button" role="option" aria-selected={on} className={`j-row${on ? ' on' : ''}`} onClick={() => onRow(i)}>
              <span className="j-cur">{on ? '▶' : ''}</span>
              <span className="j-lab">{r}</span>
              <span className="j-val"><span className="j-arr">◀</span>{v.swatches.map((c) => <span key={c} className="j-sw" style={{ background: c }} />)}{v.label}<span className="j-arr">▶</span></span>
            </button>
          );
        })}
      </div>
      {error && <p className="j-txt j-error j-left r-hero-error" role="alert">{error}</p>}
      <HintLine sep={[SPACED, SPACED, SPACED]}>{[
        <Hint key="row" k="▲▼">ROW</Hint>, <Hint key="change" k="◀▶">CHANGE</Hint>, <Hint key="random" k="TAB">RANDOM</Hint>,
        <Hint key="done" k="ENTER">DONE</Hint>,
      ]}</HintLine>
    </>
  );
}
