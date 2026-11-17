import type { MouseEventHandler, ReactNode } from 'react';
import './Button.css';
import type { BUTTON_SIZES, BUTTON_VARIANTS } from './Button.meta.ts';

export type ButtonProps = {
  variant?: (typeof BUTTON_VARIANTS)[number];
  size?: (typeof BUTTON_SIZES)[number];
  /** With an `href` the button is a link that looks like one. */
  href?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  children?: ReactNode;
};

/** An action. A `primary` one is the view's one main action; the other variants stay quiet beside it. */
export function Button({ variant = 'secondary', size = 'md', href, type = 'button', disabled = false, onClick, children }: ButtonProps) {
  const className = `omni-button omni-button--${variant} omni-button--${size}`;
  if (href !== undefined && !disabled) {
    return (
      <a className={className} href={href} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <button className={className} type={type} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
