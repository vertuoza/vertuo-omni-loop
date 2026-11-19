import { Button } from './Button.tsx';
import { Drawer } from './Drawer.tsx';
import { DRAWER_SIDES } from './Drawer.meta.ts';
import { Icon } from './Icon.tsx';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

const words = {
  trigger: 'Filters',
  title: 'Filter the PRDs',
  description: 'Show only what you need.',
  body: 'Open, in a wave, waiting for you.',
};

const actions = <Button>Apply</Button>;

/**
 * The Drawer's button, which opens the real drawer, and beneath it a still of the open panel against
 * its edge, on its scrim: an open modal would take the page's focus, so /design and its screenshot
 * show the panel drawn in place, inert, with the classes the open drawer draws (Drawer.dom.test.ts
 * holds them equal).
 */
export const drawerSpecimen: Specimen = (_prop, value) => {
  const side = one(DRAWER_SIDES, value);
  return (
    <div className="omni-drawer-specimen">
      <Drawer trigger={words.trigger} title={words.title} description={words.description} side={side} actions={actions}>{words.body}</Drawer>
      <div className={`omni-drawer-still omni-drawer-still--${side}`} inert>
        <div className={`omni-drawer omni-drawer--${side}`}>
          <div className="omni-drawer__head">
            <p className="omni-drawer__title">{words.title}</p>
            <button type="button" className="omni-icon-button omni-icon-button--quiet" aria-label="Close"><Icon name="close" /></button>
          </div>
          <p className="omni-drawer__description">{words.description}</p>
          <div className="omni-drawer__body">{words.body}</div>
          <div className="omni-drawer__actions">{actions}</div>
        </div>
      </div>
    </div>
  );
};
