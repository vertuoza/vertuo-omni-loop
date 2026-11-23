'use client';

import { Popover as Base } from '@base-ui/react/popover';
import type { IconName } from '@omni/design';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon.tsx';
import './IconButton.css';
import './Button.css';
import './Popover.css';
import type { POPOVER_OPEN_ON, POPOVER_SIDES } from './Popover.meta.ts';

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
  /** `hover`: it also opens when the pointer rests on its button or the button takes keyboard focus, and closes when they leave. Click by default. */
  openOn?: (typeof POPOVER_OPEN_ON)[number];
  /** With `openOn="hover"`: the button is a quiet icon button named by `trigger`, not a labelled one. */
  triggerIcon?: IconName;
  children?: ReactNode;
};

/** A small panel beside its button that the page goes on around; its focus, keyboard and dismissal are Base UI's Popover. */
export function Popover({ trigger, title, side = 'bottom', open, defaultOpen, onOpenChange, openOn = 'click', triggerIcon, children }: PopoverProps) {
  const hover = openOn === 'hover';
  const [kept, setKept] = useState(defaultOpen ?? false);
  const change = (next: boolean) => {
    setKept(next);
    onOpenChange?.(next);
  };
  const state = hover ? { open: open ?? kept, onOpenChange: change } : { open, defaultOpen, onOpenChange };
  const triggerProps = hover
    ? {
        openOnHover: true,
        onFocus: (event: { currentTarget: Element }) => {
          if (event.currentTarget.matches(':focus-visible')) change(true);
        },
        onBlur: (event: { relatedTarget: EventTarget | null }) => {
          if (!(event.relatedTarget instanceof Element && event.relatedTarget.closest('.omni-popover') !== null)) change(false);
        },
      }
    : {};
  const asIcon = hover && triggerIcon !== undefined;
  return (
    <Base.Root {...state}>
      <Base.Trigger
        className={asIcon ? 'omni-icon-button omni-icon-button--quiet' : 'omni-button omni-button--secondary omni-button--md'}
        {...(asIcon ? { 'aria-label': trigger } : {})}
        {...triggerProps}
      >
        {asIcon ? <Icon name={triggerIcon} /> : trigger}
      </Base.Trigger>
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
