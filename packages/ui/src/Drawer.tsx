'use client';

import { Drawer as Base } from '@base-ui/react/drawer';
import type { ReactNode } from 'react';
import './Button.css';
import './IconButton.css';
import './Drawer.css';
import type { DRAWER_SIDES } from './Drawer.meta.ts';
import { Icon } from './Icon.tsx';

export type DrawerProps = {
  /** The words on the button that opens it. */
  trigger: string;
  /** What the panel holds: its accessible name. */
  title: string;
  /** One line under the title: its accessible description. */
  description?: string;
  /** The edge it slides from: `end` (the right, in a left-to-right page) or `start`. */
  side?: (typeof DRAWER_SIDES)[number];
  /** What its close button says to a screen reader. */
  closeLabel?: string;
  /** The buttons at its foot. */
  actions?: ReactNode;
  /** Whether it is open, when the caller keeps it. */
  open?: boolean;
  /** Whether it starts open, when it keeps that itself. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
};

/** A modal panel at the edge of the page, opened from a button; its focus, keyboard, swipe and dismissal are Base UI's Drawer. */
export function Drawer({ trigger, title, description, side = 'end', closeLabel = 'Close', actions, open, defaultOpen, onOpenChange, children }: DrawerProps) {
  return (
    <Base.Root
      swipeDirection={side === 'end' ? 'right' : 'left'}
      {...(open === undefined ? {} : { open })}
      {...(defaultOpen === undefined ? {} : { defaultOpen })}
      {...(onOpenChange === undefined ? {} : { onOpenChange: (next: boolean) => { onOpenChange(next); } })}
    >
      <Base.Trigger className="omni-button omni-button--secondary omni-button--md">{trigger}</Base.Trigger>
      <Base.Portal>
        <Base.Backdrop className="omni-drawer-scrim" />
        <Base.Popup className={`omni-drawer omni-drawer--${side}`}>
          <div className="omni-drawer__head">
            <Base.Title className="omni-drawer__title">{title}</Base.Title>
            <Base.Close className="omni-icon-button omni-icon-button--quiet" aria-label={closeLabel}>
              <Icon name="close" />
            </Base.Close>
          </div>
          {description === undefined ? null : <Base.Description className="omni-drawer__description">{description}</Base.Description>}
          {children === undefined ? null : <div className="omni-drawer__body">{children}</div>}
          {actions === undefined ? null : <div className="omni-drawer__actions">{actions}</div>}
        </Base.Popup>
      </Base.Portal>
    </Base.Root>
  );
}
