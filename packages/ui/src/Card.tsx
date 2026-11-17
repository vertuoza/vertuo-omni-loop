import type { ReactNode } from 'react';
import './Card.css';
import type { CARD_PADDINGS, CARD_SURFACES } from './Card.meta.ts';

export type CardProps = {
  surface?: (typeof CARD_SURFACES)[number];
  /** The step of the space scale inside the card: `space-3` to `space-5`. */
  padding?: (typeof CARD_PADDINGS)[number];
  children?: ReactNode;
};

/** A block of content on a surface, set off by a subtle border: a card never shouts. */
export function Card({ surface = 'surface', padding = '4', children }: CardProps) {
  return <div className={`omni-card omni-card--${surface} omni-card--padding-${padding}`}>{children}</div>;
}
