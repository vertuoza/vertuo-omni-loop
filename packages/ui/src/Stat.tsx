import type { ReactNode } from 'react';
import './Stat.css';
import type { STAT_SIZES } from './Stat.meta.ts';

export type StatProps = {
  /** What the number counts. */
  label: string;
  /** The number, or the short value, itself. */
  value: ReactNode;
  /** One line of context: a period, a change in words. */
  hint?: string;
  size?: (typeof STAT_SIZES)[number];
};

/** One number with its label: read as a pair, the label first. */
export function Stat({ label, value, hint, size = 'md' }: StatProps) {
  return (
    <dl className={`omni-stat omni-stat--${size}`}>
      <dt className="omni-stat__label">{label}</dt>
      <dd className="omni-stat__value">{value}</dd>
      {hint === undefined ? null : <dd className="omni-stat__hint">{hint}</dd>}
    </dl>
  );
}
