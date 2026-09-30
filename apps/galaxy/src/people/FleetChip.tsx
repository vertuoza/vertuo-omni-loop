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
//
// PRD 698: a fleet is a link to its board, /app/fleet?fleet=<name>; SOLO stays a span. A chip drawn
// inside another link passes link={false}. Hover and focus underline the label, never the mascot.

const HEX = /^#[0-9a-f]{6}$/i;

/** The board of the fleet with this name. */
const fleetHref = (name: string) => `/app/fleet?fleet=${encodeURIComponent(name)}`;

export function FleetChip({ fleet, size = 'table', link = true }: { fleet: FleetTag | typeof SOLO; size?: ChipSize; link?: boolean }) {
  if (fleet === SOLO) return <span className="fleet-chip is-solo">SOLO</span>;
  const color = fleet.color && HEX.test(fleet.color) ? fleet.color.toLowerCase() : null;
  const svg = decorative(mascotSvg(fleet.mascot, color ?? NEUTRAL, '', 1));
  const className = `fleet-chip is-${size}`;
  const style = color ? ({ '--fleet': color } as CSSProperties) : undefined;
  const inner = (
    <>
      <span className="fleet-chip-mascot" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
      <span className="fleet-chip-label">{fleet.label}</span>
    </>
  );
  if (link) return <a className={className} href={fleetHref(fleet.name)} style={style}>{inner}</a>;
  return <span className={className} style={style}>{inner}</span>;
}
