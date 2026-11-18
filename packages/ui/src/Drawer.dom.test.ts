// @vitest-environment happy-dom
// The Drawer in a DOM: opened from its button, focus moves inside and Tab stays inside; Escape
// closes it and hands focus back to the button. Its catalogue still draws the panel the open
// drawer draws, class for class, so the screenshot on /design is the drawer a person sees.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createElement } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Button } from './Button.tsx';
import { Drawer } from './Drawer.tsx';
import { drawerSpecimen } from './Drawer.specimen.tsx';

afterEach(cleanup);

/** What the drawer printed as an error while this file ran. */
const errors: string[] = [];
beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation((message: unknown) => { errors.push(String(message)); });
});
afterAll(() => { vi.restoreAllMocks(); });

/** The class names of `el` and of every element under it, in document order. */
function shape(el: Element): string[] {
  return [el, ...el.querySelectorAll('*')].map((node) => node.getAttribute('class') ?? '').filter((c) => c.startsWith('omni-'));
}

function open() {
  return render(
    createElement(Drawer, {
      trigger: 'Filters',
      title: 'Filter the PRDs',
      description: 'Show only what you need.',
      actions: createElement(Button, null, 'Apply'),
    }, 'Open, in a wave, waiting for you.'),
  );
}

describe('Drawer', () => {
  it('moves focus inside when its button opens it, and Tab stays inside', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    const drawer = await screen.findByRole('dialog', { name: 'Filter the PRDs' });
    await waitFor(() => { expect(drawer.contains(document.activeElement)).toBe(true); });
    for (let i = 0; i < 5; i++) {
      await user.tab();
      expect(drawer.contains(document.activeElement), `tab ${String(i + 1)}`).toBe(true);
    }
    await user.tab({ shift: true });
    expect(drawer.contains(document.activeElement)).toBe(true);
  });

  it('closes on Escape and returns focus to the button that opened it', async () => {
    const user = userEvent.setup();
    open();
    const trigger = screen.getByRole('button', { name: 'Filters' });
    await user.click(trigger);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
    expect(document.activeElement).toBe(trigger);
  });

  it('slides from the side it names', async () => {
    const user = userEvent.setup();
    render(createElement(Drawer, { trigger: 'Menu', title: 'Menu', side: 'start' }, 'Home'));
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    expect((await screen.findByRole('dialog')).getAttribute('class')).toContain('omni-drawer--start');
  });

  it('draws in its catalogue still the panel the open drawer draws', async () => {
    const user = userEvent.setup();
    const { container } = render(drawerSpecimen('side', 'end'));
    const still = container.querySelector('.omni-drawer-still .omni-drawer');
    expect(still).not.toBeNull();
    expect(container.querySelector('.omni-drawer-still')?.hasAttribute('inert')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    const live = await screen.findByRole('dialog');
    expect(shape(live)).toEqual(shape(still ?? live));
  });

  // Base UI says each missing part once per run, so every error since the file began is read here, last.
  it('opens with every part Base UI expects, so swipe and touch scroll locking work', () => {
    expect(errors).toEqual([]);
  });
});
