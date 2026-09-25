'use client';
// The attract group's text layer: the boot, the title's three phases (title, story, high scores) and
// the Hall of Heroes.
import type { GalaxyView } from '@omni/galaxy';
import { Hint } from '../hint';
import { useScreen } from '../Screen';
import { FleetSprite, HeroSprite } from '../Sprite';
import { fleet, ordinal } from '../fleets';
import type { Player } from '../types';
import { hallPage } from './attract.ts';
import { byLogin } from './common.tsx';
import './common.css';
import './attract.css';

// ── Boot & title ─────────────────────────────────────────────────────────────

export function BootOverlay() {
  return (
    <div className="boot">
      <p className="boot-brand">VERTUOZA</p>
      <p className="boot-presents">PRESENTS</p>
    </div>
  );
}

// The title screen cycles like an arcade attract mode: logo, the story, the high scores.
const PHASES = [['title', 14], ['story', 12], ['hiscore', 9]] as const;
const CYCLE = PHASES.reduce((n, [, s]) => n + s, 0);
export function titlePhaseAt(t: number): 'title' | 'story' | 'hiscore' {
  let k = ((t % CYCLE) + CYCLE) % CYCLE;
  for (const [name, s] of PHASES) { if (k < s) return name; k -= s; }
  return 'title';
}

const STORY = [
  'ENTROPY IS SPREADING.',
  'UNANSWERED QUESTIONS. STUCK SLICES.',
  'BUGS SHIPPED TO PRODUCTION.',
  'EVERY PRD IS A PLANET TO TERRAFORM.',
  'FIVE FLEETS. ONE COMMANDER.',
  'CLOSE THE WOUNDS. SAVE THE PLANETS.',
];

export function TitleOverlay({ view, phase, sceneT, who, signedIn }: {
  view: GalaxyView | null; phase: 'title' | 'story' | 'hiscore'; sceneT: number; who: string; signedIn: boolean;
}) {
  // Nobody gets in without signing in: until then the cabinet asks for a coin.
  const cta = signedIn ? 'PRESS START' : 'INSERT COIN';
  if (phase === 'story') {
    const into = (((sceneT % CYCLE) + CYCLE) % CYCLE) - PHASES[0][1];
    return (
      <div className="story">
        {STORY.map((line, i) => (
          <p key={line} className={into > i * 1.4 ? 'shown' : ''}>{line}</p>
        ))}
        <p className="press blink">{cta}</p>
      </div>
    );
  }
  if (phase === 'hiscore' && view) {
    return (
      <div className="attract-scores">
        <h2>HALL OF HEROES</h2>
        <ol>
          {view.heroes.slice(0, 5).map((h) => (
            <li key={h.name} className={`rank-${h.rank}`}>
              <span>{ordinal(h.rank)}</span><span>{h.name.toUpperCase()}</span><span>{h.points}</span>
            </li>
          ))}
          {!view.heroes.length && <li><span /><span>NO SCORES THIS SEASON YET</span><span /></li>}
        </ol>
        <p className="press blink">{cta}</p>
      </div>
    );
  }
  return (
    <div className="title">
      <h1 className="logo" aria-label="Omni Loop">
        <span className="logo-omni">OMNI</span>
        <span className="logo-loop">LOOP</span>
      </h1>
      <p className="tagline">TERRAFORM THE GALAXY</p>
      <p className="press blink">{cta}</p>
      <footer className="title-foot">
        <span>© 2026 VERTUOZA</span>
        <span>{who}</span>
        <span>{view ? `${view.totals.planets} PLANETS · ${view.totals.openWounds} ENTROPY` : 'SIGN IN TO SEE THE GALAXY'}</span>
      </footer>
    </div>
  );
}

// ── Hall of Heroes ───────────────────────────────────────────────────────────
// The season's top eight: one table on the wide grid, four rows a page on the tall one, which
// ◀ ▶ turn (the group declares its pages in attract.ts).

export function HeroesOverlay({ view, crew }: { view: GalaxyView; crew: Player[] }) {
  const { grid, page, pages } = useScreen();
  const players = byLogin(crew);
  return (
    <div className="heroes">
      <h2>HALL OF HEROES</h2>
      <p className="heroes-season">SEASON {view.season}</p>
      <table>
        <thead><tr><th>RANK</th><th>HERO</th><th>FLEET</th><th>SCORE</th></tr></thead>
        <tbody>
          {hallPage(view.heroes, grid, page).map((h) => (
            <tr key={h.name} className={`rank-${h.rank}`}>
              <td>{ordinal(h.rank)}</td>
              <td>{(() => {
                const p = players.get(h.name.toLowerCase());
                return p
                  ? <span className="hero-cell"><HeroSprite hero={p.hero} team={p.team} scale={0.5} title={`${p.display_name}'s hero`} /> {p.display_name}</span>
                  : h.name.toUpperCase();
              })()}</td>
              <td style={{ color: fleet(h.team).color }}><FleetSprite name={h.team} scale={0.5} /> {fleet(h.team).label}</td>
              <td>{h.points}</td>
            </tr>
          ))}
          {!view.heroes.length && <tr><td colSpan={4}>NO SCORES THIS SEASON YET</td></tr>}
        </tbody>
      </table>
      {pages > 1 && <p className="heroes-page"><Hint k="◀ ▶">PAGE {page + 1}/{pages}</Hint></p>}
      <p className="hint">TOP FLEETS · {view.teams.slice(0, 3).map((t) => `${fleet(t.name).label} ${t.points}`).join(' · ')}</p>
    </div>
  );
}
