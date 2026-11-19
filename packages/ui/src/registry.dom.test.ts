// @vitest-environment happy-dom
// The DOM the parts' keyboard tests run in: every registered part mounts in it through Testing
// Library, each variant once, and Base UI's focus model holds in it (a dialog opened from a button
// takes focus, closes on Escape and hands focus back), the behaviour every overlay part inherits.
import { Dialog } from '@base-ui/react/dialog';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { PARTS } from './generated/catalogue.ts';

afterEach(cleanup);

describe('@omni/ui mounts in a DOM', () => {
  for (const { meta, specimen } of PARTS) {
    it(`${meta.name}: every variant mounts`, () => {
      for (const [prop, values] of Object.entries(meta.variants)) {
        for (const value of values) {
          const { container, unmount } = render(specimen(prop, value));
          expect(container.querySelector('[class^="omni-"]'), `${prop}=${value}`).not.toBeNull();
          unmount();
        }
      }
    });
  }
});

describe('Base UI in the parts\' DOM', () => {
  it('opens a dialog from its button, closes it on Escape and returns focus to the button', async () => {
    const user = userEvent.setup();
    render(
      createElement(Dialog.Root, null,
        createElement(Dialog.Trigger, null, 'Open'),
        createElement(Dialog.Portal, null,
          createElement(Dialog.Popup, null,
            createElement(Dialog.Title, null, 'Approve the plan'),
            createElement(Dialog.Close, null, 'Close')))),
    );
    const trigger = screen.getByRole('button', { name: 'Open' });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => { expect(dialog.contains(document.activeElement)).toBe(true); });
    await user.keyboard('{Escape}');
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
    expect(document.activeElement).toBe(trigger);
  });
});
