'use client';
// The planet's text layer: its header and caption, and the panel of four tabs (status, zones,
// Entropy, log).
import type { GalaxyView, Planet } from '@omni/galaxy';
import { woundTint } from '@omni/sprites';
import { FleetSprite, Sprite } from '../Sprite';
import { age, fleet, ROMAN, shortDate, WOUND_LOOK } from '../fleets';
import { Pips, StateChip } from './common.tsx';
import './common.css';
import './planet.css';

function Bar({ value, segments = 10, label }: { value: number; segments?: number; label: string }) {
  const on = Math.round(value * segments);
  return (
    <span className="bar" role="img" aria-label={`${label} ${Math.round(value * 100)}%`}>
      {Array.from({ length: segments }, (_, i) => <i key={i} className={i < on ? 'on' : ''} />)}
    </span>
  );
}

export const PLANET_TABS = ['STATUS', 'ZONES', 'ENTROPY', 'LOG'] as const;

function StatusTab({ p, view }: { p: Planet; view: GalaxyView }) {
  const owner = fleet(p.ownerTeam);
  const blockers = p.blockers.map((b) => view.planets.find((x) => x.prd === b));
  return (
    <dl className="stats">
      <dt>TERRAFORM</dt><dd><Bar value={p.progress} label="Terraformed" /> {Math.round(p.progress * 100)}%</dd>
      <dt>THREAT</dt><dd><Pips value={p.threat} label="Threat" /> {ROMAN[p.threat]}</dd>
      <dt>CLASS</dt><dd>{ROMAN[p.class]} · TERRAFORM BONUS ×{view.rules.classMultipliers[p.class - 1]}</dd>
      {p.crossSector && (<><dt>RING</dt><dd>CROSS-SECTOR · ×1.25</dd></>)}
      <dt>REGIONS</dt><dd className="wrap">{p.regions.length ? p.regions.join(' · ') : 'UNSURVEYED'}</dd>
      <dt>CAPTAIN</dt><dd>{p.captain ? `@${p.captain}` : '—'}</dd>
      <dt>FLEET</dt><dd style={{ color: owner.color }}><FleetSprite name={p.ownerTeam} scale={0.5} /> {owner.label}</dd>
      <dt>EXPEDITION</dt><dd>{p.expeditions.length ? p.expeditions.map((l) => `@${l}`).join(' ') : 'NONE YET'}</dd>
      {p.rescuers.length > 0 && (<><dt>RESCUERS</dt><dd>{p.rescuers.map((r) => `@${r.login}`).join(' ')}</dd></>)}
      {blockers.length > 0 && (<><dt>BLOCKED BY</dt><dd className="warn">{blockers.map((b, i) => b ? `#${b.prd} ${b.title}` : `#${p.blockers[i]}`).join(', ')}</dd></>)}
      {p.distressSince && (<><dt>DISTRESS</dt><dd className="warn pulse">SINCE {shortDate(p.distressSince)} · +{view.rules.rescue} TO ANSWER</dd></>)}
      <dt>SEASON PTS</dt><dd className="gold">{p.earned}</dd>
    </dl>
  );
}

const ZONE_ICON: Record<string, { sprite: string; label: string }> = {
  open: { sprite: 'open', label: 'OPEN' },
  claimed: { sprite: 'hammer', label: 'CLAIMED' },
  'under-fire': { sprite: 'fire', label: 'UNDER FIRE' },
  secured: { sprite: 'flag', label: 'SECURED' },
};

function ZonesTab({ p }: { p: Planet }) {
  if (!p.zones.length) {
    return <p className="empty">{p.state === 'locked' ? 'LOCKED. ZONES OPEN ONCE THE BLOCKING PLANETS ARE TERRAFORMED.' : 'NO ZONES OPEN YET. ZONES APPEAR WHEN THE FEATURE PR OPENS.'}</p>;
  }
  const waves = [...new Set(p.zones.map((z) => z.wave ?? 0))].sort((a, b) => a - b);
  return (
    <div className="zones">
      {waves.map((w) => (
        <div key={w} className="wave">
          <span className="wave-label">PHASE {w || '?'}</span>
          <div className="wave-tiles">
            {p.zones.filter((z) => (z.wave ?? 0) === w).map((z) => (
              <span key={`${z.region}:${z.id}`} className={`tile tile-${z.state}`} title={`${z.id} · ${z.region} · ${ZONE_ICON[z.state].label}${z.contributor ? ` · @${z.contributor}` : ''}`}>
                <Sprite name={ZONE_ICON[z.state].sprite} scale={1} animate={z.state !== 'secured'} />
                <span className="tile-id">{z.id}</span>
                {z.team && <span className="tile-team" style={{ background: fleet(z.team).color }} />}
              </span>
            ))}
          </div>
        </div>
      ))}
      <p className="legend">
        {Object.entries(ZONE_ICON).map(([k, v]) => <span key={k}><Sprite name={v.sprite} scale={0.5} /> {v.label}</span>)}
      </p>
      <p className="legend">SEALED ZONES APPEAR HERE WHEN THEIR BLOCKERS MERGE.</p>
    </div>
  );
}

function EntropyTab({ p, view }: { p: Planet; view: GalaxyView }) {
  if (!p.openWounds.length) return <p className="empty good">NO ENTROPY ON THE SURFACE. {p.closedWounds ? `${p.closedWounds} CLEARED.` : ''}</p>;
  return (
    <ul className="wounds">
      {p.openWounds.slice(0, 6).map((w) => (
        <li key={w.id}>
          <Sprite name="entropy" scale={1} tint={woundTint(w.kind)} animate />
          <span className="wound-name" style={{ color: WOUND_LOOK[w.kind].color }}>{WOUND_LOOK[w.kind].name}</span>
          <span className="wound-where">{w.region ?? ''}</span>
          <span className="wound-age">{age(w.ageHours)}</span>
          <span className="wound-cost">−{w.decayPerTranche}/{view.rules.trancheHours}H · +{view.rules.woundClose[w.kind]}</span>
        </li>
      ))}
      {p.openWounds.length > 6 && <li className="more">+{p.openWounds.length - 6} MORE</li>}
    </ul>
  );
}

function LogTab({ p }: { p: Planet }) {
  return (
    <ol className="log">
      {p.log.slice(0, 8).map((l, i) => (
        <li key={`${l.at}-${i}`}><time>{shortDate(l.at)}</time> {l.text}</li>
      ))}
    </ol>
  );
}

export function PlanetOverlay({ view, planet: p, tab, onTab }: { view: GalaxyView; planet: Planet; tab: number; onTab: (t: number) => void }) {
  return (
    <div className="planet">
      <header className="planet-head">
        <span className="dialog-prd">#{p.prd}</span>
        <h2>{p.title.toUpperCase()}</h2>
        <StateChip planet={p} />
      </header>
      <p className="planet-caption">
        {p.state === 'distress' ? 'SOS · NO CLAIM FOR 8 WORKING HOURS' : `ZONES ${p.secured}/${p.zones.length} · ENTROPY ${p.openWounds.length}`}
      </p>
      <section className="panel">
        <div className="tabs" role="tablist">
          {PLANET_TABS.map((t, i) => (
            <button key={t} type="button" role="tab" aria-selected={i === tab} className={i === tab ? 'active' : ''} onClick={() => onTab(i)}>
              {t}{t === 'ENTROPY' && p.openWounds.length ? ` ${p.openWounds.length}` : ''}
            </button>
          ))}
        </div>
        <div className="tab-body" role="tabpanel">
          {tab === 0 && <StatusTab p={p} view={view} />}
          {tab === 1 && <ZonesTab p={p} />}
          {tab === 2 && <EntropyTab p={p} view={view} />}
          {tab === 3 && <LogTab p={p} />}
        </div>
      </section>
      <footer className="hint">◀ ▶ TABS · ▲ ▼ NEXT PLANET · B MAP</footer>
    </div>
  );
}
