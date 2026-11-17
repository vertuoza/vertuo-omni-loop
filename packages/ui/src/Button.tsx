import type { MouseEventHandler, ReactNode } from 'react';
import './Button.css';
import type { BUTTON_SIZES, BUTTON_VARIANTS } from './Button.meta.ts';

export type ButtonProps = {
  variant?: (typeof BUTTON_VARIANTS)[number];
  size?: (typeof BUTTON_SIZES)[number];
  /** With an `href` the button is a link that looks like one. */
  href?: string;
  /** With an `href`: the link opens in a new window, without handing it this page (an outside site, GitHub). */
  external?: boolean;
  /** What hovering it says: the command a copy button copies. */
  title?: string;
  /** A button that opens a panel says whether it is open. */
  expanded?: boolean;
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  children?: ReactNode;
};

/** An action. A `primary` one is the view's one main action; the other variants stay quiet beside it. */
export function Button({ variant = 'secondary', size = 'md', href, external = false, title, expanded, type = 'button', disabled = false, onClick, children }: ButtonProps) {
  const className = `omni-button omni-button--${variant} omni-button--${size}`;
  // The view's one main action is marked for the design checks (`design.words.primary`), as every primary was before @omni/ui.
  const primary = variant === 'primary' ? { 'data-primary': '' } : {};
  if (href !== undefined && !disabled) {
    return (
      <a className={className} href={href} title={title} {...primary} onClick={onClick} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {children}
      </a>
    );
  }
  return (
    <button className={className} type={type} disabled={disabled} title={title} aria-expanded={expanded} {...primary} onClick={onClick}>
      {children}
    </button>
  );
}
