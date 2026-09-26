'use client';
// What the text layers of two or more scene groups share, laid on the 640×360 grid over the canvas.
import type { Planet } from '@omni/galaxy';
import { STATE_LOOK } from '../fleets';
import type { Player } from '../types';
import './common.css';

export function StateChip({ planet }: { planet: Planet }) {
  const look = STATE_LOOK[planet.state];
  return <span className={`chip ${look.blink ? 'pulse' : ''}`} style={{ ['--chip' as string]: look.color }}>{look.label}</span>;
}

export function Pips({ value, max = 5, label }: { value: number; max?: number; label: string }) {
  return (
    <span className="pips" role="img" aria-label={`${label} ${value} of ${max}`}>
      {Array.from({ length: max }, (_, i) => <i key={i} className={i < value ? `on lvl${value}` : ''} />)}
    </span>
  );
}

/** The crew by GitHub login, lower-cased: who a fleet member or a hero on the board is. */
export const byLogin = (crew: Player[]) => new Map(crew.filter((p) => p.github_login).map((p) => [p.github_login!.toLowerCase(), p]));
