import type { ReactNode } from 'react';
import './Code.css';
import type { CODE_DISPLAYS } from './Code.meta.ts';

export type CodeProps = {
  /** `inline` sits in a line of text; `block` is its own block, its line breaks kept. */
  display?: (typeof CODE_DISPLAYS)[number];
  children?: ReactNode;
};

/** A piece of code, a command or a path, set in the monospace face. */
export function Code({ display = 'inline', children }: CodeProps) {
  if (display === 'block') {
    return (
      <pre className="omni-code omni-code--block">
        <code>{children}</code>
      </pre>
    );
  }
  return <code className="omni-code omni-code--inline">{children}</code>;
}
