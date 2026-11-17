import type { ReactNode } from 'react';
import './Badge.css';
import type { BADGE_TONES } from './Badge.meta.ts';

export type BadgeProps = {
  tone?: (typeof BADGE_TONES)[number];
  children?: ReactNode;
};

/** A short label for a state or a count. It has no signal tone: the signal belongs to one thing per view. */
export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return <span className={`omni-badge omni-badge--${tone}`}>{children}</span>;
}
