'use client';
// The fleets wall's text layer: a card per fleet, and the selected fleet's points, streak, planets
// and crew.
import type { GalaxyView } from '@omni/galaxy';
import { FleetSprite } from '../Sprite';
import { fleet, ordinal } from '../fleets';
import type { Player } from '../types';
import { byLogin } from './common.tsx';
import './common.css';
import './fleets.css';

export function FleetsOverlay({ view, crew, index, onPick }: { view: GalaxyView; crew: Player[]; index: number; onPick: (i: number) => void }) {
  const players = byLogin(crew);
  const nameOf = (login: string) => players.get(login.toLowerCase())?.display_name ?? `@${login}`;
  const t = view.teams[index];
  const look = fleet(t?.name);
  return (
    <div className="fleets">
      <h2>SELECT FLEET</h2>
      <div className="cards">
        {view.teams.map((team, i) => {
          const f = fleet(team.name);
          return (
            <button key={team.name} type="button" className={`card ${i === index ? 'active' : ''}`} style={{ ['--fleet' as string]: f.color }} onClick={() => onPick(i)}>
              <span className="card-rank">{ordinal(team.rank)}</span>
              <span className="card-art"><FleetSprite name={team.name} scale={f.sprite.startsWith('hero') ? 4 / 3 : 2} animate={i === index} /></span>
              <span className="card-name">{f.label}</span>
              <span className="card-pts">{team.points}</span>
            </button>
          );
        })}
      </div>
      {t && (
        <section className="fleet-detail" style={{ ['--fleet' as string]: look.color }}>
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
