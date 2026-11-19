import type { IconName } from '@omni/design';
import type { MouseEventHandler } from 'react';
import './IconButton.css';
import type { ICON_BUTTON_VARIANTS } from './IconButton.meta.ts';
import { Icon } from './Icon.tsx';

export type IconButtonProps = {
  icon: IconName;
  /** What the button does, in words: its accessible name and what hovering it says. Required. */
  label: string;
  variant?: (typeof ICON_BUTTON_VARIANTS)[number];
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
};

/** A button that is one icon; its label is what a screen reader says. */
export function IconButton({ icon, label, variant = 'secondary', type = 'button', disabled = false, onClick }: IconButtonProps) {
  return (
    <button className={`omni-icon-button omni-icon-button--${variant}`} type={type} aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      <Icon name={icon} />
    </button>
  );
}
