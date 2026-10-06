'use client';
// The fleets wall's text layer: a card per fleet, and the selected fleet's points, streak, planets
// and crew. On the tall grid the same wall is laid out narrower (fleets.css), with smaller mascots,
// and splits its cards into pages when more than five fleets fly (`cardsShown`).
import type { GalaxyView } from '@omni/galaxy';
import { FleetSprite } from '../Sprite';
import { fleet, ordinal } from '../fleets';
import { useScreen } from '../Screen';
import type { Player } from '../types';
import { byLogin } from './common.tsx';
import { cardsShown } from './fleets.ts';
import { RaiseOverlay } from './raise.tsx';
import './common.css';
import './fleets.css';
import { cssVars } from '../css-vars';

/** The fleets wall; with zero fleets, the "raise your own" screen instead (PRD 400), `owner` saying who reads it. */
export function FleetsOverlay({ view, crew, index, onPick, owner = false }: {
  view: GalaxyView; crew: Player[]; index: number; onPick: (i: number) => void; owner?: boolean;
}) {
  const { grid } = useScreen();
  if (!view.teams.length) return <RaiseOverlay owner={owner} />;
  const players = byLogin(crew);
  const nameOf = (login: string) => players.get(login.toLowerCase())?.display_name ?? `@${login}`;
  const t = view.teams[index];
  const look = fleet(t?.name);
  const shown = cardsShown(grid, view.teams.length, index);
  const art = grid.name === 'tall' ? 1 : 2; // the mascot's scale: 32 grid px on the tall card, 64 on the wide one
  return (
    <div className="fleets">
      <h2>SELECT FLEET</h2>
      {shown.pages > 1 && <p className="cards-page">{shown.page + 1}/{shown.pages}</p>}
      <div className="cards">
        {view.teams.slice(shown.from, shown.to).map((team, k) => {
          const i = shown.from + k;
          const f = fleet(team.name);
          return (
            <button key={team.name} type="button" className={`card ${i === index ? 'active' : ''}`} style={cssVars({ '--fleet': f.color })} onClick={() => { onPick(i); }}>
              <span className="card-rank">{ordinal(team.rank)}</span>
              <span className="card-art"><FleetSprite name={team.name} scale={f.sprite.startsWith('hero') ? (art * 2) / 3 : art} animate={i === index} /></span>
              <span className="card-name">{f.label}</span>
              <span className="card-pts">{team.points}</span>
            </button>
          );
        })}
      </div>
      {t && (
        <section className="fleet-detail" style={cssVars({ '--fleet': look.color })}>
          <p className="fleet-motto">{look.motto}</p>
          <dl>
            <dt>HOME</dt><dd>{t.home ? t.home.toUpperCase() : 'NONE YET'}</dd>
            <dt>PLANETS</dt><dd>{t.planets} OWNED · {t.terraformed} DONE</dd>
            <dt>STREAK</dt><dd>{t.streak}</dd>
            <dt>DISTRESS</dt><dd className={t.inDistress ? 'warn' : ''}>{t.inDistress}</dd>
            <dt>ENTROPY</dt><dd className={t.openWounds ? 'warn' : ''}>{t.openWounds}</dd>
            <dt className="crew-dt">CREW</dt><dd className="crew">{t.members.length ? t.members.map(nameOf).join(' ') : '—'}</dd>
          </dl>
          <p className="hint">A · SHOW THEIR PLANETS · B · MENU</p>
        </section>
      )}
    </div>
  );
}
