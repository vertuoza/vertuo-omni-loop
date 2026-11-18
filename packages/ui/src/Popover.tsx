'use client';

import { Popover as Base } from '@base-ui/react/popover';
import type { ReactNode } from 'react';
import './Button.css';
import './Popover.css';
import type { POPOVER_SIDES } from './Popover.meta.ts';

export type PopoverProps = {
  /** The words on the button that opens it. */
  trigger: string;
  /** What it says, in a few words: its accessible name. */
  title: string;
  /** Where it opens, beside its button. */
  side?: (typeof POPOVER_SIDES)[number];
  /** Whether it is open, when the caller keeps it. */
  open?: boolean;
  /** Whether it starts open, when it keeps that itself. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
};

/** A small panel beside its button that the page goes on around; its focus, keyboard and dismissal are Base UI's Popover. */
export function Popover({ trigger, title, side = 'bottom', open, defaultOpen, onOpenChange, children }: PopoverProps) {
  return (
    <Base.Root
      {...(open === undefined ? {} : { open })}
      {...(defaultOpen === undefined ? {} : { defaultOpen })}
      {...(onOpenChange === undefined ? {} : { onOpenChange: (next: boolean) => { onOpenChange(next); } })}
    >
      <Base.Trigger className="omni-button omni-button--secondary omni-button--md">{trigger}</Base.Trigger>
      <Base.Portal>
        <Base.Positioner className="omni-popover-positioner" side={side} align="start" sideOffset={8}>
          <Base.Popup className={`omni-popover omni-popover--${side}`}>
            <Base.Title className="omni-popover__title">{title}</Base.Title>
            {children === undefined ? null : <div className="omni-popover__body">{children}</div>}
          </Base.Popup>
        </Base.Positioner>
      </Base.Portal>
    </Base.Root>
  );
}
