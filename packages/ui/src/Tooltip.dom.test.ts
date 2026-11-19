// @vitest-environment happy-dom
// The Tooltip in a DOM: it shows on focus, hides on Escape, and never names its button in its stead
// (the button carries the same words as its label). Its catalogue still draws the hint the open
// tooltip draws, class for class, so the screenshot on /design is the tooltip a person sees.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Tooltip } from './Tooltip.tsx';
import { tooltipSpecimen } from './Tooltip.specimen.tsx';

afterEach(cleanup);

/** The class names of `el` and of every element under it, in document order. */
function shape(el: Element): string[] {
  return [el, ...el.querySelectorAll('*')].map((node) => node.getAttribute('class') ?? '').filter((c) => c.startsWith('omni-'));
}

/** The open hint, once it shows. */
async function hint(): Promise<HTMLElement> {
  return waitFor(() => {
    const popup = document.querySelector<HTMLElement>('.omni-tooltip');
    expect(popup).not.toBeNull();
    return popup as HTMLElement;
  });
}

describe('Tooltip', () => {
  it('names its button with its label', () => {
    render(createElement(Tooltip, { icon: 'search', label: 'Search the PRDs' }));
    expect(screen.getByRole('button', { name: 'Search the PRDs' })).not.toBeNull();
    expect(document.querySelector('.omni-tooltip')).toBeNull();
  });

  it('shows on focus and hides on Escape, focus staying on its button', async () => {
    const user = userEvent.setup();
    render(createElement(Tooltip, { icon: 'search', label: 'Search the PRDs' }));
    await user.tab();
    const button = screen.getByRole('button', { name: 'Search the PRDs' });
    expect(document.activeElement).toBe(button);
    expect((await hint()).textContent).toBe('Search the PRDs');
    await user.keyboard('{Escape}');
    await waitFor(() => { expect(document.querySelector('.omni-tooltip')).toBeNull(); });
    expect(document.activeElement).toBe(button);
  });

  it('draws in its catalogue still the hint the open tooltip draws', async () => {
    const user = userEvent.setup();
    const { container } = render(tooltipSpecimen('side', 'top'));
    const still = container.querySelector('.omni-tooltip-still .omni-tooltip');
    expect(still).not.toBeNull();
    expect(container.querySelector('.omni-tooltip-still')?.hasAttribute('inert')).toBe(true);
    await user.tab();
    const live = await waitFor(() => {
      const open = document.body.querySelector(':not(.omni-tooltip-still) > .omni-tooltip-positioner > .omni-tooltip');
      expect(open).not.toBeNull();
      return open as Element;
    });
    expect(shape(live)).toEqual(shape(still ?? live));
  });
});
