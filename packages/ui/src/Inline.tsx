import type { ReactNode } from 'react';
import './Inline.css';
import type { INLINE_ALIGNS, INLINE_GAPS, INLINE_JUSTIFIES } from './Inline.meta.ts';

export type InlineProps = {
  /** The step of the space scale between the children: `space-1` to `space-5`. */
  gap?: (typeof INLINE_GAPS)[number];
  align?: (typeof INLINE_ALIGNS)[number];
  justify?: (typeof INLINE_JUSTIFIES)[number];
  children?: ReactNode;
};

/** Sets its children side by side on one line, wrapping onto the next when the line is full. */
export function Inline({ gap = '2', align = 'center', justify = 'start', children }: InlineProps) {
  return <div className={`omni-inline omni-inline--gap-${gap} omni-inline--align-${align} omni-inline--justify-${justify}`}>{children}</div>;
}
