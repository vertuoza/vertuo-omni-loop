import { Button } from './Button.tsx';
import { Dialog } from './Dialog.tsx';
import { DIALOG_SIZES } from './Dialog.meta.ts';
import { Icon } from './Icon.tsx';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

const words = {
  trigger: 'Approve the plan',
  title: 'Approve the plan?',
  description: 'The loop builds it once you approve.',
  body: 'Five slices in two waves; nothing merges without you.',
};

const actions = [
  <Button key="no" variant="quiet">Not now</Button>,
  <Button key="yes">Approve</Button>,
];

/**
 * The Dialog's button, which opens the real dialog, and beneath it a still of the open panel on its
 * scrim: an open modal would take the page's focus, so /design and its screenshot show the panel
 * drawn in place, inert, with the classes the open dialog draws (Dialog.dom.test.ts holds them equal).
 */
export const dialogSpecimen: Specimen = (_prop, value) => {
  const size = one(DIALOG_SIZES, value);
  return (
    <div className="omni-dialog-specimen">
      <Dialog trigger={words.trigger} title={words.title} description={words.description} size={size} actions={actions}>{words.body}</Dialog>
      <div className="omni-dialog-still" inert>
        <div className={`omni-dialog omni-dialog--${size}`}>
          <div className="omni-dialog__head">
            <p className="omni-dialog__title">{words.title}</p>
            <button type="button" className="omni-icon-button omni-icon-button--quiet" aria-label="Close"><Icon name="close" /></button>
          </div>
          <p className="omni-dialog__description">{words.description}</p>
          <div className="omni-dialog__body">{words.body}</div>
          <div className="omni-dialog__actions">{actions}</div>
        </div>
      </div>
    </div>
  );
};
