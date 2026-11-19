import type { ReactNode } from 'react';
import './ErrorState.css';
import type { ERROR_STATE_SIZES } from './ErrorState.meta.ts';

export type ErrorStateProps = {
  /** What failed, in plain words. */
  title: string;
  size?: (typeof ERROR_STATE_SIZES)[number];
  /** The one thing to try: a Button. */
  action?: ReactNode;
  /** Why, and what it means for the person. */
  children?: ReactNode;
};

/** What a section says when what it shows could not be loaded or done: what failed, and one action. */
export function ErrorState({ title, size = 'page', action, children }: ErrorStateProps) {
  return (
    <div className={`omni-error-state omni-error-state--${size}`} role="alert">
      <p className="omni-error-state__title">{title}</p>
      {children === undefined ? null : <div className="omni-error-state__body">{children}</div>}
      {action === undefined ? null : <div className="omni-error-state__action">{action}</div>}
    </div>
  );
}
