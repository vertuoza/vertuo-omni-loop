import type { ReactNode } from 'react';
import './Timeline.css';
import type { TIMELINE_DENSITIES, TIMELINE_STATES } from './Timeline.meta.ts';

export type TimelineItem = {
  id: string;
  title: ReactNode;
  /** When it happened, or will. */
  time?: ReactNode;
  detail?: ReactNode;
  /** Said in words and drawn by the marker's shape, never by colour alone. */
  state?: (typeof TIMELINE_STATES)[number];
};

export type TimelineProps = {
  items: readonly TimelineItem[];
  density?: (typeof TIMELINE_DENSITIES)[number];
};

const STATE_WORDS = { done: 'Done', current: 'Current', pending: 'Pending' } as const;

/** What happened, and what comes next, in order along a line. */
export function Timeline({ items, density = 'normal' }: TimelineProps) {
  return (
    <ol className={`omni-timeline omni-timeline--${density}`}>
      {items.map((item) => {
        const state = item.state ?? 'done';
        return (
          <li key={item.id} className={`omni-timeline__item omni-timeline__item--${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="omni-timeline__marker" aria-hidden="true" />
            <span className="omni-timeline__body">
              <span className="omni-timeline__title">
                {item.title}
                <span className="omni-timeline__state"> ({STATE_WORDS[state]})</span>
              </span>
              {item.time === undefined ? null : <span className="omni-timeline__time">{item.time}</span>}
              {item.detail === undefined ? null : <span className="omni-timeline__detail">{item.detail}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
