import './Progress.css';
import type { PROGRESS_TONES } from './Progress.meta.ts';

export type ProgressProps = {
  /** What is progressing: a screen reader reads it with the value. */
  label: string;
  /** How far along, from 0 to `max`. */
  value: number;
  /** The value that means done; 100 by default. */
  max?: number;
  tone?: (typeof PROGRESS_TONES)[number];
};

/** A bar for how far a task or a budget has got, with its value in words beside it. */
export function Progress({ label, value, max = 100, tone = 'accent' }: ProgressProps) {
  const top = max > 0 ? max : 100;
  const now = Math.min(Math.max(value, 0), top);
  const percent = Math.round((now / top) * 100);
  return (
    <div className="omni-progress">
      <div className="omni-progress__head">
        <span className="omni-progress__label">{label}</span>
        <span className="omni-progress__value">{percent}%</span>
      </div>
      <progress className={`omni-progress__bar omni-progress__bar--${tone}`} aria-label={label} value={now} max={top} />
    </div>
  );
}
