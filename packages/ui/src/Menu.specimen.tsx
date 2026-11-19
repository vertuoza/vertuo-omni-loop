import { Menu } from './Menu.tsx';
import type { MenuItem } from './Menu.tsx';
import { MENU_SIDES, MENU_TONES } from './Menu.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

const actions: readonly MenuItem[] = [
  { id: 'rename', label: 'Rename' },
  { id: 'copy', label: 'Copy the link' },
  { id: 'archive', label: 'Archive' },
];

/** The same actions, the last one in the danger tone. */
const withDanger: readonly MenuItem[] = [...actions.slice(0, 2), { id: 'delete', label: 'Delete the draft', tone: 'danger' }];

/**
 * The Menu's button, which opens the real menu, and on the side it opens a still of the open list,
 * its first item highlighted as the arrow keys leave it: an open menu would float over the page and
 * take its focus, so /design and its screenshot show the list drawn in place, inert, with the classes
 * the open menu draws (Menu.dom.test.ts holds them equal).
 */
export const menuSpecimen: Specimen = (prop, value) => {
  const side = prop === 'side' ? one(MENU_SIDES, value) : 'bottom';
  const items = prop === 'tone' && one(MENU_TONES, value) === 'danger' ? withDanger : actions;
  return (
    <div className={`omni-menu-specimen omni-menu-specimen--${side}`}>
      <Menu trigger="Actions" items={items} side={side} />
      <div className="omni-menu-still" inert>
        <div className={`omni-menu omni-menu--${side}`}>
          {items.map((item, index) => (
            <div key={item.id} className={`omni-menu__item omni-menu__item--${item.tone ?? 'neutral'}`} {...(index === 0 ? { 'data-highlighted': '' } : {})}>{item.label}</div>
          ))}
        </div>
      </div>
    </div>
  );
};
