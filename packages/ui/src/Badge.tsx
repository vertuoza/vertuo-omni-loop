import type { ReactNode } from 'react';
import './Badge.css';
import type { BADGE_TONES } from './Badge.meta.ts';

export type BadgeProps = {
  tone?: (typeof BADGE_TONES)[number];
  /** What hovering it says, when the label alone does not name what it counts. */
  title?: string;
  children?: ReactNode;
};

/** A short label for a state or a count. It has no signal tone: the signal belongs to one thing per view. */
export function Badge({ tone = 'neutral', title, children }: BadgeProps) {
  return <span className={`omni-badge omni-badge--${tone}`} title={title}>{children}</span>;
}
