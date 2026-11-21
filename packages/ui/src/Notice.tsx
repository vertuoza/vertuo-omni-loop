import type { ReactNode } from 'react';
import { Icon } from './Icon.tsx';
import './Notice.css';
import type { NOTICE_TONES } from './Notice.meta.ts';

export type NoticeProps = {
  tone?: (typeof NOTICE_TONES)[number];
  title?: string;
  children?: ReactNode;
};

/** A message the page owes the reader: a tone icon, what happened or what is needed, in a thin full border. */
export function Notice({ tone = 'info', title, children }: NoticeProps) {
  const role = tone === 'danger' || tone === 'warning' ? 'alert' : 'status';
  return (
    <div className={`omni-notice omni-notice--${tone}`} role={role}>
      <span className="omni-notice__icon"><Icon name={`tone-${tone}`} /></span>
      <div className="omni-notice__text">
        {title === undefined ? null : <p className="omni-notice__title">{title}</p>}
        <div className="omni-notice__body">{children}</div>
      </div>
    </div>
  );
}
