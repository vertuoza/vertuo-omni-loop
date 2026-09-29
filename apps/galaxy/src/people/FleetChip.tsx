import type { CSSProperties } from 'react';
import { mascotSvg } from '../fleets/FleetCard';
import { NEUTRAL } from '../fleets/model';
import { decorative } from './face';
import type { ChipSize } from './PersonChip';
import { SOLO, type FleetTag } from './types';
import './people.css';

// A fleet, as every screen names it (PRD 652, design A): its mascot inline (a caped hero in its colour
// when it has none, as mascotSvg draws it), hidden from screen readers, then its label in its colour.
// A player with no fleet reads SOLO, in grey, as before.

const HEX = /^#[0-9a-f]{6}$/i;

export function FleetChip({ fleet, size = 'table' }: { fleet: FleetTag | typeof SOLO; size?: ChipSize }) {
  if (fleet === SOLO) return <span className="fleet-chip is-solo">SOLO</span>;
  const color = fleet.color && HEX.test(fleet.color) ? fleet.color.toLowerCase() : null;
  const svg = decorative(mascotSvg(fleet.mascot, color ?? NEUTRAL, '', 1));
  return (
    <span className={`fleet-chip is-${size}`} style={color ? ({ '--fleet': color } as CSSProperties) : undefined}>
      <span className="fleet-chip-mascot" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
      <span className="fleet-chip-label">{fleet.label}</span>
    </span>
  );
}
