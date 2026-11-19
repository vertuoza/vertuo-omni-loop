import type { MouseEventHandler, ReactNode } from 'react';
import './Link.css';
import type { LINK_VARIANTS } from './Link.meta.ts';

export type LinkProps = {
  href: string;
  variant?: (typeof LINK_VARIANTS)[number];
  /** The link opens in a new window, without handing it this page (an outside site, GitHub). */
  external?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  children?: ReactNode;
};

/** A link inside text or beside it; always underlined, so it never relies on colour. */
export function Link({ href, variant = 'default', external = false, onClick, children }: LinkProps) {
  return (
    <a className={`omni-link omni-link--${variant}`} href={href} onClick={onClick} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {children}
    </a>
  );
}
