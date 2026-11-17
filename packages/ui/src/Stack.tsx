import type { ReactNode } from 'react';
import './Stack.css';
import type { STACK_ALIGNS, STACK_DIRECTIONS, STACK_GAPS } from './Stack.meta.ts';

export type StackProps = {
  direction?: (typeof STACK_DIRECTIONS)[number];
  /** The step of the space scale between the children: `space-1` to `space-6`. */
  gap?: (typeof STACK_GAPS)[number];
  align?: (typeof STACK_ALIGNS)[number];
  wrap?: boolean;
  children?: ReactNode;
};

/** Lays its children out in a column or a row, a step of the space scale apart. */
export function Stack({ direction = 'column', gap = '3', align = 'stretch', wrap = false, children }: StackProps) {
  const classes = ['omni-stack', `omni-stack--${direction}`, `omni-stack--gap-${gap}`, `omni-stack--align-${align}`];
  if (wrap) classes.push('omni-stack--wrap');
  return <div className={classes.join(' ')}>{children}</div>;
}
