'use client';
// The recruit group's text layer: the fleet select (and the change-fleet confirmation), the name entry
// and the hero builder, laid on the 640×360 grid over the canvas in recruit.ts.
import type { Hero } from '@omni/sprites';
import { BUILDER_ROWS, rowValue, type BuilderRow } from '../builder';
import { fleet } from '../fleets';
import { Hint } from '../hint';
import { NAME_MAX, WHEEL, type NameState } from '../name-entry';
import type { FleetRow } from '../types';
import './common.css';
import './recruit.css';

// Ends a sentence on a fleet's label without doubling its own full stop (C.I.A.).
const stop = (label: string) => (label.endsWith('.') ? '' : '.');

export function SelectOverlay({ fleets, pick, change, locked, confirm, current, disbanded, crew, onPick }: {
  fleets: FleetRow[]; pick: number; change: boolean; locked: boolean; confirm: boolean;
  current: string | null; disbanded: boolean; crew: Record<string, number>; onPick: (i: number) => void;
}) {
  const f = fleets[pick];
  if (!f) return <div className="j-center" style={{ top: 150 }}><p className="j-h">NO FLEETS YET</p></div>;
  const from = fleet(current);
  const count = crew[f.name] ?? 0;
  return (
    <>
      <div className="j-center" style={{ top: 16 }}>
        <p className="j-h">{change ? 'CHANGE FLEET' : 'SELECT YOUR FLEET'}</p>
        {disbanded && <p className="j-sub j-warn">YOUR FLEET WAS DISBANDED. CHOOSE A NEW ONE.</p>}
      </div>
      <span className="j-arrow blink" style={{ left: 212, color: f.color }} aria-hidden="true">◀</span>
      <span className="j-arrow blink" style={{ right: 212, color: f.color }} aria-hidden="true">▶</span>
      <div className="j-center" style={{ top: 212 }} aria-live="polite">
        <p className="j-fleet" style={{ color: f.color }}>{f.label}</p>
        <p className="j-txt">{f.motto}</p>
        <p className="j-tiny j-dim">{count ? `CREW ${count}` : 'NEW FLEET · BE THE FIRST'}{f.name === current ? ' · YOUR FLEET' : ''}</p>
      </div>
      <div className="j-cards">
        {fleets.map((fl, i) => (
          <button key={fl.name} type="button" className="j-card" aria-label={fl.label} aria-pressed={i === pick} onClick={() => onPick(i)} />
        ))}
      </div>
      <p className="j-hint"><Hint k="◀ ▶">MOVE</Hint> &nbsp; <Hint k="A">LOCK IN</Hint> &nbsp; <Hint k="B">BACK</Hint></p>
      {locked && <div className="j-center j-zoom" style={{ top: 140 }}><p className="j-big" style={{ ['--glow' as string]: f.color }}>{f.label}!</p></div>}
      {confirm && (
        <div className="j-panel" style={{ left: 104, right: 104, top: 110 }} role="dialog" aria-label="Confirm the change of fleet">
          <p>YOUR FUTURE POINTS GO TO <span style={{ color: f.color }}>{f.label}</span>{stop(f.label)}</p>
          <p>YOUR PAST POINTS STAY WITH <span style={{ color: from.color }}>{from.label}</span>{stop(from.label)}</p>
          <p className="j-tiny j-dim"><Hint k="A">CONFIRM</Hint> &nbsp; <Hint k="B">CANCEL</Hint></p>
        </div>
      )}
    </>
  );
}

export function NameOverlay({ state, shake, team, error }: { state: NameState; shake: boolean; team: string | null; error: string | null }) {
  const f = fleet(team);
  const cur = state.cursor < NAME_MAX ? state.cursor : -1;
  return (
    <>
      <div className="j-center" style={{ top: 18 }}>
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
      <div className="j-center" style={{ top: 198 }}>
        <p className="j-txt j-dim">Your name shows in the Hall of Heroes, next to your hero.</p>
        {error && <p className="j-txt j-error" role="alert">{error}</p>}
      </div>
      {team && <span className="j-badge" style={{ ['--fc' as string]: f.color }}>{f.label}</span>}
      <p className="j-hint"><Hint k="TYPE">OR</Hint> <Hint k="▲▼">SPIN</Hint> &nbsp;<Hint k="◀▶">MOVE</Hint> &nbsp;<Hint k="⌫">ERASE</Hint> &nbsp;<Hint k="ENTER">DONE</Hint></p>
    </>
  );
}

export function BuilderOverlay({ hero, row, team, name, error, onRow }: {
  hero: Hero; row: number; team: string | null; name: string; error: string | null; onRow: (i: number) => void;
}) {
  const f = fleet(team);
  return (
    <>
      <p className="j-h j-left" style={{ left: 300, top: 18 }}>BUILD YOUR HERO</p>
      <span className="j-tiny" style={{ position: 'absolute', left: 24, top: 22, color: f.color }}>{name}</span>
      <div className="j-rows" role="listbox" aria-label="Hero options">
        {BUILDER_ROWS.map((r: BuilderRow, i) => {
          const on = row === i;
          if (r === 'RANDOM' || r === 'DONE') {
            return (
              <button key={r} type="button" role="option" aria-selected={on} className={`j-row j-btn${on ? ' on' : ''}`} onClick={() => onRow(i)}>
                <span className="j-cur">{on ? '▶' : ''}</span><span className="j-lab">{r === 'RANDOM' ? 'RANDOM (TAB)' : 'DONE'}</span>
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
      {error && <p className="j-txt j-error j-left" style={{ left: 300, top: 318 }} role="alert">{error}</p>}
      <p className="j-hint"><Hint k="▲▼">ROW</Hint> &nbsp; <Hint k="◀▶">CHANGE</Hint> &nbsp; <Hint k="TAB">RANDOM</Hint> &nbsp; <Hint k="ENTER">DONE</Hint></p>
    </>
  );
}
