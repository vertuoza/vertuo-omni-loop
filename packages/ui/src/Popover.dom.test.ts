// @vitest-environment happy-dom
// The Popover in a DOM (AC-3): opened from its button, focus moves inside; Escape closes it and
// hands focus back to the button; a click outside closes it. Its catalogue still draws the panel
// the open popover draws, class for class, so the screenshot on /design is the popover a person sees.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createElement, Fragment } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Popover } from './Popover.tsx';
import { popoverSpecimen } from './Popover.specimen.tsx';

afterEach(cleanup);

/** The class names of `el` and of every element under it, in document order. */
function shape(el: Element): string[] {
  return [el, ...el.querySelectorAll('*')].map((node) => node.getAttribute('class') ?? '').filter((c) => c.startsWith('omni-'));
}

function open() {
  return render(
    createElement(Fragment, null,
      createElement('p', null, 'Outside'),
      createElement(Popover, { trigger: 'Who answers?', title: 'Who answers' },
        createElement('a', { href: '#people' }, 'The people of this PRD'))),
  );
}

describe('Popover', () => {
  it('moves focus inside when its button opens it', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: 'Who answers?' }));
    const popover = await screen.findByRole('dialog', { name: 'Who answers' });
    await waitFor(() => { expect(popover.contains(document.activeElement)).toBe(true); });
  });

  it('closes on Escape and returns focus to the button that opened it', async () => {
    const user = userEvent.setup();
    open();
    const trigger = screen.getByRole('button', { name: 'Who answers?' });
    await user.click(trigger);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on a click outside it', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: 'Who answers?' }));
    await screen.findByRole('dialog');
    await user.click(screen.getByText('Outside'));
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
  });

  it('draws in its catalogue still the panel the open popover draws', async () => {
    const user = userEvent.setup();
    const { container } = render(popoverSpecimen('side', 'bottom'));
    const still = container.querySelector('.omni-popover-still .omni-popover');
    expect(still).not.toBeNull();
    expect(container.querySelector('.omni-popover-still')?.hasAttribute('inert')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Who answers?' }));
    const live = await screen.findByRole('dialog');
    expect(shape(live)).toEqual(shape(still ?? live));
  });
});
