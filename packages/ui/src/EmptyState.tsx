import type { ReactNode } from 'react';
import './EmptyState.css';
import type { EMPTY_STATE_SIZES } from './EmptyState.meta.ts';

export type EmptyStateProps = {
  title: string;
  size?: (typeof EMPTY_STATE_SIZES)[number];
  /** What the person can do about it: a Button. */
  action?: ReactNode;
  children?: ReactNode;
};

/** What a section says when it holds nothing yet: why, and what to do. */
export function EmptyState({ title, size = 'page', action, children }: EmptyStateProps) {
  return (
    <div className={`omni-empty-state omni-empty-state--${size}`}>
      <p className="omni-empty-state__title">{title}</p>
      {children === undefined ? null : <div className="omni-empty-state__body">{children}</div>}
      {action === undefined ? null : <div className="omni-empty-state__action">{action}</div>}
    </div>
  );
}
