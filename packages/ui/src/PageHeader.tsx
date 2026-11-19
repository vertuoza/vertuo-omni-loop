import type { ReactNode } from 'react';
import './PageHeader.css';
import { Menu } from './Menu.tsx';
import type { MenuItem } from './Menu.tsx';
import type { PAGE_HEADER_LEVELS } from './PageHeader.meta.ts';

/** The most facts the meta row holds: a sixth belongs in the side facts. */
export const PAGE_HEADER_META_MAX = 5;

/** At most five facts, each a short phrase that needs no label; a props type with a sixth does not compile. */
export type PageHeaderMeta = readonly [string?, string?, string?, string?, string?];

export type PageHeaderProps = {
  title: string;
  /** A short line above the title: the number or the place. */
  eyebrow?: string;
  /** The subtitle: one sentence under the title. On an item that waits on someone, the next step and who acts. */
  lede?: string;
  /** The state, said once: a Badge. */
  status?: ReactNode;
  /** The facts under the subtitle: at most five, unlabelled, never a state the stage track or the subtitle says. */
  meta?: PageHeaderMeta;
  /** The view's one primary action: a Button. Absent when the viewer is not the one who acts. */
  action?: ReactNode;
  /** Secondary actions, drawn to the left of the primary: Buttons. */
  secondary?: ReactNode;
  /** The Actions menu, for rare actions only (Delete draft, Request a Tech Approval): actions, never sections. */
  actions?: readonly MenuItem[];
  /** Called with the `id` of the action picked in the Actions menu. */
  onAction?: (id: string) => void;
  level?: (typeof PAGE_HEADER_LEVELS)[number];
};

/** The head of a page: what it is, where it stands, and the one thing to do next. */
export function PageHeader({ title, eyebrow, lede, status, meta, action, secondary, actions, onAction, level = '1' }: PageHeaderProps) {
  const heading = level === '1' ? <h1 className="omni-page-header__title">{title}</h1> : <h2 className="omni-page-header__title">{title}</h2>;
  const facts = (meta ?? []).filter((fact): fact is string => fact !== undefined).slice(0, PAGE_HEADER_META_MAX);
  const menu = actions !== undefined && actions.length > 0 ? <Menu trigger="Actions" items={actions} onSelect={(id) => onAction?.(id)} /> : null;
  return (
    <header className="omni-page-header">
      <div className="omni-page-header__text">
        {eyebrow === undefined ? null : <p className="omni-page-header__eyebrow">{eyebrow}</p>}
        <div className="omni-page-header__line">
          {heading}
          {status}
        </div>
        {lede === undefined ? null : <p className="omni-page-header__lede">{lede}</p>}
        {facts.length === 0
          ? null
          : (
            <ul className="omni-page-header__meta">
              {facts.map((fact, index) => <li className="omni-page-header__fact" key={`${String(index)}-${fact}`}>{fact}</li>)}
            </ul>
          )}
      </div>
      {menu === null && secondary === undefined && action === undefined
        ? null
        : (
          <div className="omni-page-header__action">
            {menu}
            {secondary}
            {action}
          </div>
        )}
    </header>
  );
}
