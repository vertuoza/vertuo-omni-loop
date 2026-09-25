'use client';
// The galaxy map's text layer: the HUD, the sector labels, the selected planet's tag and its dialog,
// laid out for the grid the map is drawn on (map.css keeps each grid's lines).
import type { GalaxyView } from '@omni/galaxy';
import { useScreen } from '../Screen';
import { FleetSprite } from '../Sprite';
import { fleet, ROMAN } from '../fleets';
import type { MapSlot } from './common.ts';
import { Pips, StateChip } from './common.tsx';
import './common.css';
import './map.css';

export function MapOverlay({ view, layout, sel, onLand }: { view: GalaxyView; layout: MapSlot[]; sel: number; onLand: () => void }) {
  const { grid } = useScreen();
  const p = view.planets[sel];
  const colW = grid.w / Math.max(1, view.sectors.length);
  const slot = layout.find((s) => s.index === sel);
  // The tag is centred under its planet, and kept whole on the screen: its type is 8px a character.
  const half = p ? (String(p.prd).length + 1) * 4 + 1 : 0;
  const tagX = slot ? Math.min(Math.max(slot.x, half), grid.w - half) : 0;
  return (
    <div className="map">
      <header className="hud">
        <span className="hud-season">SEASON {view.season}</span>
        <span className="hud-mid">{view.totals.terraformed}/{view.totals.planets} TERRAFORMED</span>
        <span className="hud-hi">HI {view.teams[0]?.points ?? 0}</span>
      </header>
      {view.sectors.map((s, i) => (
        <span key={s.name} className="sector-label" style={{ left: i * colW, width: colW }}>
          {s.name.toUpperCase()}
        </span>
      ))}
      {slot && p && (
        <span className="map-tag" style={{ left: tagX, top: slot.y + slot.r + 12 }}>#{p.prd}</span>
      )}
      {p ? (
        <section className="dialog" aria-live="polite">
          <div className="dialog-row">
            <span className="dialog-prd">#{p.prd}</span>
            <span className="dialog-title">{p.title.toUpperCase()}</span>
            <StateChip planet={p} />
          </div>
          <div className="dialog-row small">
            <span className="fleet-tag" style={{ color: fleet(p.ownerTeam).color }}>
              <FleetSprite name={p.ownerTeam} scale={0.5} /> {fleet(p.ownerTeam).label}
            </span>
            <span>CLASS {ROMAN[p.class]}{p.crossSector ? ' · CROSS-SECTOR' : ''}</span>
            <span>THREAT <Pips value={p.threat} label="Threat" /></span>
            <span>ZONES {p.secured}/{p.zones.length}</span>
            <span className={p.openWounds.length ? 'warn' : ''}>ENTROPY {p.openWounds.length}</span>
          </div>
          <button type="button" className="dialog-go" onClick={onLand}>A · LAND</button>
        </section>
      ) : (
        <section className="dialog"><p className="empty">NO PLANETS CHARTED YET. OPEN A PRD ISSUE TO CHART ONE.</p></section>
      )}
    </div>
  );
}
