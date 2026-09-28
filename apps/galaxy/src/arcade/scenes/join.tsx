'use client';
// The join group's text layer: the coin (and leaving for GitHub), the outsider, the gate, the intro,
// ready and welcome back, over the canvas in join.ts. Each scene's words sit in one
// root naming its state (`join join-coin`), which join.css lays out on the grid the scene is drawn on:
// the wide one, or the tall one on the Game Boy held upright. Both grids show every word.
import { fleet } from '../fleets';
import { Hint } from '../hint';
import type { FleetRow } from '../types';
import './common.css';
import './join.css';

export function CoinOverlay({ away, error, demo, closed }: { away: boolean; error: string | null; demo: boolean; closed: boolean }) {
  if (closed) {
    return (
      <div className="join join-coin join-closed">
        <div className="j-center">
          <p className="j-h">INSERT COIN</p>
          <p className="j-sub">SIGN-IN IS NOT OPEN YET</p>
          <p className="j-txt j-dim">The arcade opens once GitHub sign-in is connected.</p>
        </div>
        <p className="j-hint"><Hint k="B">BACK</Hint></p>
      </div>
    );
  }
  if (away) {
    return (
      <div className="join join-away">
        <div className="j-center">
          <p className="j-sub j-dim">LEAVING THE ARCADE…</p>
          <p className="j-h j-small">GITHUB SIGN-IN</p>
          {demo && <p className="j-txt j-dim">Demo galaxy: no real sign-in, you come back as a guest.</p>}
        </div>
      </div>
    );
  }
  return (
    <div className="join join-coin">
      <div className="j-center">
        <p className="j-h blink">INSERT COIN</p>
        <p className="j-sub">SIGN IN WITH YOUR GITHUB ACCOUNT</p>
        <p className="j-txt j-dim">You join the workspaces of your GitHub orgs.</p>
        {error && <p className="j-txt j-error" role="alert">{error}</p>}
      </div>
      <p className="j-hint"><Hint k="A">SIGN IN WITH GITHUB</Hint> &nbsp; <Hint k="B">BACK</Hint></p>
    </div>
  );
}

/** Where a signed-in account with no workspace gets one: installing Omni Loop (PRD 359). */
export const SIGNUP_PATH = '/signup';

/** Signed in, in no workspace: `who` is the account as the visitor knows it (their GitHub login, or their email). */
export function OutsiderOverlay({ who }: { who: string }) {
  return (
    <div className="join join-outsider">
      <div className="j-center">
        <p className="j-h">NO WORKSPACE YET</p>
        <p className="j-txt j-dim">You are signed in as {who}, and none of your GitHub orgs uses Omni Loop yet.</p>
        <p className="j-txt">Install Omni Loop on your GitHub org, or on your own account, to <a href={SIGNUP_PATH}>sign up</a>.</p>
      </div>
      <p className="j-hint"><Hint k="A">SIGN UP</Hint> &nbsp; <Hint k="B">SIGN OUT</Hint></p>
    </div>
  );
}

export function GateOverlay({ name }: { name: string | null }) {
  return (
    <div className="join join-gate">
      <div className="j-center">
        <p className="j-h">{name ? `WELCOME BACK, ${name}` : 'WELCOME, RECRUIT'}</p>
        <p className="j-press blink">PRESS START</p>
        <p className="j-txt j-dim">Browsers need a key press before they play sound.</p>
      </div>
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
    <div className="join join-intro">
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
    </div>
  );
}

export function ReadyOverlay({ name, team }: { name: string; team: string | null }) {
  const f = fleet(team);
  return (
    <div className="join join-ready">
      <div className="j-center">
        <p className="j-h j-appear" style={{ ['--at' as string]: '1.1s' }}>PLAYER 1 READY</p>
        <p className="j-sub j-appear" style={{ ['--at' as string]: '1.4s', color: f.color }}>{name} · {f.label}</p>
      </div>
      <p className="j-press j-bottom blink j-appear" style={{ ['--at' as string]: '1.8s' }}>PRESS ANY KEY</p>
    </div>
  );
}

export function WelcomeOverlay({ name, team }: { name: string; team: string | null }) {
  const f = fleet(team);
  return (
    <div className="join join-welcome">
      <div className="j-center">
        <p className="j-sub">WELCOME BACK,</p>
        <p className="j-h j-large">{name}</p>
        <p className="j-tiny" style={{ color: f.color }}>{f.label}</p>
      </div>
    </div>
  );
}
