import './OutboxItem.css';
import { Badge } from './Badge.tsx';
import { ListRow } from './ListRow.tsx';
import type { OUTBOX_LEVELS } from './OutboxItem.meta.ts';

export type OutboxItemProps = {
  level: (typeof OUTBOX_LEVELS)[number];
  /** The question, in plain words. */
  title: string;
  detail?: string;
  /** With an `href` the whole row is one link. */
  href?: string;
};

const LEVELS = {
  low: { tone: 'neutral', word: 'Low' },
  medium: { tone: 'warning', word: 'Medium' },
  high: { tone: 'danger', word: 'High' },
} as const;

/** One item of the outbox: its question, its detail, and its level as a Badge. */
export function OutboxItem({ level, title, detail, href }: OutboxItemProps) {
  const { tone, word } = LEVELS[level];
  return (
    <div className="omni-outbox-item">
      <ListRow title={title} {...(detail === undefined ? {} : { detail })} {...(href === undefined ? {} : { href })} trailing={<Badge tone={tone}>{word}</Badge>} />
    </div>
  );
}
