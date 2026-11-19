import './Skeleton.css';
import type { SKELETON_SHAPES } from './Skeleton.meta.ts';

export type SkeletonProps = {
  shape?: (typeof SKELETON_SHAPES)[number];
  /** What loads, in words, for a screen reader. */
  label?: string;
  /** How many lines, for the text shape. */
  lines?: number;
};

/** The shape of what is loading, in its place; it shimmers unless the person asked for less motion. */
export function Skeleton({ shape = 'text', label = 'Loading', lines = 1 }: SkeletonProps) {
  const count = shape === 'text' ? Math.max(1, Math.floor(lines)) : 1;
  return (
    <div className={`omni-skeleton omni-skeleton--${shape}`} role="status">
      <span className="omni-skeleton__label">{label}</span>
      {Array.from({ length: count }, (_, i) => <span key={i} className="omni-skeleton__shape" aria-hidden="true" />)}
    </div>
  );
}
