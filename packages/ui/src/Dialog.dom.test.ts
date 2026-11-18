// @vitest-environment happy-dom
// The Dialog in a DOM (AC-3): opened from its button, focus moves inside and Tab stays inside;
// Escape closes it and hands focus back to the button. Its catalogue still draws the panel the open
// dialog draws, class for class, so the screenshot on /design is the dialog a person sees.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from './Button.tsx';
import { Dialog } from './Dialog.tsx';
import { dialogSpecimen } from './Dialog.specimen.tsx';

afterEach(cleanup);

/** The class names of `el` and of every element under it, in document order. */
function shape(el: Element): string[] {
  return [el, ...el.querySelectorAll('*')].map((node) => node.getAttribute('class') ?? '').filter((c) => c.startsWith('omni-'));
}

function open() {
  return render(
    createElement(Dialog, {
      trigger: 'Approve the plan',
      title: 'Approve the plan?',
      description: 'The loop builds it once you approve.',
      actions: [createElement(Button, { key: 'no', variant: 'quiet' }, 'Not now'), createElement(Button, { key: 'yes' }, 'Approve')],
    }, 'Five slices, two waves.'),
  );
}

describe('Dialog', () => {
  it('moves focus inside when its button opens it, and Tab stays inside', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: 'Approve the plan' }));
    const dialog = await screen.findByRole('dialog', { name: 'Approve the plan?' });
    await waitFor(() => { expect(dialog.contains(document.activeElement)).toBe(true); });
    expect(dialog.getAttribute('aria-describedby')).not.toBeNull();
    for (let i = 0; i < 6; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement), `tab ${String(i + 1)}`).toBe(true);
    }
    await user.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes on Escape and returns focus to the button that opened it', async () => {
    const user = userEvent.setup();
    open();
    const trigger = screen.getByRole('button', { name: 'Approve the plan' });
    await user.click(trigger);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
    expect(document.activeElement).toBe(trigger);
  });

  it('closes from its close button, named in words', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: 'Approve the plan' }));
    await user.click(await screen.findByRole('button', { name: 'Close' }));
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
  });

  it('opens when its caller says so, and tells the caller when the person closes it', async () => {
    const user = userEvent.setup();
    const asked: boolean[] = [];
    render(createElement(Dialog, { trigger: 'Rename', title: 'Rename the runner', open: true, onOpenChange: (next: boolean) => { asked.push(next); } }));
    await screen.findByRole('dialog', { name: 'Rename the runner' });
    await user.keyboard('{Escape}');
    expect(asked).toEqual([false]);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('draws in its catalogue still the panel the open dialog draws', async () => {
    const user = userEvent.setup();
    const { container } = render(dialogSpecimen('size', 'md'));
    const still = container.querySelector('.omni-dialog-still .omni-dialog');
    expect(still).not.toBeNull();
    expect(container.querySelector('.omni-dialog-still')?.hasAttribute('inert')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Approve the plan' }));
    const live = await screen.findByRole('dialog');
    expect(shape(live)).toEqual(shape(still ?? live));
  });
});
