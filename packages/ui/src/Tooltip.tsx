'use client';

import type { IconName } from '@omni/design';
import { Tooltip as Base } from '@base-ui/react/tooltip';
import type { MouseEventHandler } from 'react';
import './IconButton.css';
import './Tooltip.css';
import type { TOOLTIP_SIDES } from './Tooltip.meta.ts';
import { Icon } from './Icon.tsx';

export type TooltipProps = {
  /** The icon of the button it hints at. */
  icon: IconName;
  /** What the button does, in words: the button's accessible name and the hint it shows. Required. */
  label: string;
  /** Where the hint shows, beside its button. */
  side?: (typeof TOOLTIP_SIDES)[number];
  onClick?: MouseEventHandler<HTMLElement>;
};

/**
 * An icon button whose label shows as a hint on hover and on focus; its timing and dismissal are
 * Base UI's Tooltip. The hint repeats the button's name for sighted people: it is never the only
 * place the words are, so a screen reader and a touch screen lose nothing.
 */
export function Tooltip({ icon, label, side = 'top', onClick }: TooltipProps) {
  return (
    <Base.Root>
      <Base.Trigger className="omni-icon-button omni-icon-button--quiet" aria-label={label} onClick={onClick}>
        <Icon name={icon} />
      </Base.Trigger>
      <Base.Portal>
        <Base.Positioner className="omni-tooltip-positioner" side={side} sideOffset={6}>
          <Base.Popup className={`omni-tooltip omni-tooltip--${side}`}>{label}</Base.Popup>
        </Base.Positioner>
      </Base.Portal>
    </Base.Root>
  );
}
