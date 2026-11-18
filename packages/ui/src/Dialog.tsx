'use client';

import { Dialog as Base } from '@base-ui/react/dialog';
import type { ReactNode } from 'react';
import './Button.css';
import './IconButton.css';
import './Dialog.css';
import type { DIALOG_SIZES } from './Dialog.meta.ts';
import { Icon } from './Icon.tsx';

export type DialogProps = {
  /** The words on the button that opens it. */
  trigger: string;
  /** The question it asks: its accessible name. */
  title: string;
  /** One line under the title: its accessible description. */
  description?: string;
  size?: (typeof DIALOG_SIZES)[number];
  /** What its close button says to a screen reader. */
  closeLabel?: string;
  /** The buttons that answer it, at its foot. */
  actions?: ReactNode;
  /** Whether it is open, when the caller keeps it. */
  open?: boolean;
  /** Whether it starts open, when it keeps that itself. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
};

/** A modal question opened from a button; its focus, keyboard and dismissal are Base UI's Dialog. */
export function Dialog({ trigger, title, description, size = 'md', closeLabel = 'Close', actions, open, defaultOpen, onOpenChange, children }: DialogProps) {
  return (
    <Base.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
    >
      <Base.Trigger className="omni-button omni-button--secondary omni-button--md">{trigger}</Base.Trigger>
      <Base.Portal>
        <Base.Backdrop className="omni-dialog-scrim" />
        <Base.Popup className={`omni-dialog omni-dialog--${size}`}>
          <div className="omni-dialog__head">
            <Base.Title className="omni-dialog__title">{title}</Base.Title>
            <Base.Close className="omni-icon-button omni-icon-button--quiet" aria-label={closeLabel}>
              <Icon name="close" />
            </Base.Close>
          </div>
          {description === undefined ? null : <Base.Description className="omni-dialog__description">{description}</Base.Description>}
          {children === undefined ? null : <div className="omni-dialog__body">{children}</div>}
          {actions === undefined ? null : <div className="omni-dialog__actions">{actions}</div>}
        </Base.Popup>
      </Base.Portal>
    </Base.Root>
  );
}
