import type { ReactNode } from 'react';
import './Prose.css';
import type { PROSE_MEASURES } from './Prose.meta.ts';

export type ProseProps = {
  /** How wide a line may run: `reading` keeps it to a comfortable length, `full` fills the space. */
  measure?: (typeof PROSE_MEASURES)[number];
  children?: ReactNode;
};

/** Long text a person reads: paragraphs, lists and links set at a readable size, line length and rhythm. */
export function Prose({ measure = 'reading', children }: ProseProps) {
  return <div className={`omni-prose omni-prose--${measure}`}>{children}</div>;
}
