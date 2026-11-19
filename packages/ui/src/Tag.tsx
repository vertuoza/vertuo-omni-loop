import type { ReactNode } from 'react';
import './Tag.css';
import type { TAG_TONES } from './Tag.meta.ts';

export type TagProps = {
  tone?: (typeof TAG_TONES)[number];
  children?: ReactNode;
};

/** A square-cornered label that files a thing under a topic or a kind. It takes no action. */
export function Tag({ tone = 'neutral', children }: TagProps) {
  return <span className={`omni-tag omni-tag--${tone}`}>{children}</span>;
}
