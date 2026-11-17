import type { ReactNode } from 'react';
import './PageHeader.css';
import type { PAGE_HEADER_LEVELS } from './PageHeader.meta.ts';

export type PageHeaderProps = {
  title: string;
  /** A short line above the title: the number or the place. */
  eyebrow?: string;
  /** A line under the title. */
  lede?: string;
  /** The state, said once: a Badge. */
  status?: ReactNode;
  /** The view's one primary action: a Button. */
  action?: ReactNode;
  level?: (typeof PAGE_HEADER_LEVELS)[number];
};

/** The head of a page: what it is, where it stands, and the one thing to do next. */
export function PageHeader({ title, eyebrow, lede, status, action, level = '1' }: PageHeaderProps) {
  const heading = level === '1' ? <h1 className="omni-page-header__title">{title}</h1> : <h2 className="omni-page-header__title">{title}</h2>;
  return (
    <header className="omni-page-header">
      <div className="omni-page-header__text">
        {eyebrow === undefined ? null : <p className="omni-page-header__eyebrow">{eyebrow}</p>}
        <div className="omni-page-header__line">
          {heading}
          {status}
        </div>
        {lede === undefined ? null : <p className="omni-page-header__lede">{lede}</p>}
      </div>
      {action === undefined ? null : <div className="omni-page-header__action">{action}</div>}
    </header>
  );
}
