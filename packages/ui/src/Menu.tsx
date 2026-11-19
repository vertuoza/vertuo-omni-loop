'use client';

import { Menu as Base } from '@base-ui/react/menu';
import './Button.css';
import './Menu.css';
import type { MENU_SIDES, MENU_TONES } from './Menu.meta.ts';
import { Icon } from './Icon.tsx';

/** One action of a Menu: an `id` handed to `onSelect`, or an `href` it follows. */
export type MenuItem = {
  id: string;
  /** What it does, in words. */
  label: string;
  /** A link to follow instead of an action. */
  href?: string;
  /** `danger` for the item that destroys, or cannot be undone. */
  tone?: (typeof MENU_TONES)[number];
  disabled?: boolean;
};

export type MenuProps = {
  /** The words on the button that opens it. */
  trigger: string;
  items: readonly MenuItem[];
  /** Called with the `id` of the action picked. */
  onSelect?: (id: string) => void;
  /** Where it opens, beside its button. */
  side?: (typeof MENU_SIDES)[number];
  /** Whether it is open, when the caller keeps it. */
  open?: boolean;
  /** Whether it starts open, when it keeps that itself. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/** A list of actions behind one button; its focus, keyboard and dismissal are Base UI's Menu. */
export function Menu({ trigger, items, onSelect, side = 'bottom', open, defaultOpen, onOpenChange }: MenuProps) {
  return (
    <Base.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <Base.Trigger className="omni-button omni-button--secondary omni-button--md">
        {trigger}
        <Icon name={side === 'top' ? 'chevron-up' : 'chevron-down'} />
      </Base.Trigger>
      <Base.Portal>
        <Base.Positioner className="omni-menu-positioner" side={side} align="start" sideOffset={8}>
          <Base.Popup className={`omni-menu omni-menu--${side}`}>
            {items.map((item) => {
              const className = `omni-menu__item omni-menu__item--${item.tone ?? 'neutral'}`;
              return item.href === undefined
                ? <Base.Item key={item.id} className={className} disabled={item.disabled} onClick={() => onSelect?.(item.id)}>{item.label}</Base.Item>
                : <Base.LinkItem key={item.id} className={className} href={item.href}>{item.label}</Base.LinkItem>;
            })}
          </Base.Popup>
        </Base.Positioner>
      </Base.Portal>
    </Base.Root>
  );
}
