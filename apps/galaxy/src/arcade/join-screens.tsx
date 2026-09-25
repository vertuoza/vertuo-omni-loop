'use client';
// The text of the joining screens (sign-in, fleet select, name entry, hero builder, GitHub link),
// laid on the 640×360 grid over the canvas scenes in scenes.ts.
import type { Hero } from '@omni/sprites';
import { BUILDER_ROWS, rowValue, type BuilderRow } from './builder';
import { fleet } from './fleets';
import { Hint } from './hint';
import { NAME_MAX, WHEEL, type NameState } from './name-entry';
import type { FleetRow } from './types';

// Ends a sentence on a fleet's label without doubling its own full stop (C.I.A.).
const stop = (label: string) => (label.endsWith('.') ? '' : '.');

export function CoinOverlay({ away, error, demo, closed }: { away: boolean; error: string | null; demo: boolean; closed: boolean }) {
  if (closed) {
    return (
      <>
        <div className="j-center" style={{ top: 158 }}>
          <p className="j-h">INSERT COIN</p>
          <p className="j-sub">SIGN-IN IS NOT OPEN YET</p>
          <p className="j-txt j-dim">The arcade opens once Google sign-in is connected. Only @vertuoza.com accounts will get in.</p>
        </div>
        <p className="j-hint"><Hint k="B">BACK</Hint></p>
      </>
    );
  }
  if (away) {
    return (
      <div className="j-center" style={{ top: 118 }}>
        <p className="j-sub j-dim">LEAVING THE ARCADE…</p>
        <p className="j-h j-small">GOOGLE SIGN-IN</p>
        {demo && <p className="j-txt j-dim">Demo galaxy: no real sign-in, you come back as a guest.</p>}
      </div>
    );
  }
  return (
    <>
      <div className="j-center" style={{ top: 158 }}>
        <p className="j-h blink">INSERT COIN</p>
        <p className="j-sub">SIGN IN WITH YOUR VERTUOZA ACCOUNT</p>
        <p className="j-txt j-dim">@vertuoza.com accounts only</p>
        {error && <p className="j-txt j-error" role="alert">{error}</p>}
      </div>
      <p className="j-hint"><Hint k="A">SIGN IN WITH GOOGLE</Hint> &nbsp; <Hint k="B">BACK</Hint></p>
    </>
  );
}

export function OutsiderOverlay({ email }: { email: string }) {
  return (
    <>
      <div className="j-center" style={{ top: 70 }}>
        <p className="j-h">WRONG CARTRIDGE</p>
        <p className="j-sub">OMNI LOOP IS FOR @VERTUOZA.COM ACCOUNTS</p>
        <p className="j-txt j-dim">You are signed in as {email}. Sign out, then sign in with your Vertuoza account.</p>
      </div>
      <p className="j-hint"><Hint k="A">SIGN OUT</Hint> &nbsp; <Hint k="B">BACK</Hint></p>
    </>
  );
}

export function GateOverlay({ name }: { name: string | null }) {
  return (
    <div className="j-center" style={{ top: 84 }}>
      <p className="j-h">{name ? `WELCOME BACK, ${name}` : 'WELCOME, RECRUIT'}</p>
      <p className="j-press blink">PRESS START</p>
      <p className="j-txt j-dim">Browsers need a key press before they play sound.</p>
    </div>
  );
}

const LINES = [
  { text: 'ENTROPY IS WINNING.', at: 8, color: 'var(--red)' },
  { text: 'THE GALAXY NEEDS HEROES.', at: 10, color: 'var(--white)' },
  { text: 'CHOOSE YOUR FLEET.', at: 12, color: 'var(--yellow)' },
];

export function IntroOverlay({ fleets }: { fleets: FleetRow[] }) {
  const shown = fleets.slice(0, 5);
  return (
    <>
      <div className="j-center j-intro">
        {LINES.map((l) => (
          <span key={l.text} className="j-type" style={{ ['--n' as string]: l.text.length, ['--at' as string]: `${l.at}s`, color: l.color }}>{l.text}</span>
        ))}
      </div>
      <div className="j-intro-names" aria-hidden="true">
        {shown.map((f, i) => (
          <span key={f.name} className="j-appear" style={{ ['--at' as string]: `${14 + i * 0.5}s`, color: f.color, left: `${((i + 0.5) / shown.length) * 100}%` }}>{f.label}</span>
        ))}
      </div>
      <p className="j-hint j-right"><Hint k="START">SKIP</Hint></p>
    </>
  );
}

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

export type LinkState = 'ask' | 'away' | 'done' | 'error';

export function LinkOverlay({ state, name, login, error, demo }: {
  state: LinkState; name: string; login: string | null; error: string | null; demo: boolean;
}) {
  if (state === 'away') {
    return (
      <div className="j-center" style={{ top: 118 }}>
        <p className="j-sub j-dim">LEAVING THE ARCADE…</p>
        <p className="j-h j-small">GITHUB</p>
        {demo && <p className="j-txt j-dim">Demo galaxy: no real GitHub, you come back with a made-up login.</p>}
      </div>
    );
  }
  if (state === 'done') {
    return (
      <div className="j-panel" style={{ left: 236, right: 30, top: 110 }}>
        <p className="j-good">✓ LINKED AS @{(login ?? '').toUpperCase()}</p>
        <p className="j-txt">You are a player now. Your pull requests will score for your fleet.</p>
        <p className="j-press blink j-small">PRESS START</p>
      </div>
    );
  }
  return (
    <div className="j-panel" style={{ left: 236, right: 30, top: 62 }}>
      <p className="j-gold">TO PLAY, {name}, LINK YOUR GITHUB.</p>
      <p className="j-tiny">YOUR PULL REQUESTS WILL SCORE</p>
      <p className="j-tiny">FOR THE FLEET YOU JOIN.</p>
      <p className="j-txt j-dim">Signed in with Google, you can look around. Linking GitHub, once, makes you a player.</p>
      {state === 'error' && error && <p className="j-txt j-error" role="alert">{error}</p>}
      <p className="j-tiny"><Hint k="A">{state === 'error' ? 'TRY AGAIN' : 'LINK GITHUB'}</Hint> &nbsp; <Hint k="B">VISIT ONLY</Hint></p>
    </div>
  );
}

export function ReadyOverlay({ name, team }: { name: string; team: string | null }) {
  const f = fleet(team);
  return (
    <>
      <div className="j-center" style={{ top: 20 }}>
        <p className="j-h j-appear" style={{ ['--at' as string]: '1.1s' }}>PLAYER 1 READY</p>
        <p className="j-sub j-appear" style={{ ['--at' as string]: '1.4s', color: f.color }}>{name} · {f.label}</p>
      </div>
      <p className="j-press j-bottom blink j-appear" style={{ ['--at' as string]: '1.8s' }}>PRESS ANY KEY</p>
    </>
  );
}

export function WelcomeOverlay({ name, team }: { name: string; team: string | null }) {
  const f = fleet(team);
  return (
    <div className="j-center" style={{ top: 40 }}>
      <p className="j-sub">WELCOME BACK,</p>
      <p className="j-h j-large">{name}</p>
      <p className="j-tiny" style={{ color: f.color }}>{f.label}</p>
    </div>
  );
}
