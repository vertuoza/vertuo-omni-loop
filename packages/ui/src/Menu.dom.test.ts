// @vitest-environment happy-dom
// The Menu in a DOM (AC-3): opened from its button, the arrow keys move between its items, Enter
// picks one, and Escape closes it and hands focus back to the button. Its catalogue still draws the
// list the open menu draws, class for class, so the screenshot on /design is the menu a person sees.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Menu } from './Menu.tsx';
import { menuSpecimen } from './Menu.specimen.tsx';

afterEach(cleanup);

/** The class names of `el` and of every element under it, in document order. */
function shape(el: Element): string[] {
  return [el, ...el.querySelectorAll('*')].map((node) => node.getAttribute('class') ?? '').filter((c) => c.startsWith('omni-'));
}

const items = [
  { id: 'rename', label: 'Rename' },
  { id: 'copy', label: 'Copy the link' },
  { id: 'archive', label: 'Archive', tone: 'danger' as const },
];

describe('Menu', () => {
  it('AC-3: closes on Escape and returns focus to the button that opened it', async () => {
    const user = userEvent.setup();
    render(createElement(Menu, { trigger: 'Actions', items }));
    const trigger = screen.getByRole('button', { name: 'Actions' });
    await user.click(trigger);
    await screen.findByRole('menu');
    await user.keyboard('{Escape}');
    await waitFor(() => { expect(screen.queryByRole('menu')).toBeNull(); });
    expect(document.activeElement).toBe(trigger);
  });

  it('opens from its button with the keyboard, moves with the arrow keys and picks with Enter', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn<(id: string) => void>();
    render(createElement(Menu, { trigger: 'Actions', items, onSelect }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Actions' }));
    await user.keyboard('{ArrowDown}');
    await screen.findByRole('menu');
    await waitFor(() => { expect(document.activeElement?.textContent).toBe('Rename'); });
    await user.keyboard('{ArrowDown}');
    await waitFor(() => { expect(document.activeElement?.textContent).toBe('Copy the link'); });
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('copy');
    await waitFor(() => { expect(screen.queryByRole('menu')).toBeNull(); });
  });

  it('draws each item as a menuitem, and a link item as a link', async () => {
    const user = userEvent.setup();
    render(createElement(Menu, { trigger: 'Actions', items: [...items, { id: 'open', label: 'Open the PR', href: '#pr' }] }));
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await screen.findByRole('menu');
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Rename', 'Copy the link', 'Archive', 'Open the PR']);
    expect(screen.getByRole('menuitem', { name: 'Open the PR' }).getAttribute('href')).toBe('#pr');
    expect(screen.getByRole('menuitem', { name: 'Archive' }).className).toContain('omni-menu__item--danger');
  });

  it('draws in its catalogue still the list the open menu draws', async () => {
    const user = userEvent.setup();
    const { container } = render(menuSpecimen('tone', 'danger'));
    const still = container.querySelector('.omni-menu-still .omni-menu');
    expect(still).not.toBeNull();
    expect(container.querySelector('.omni-menu-still')?.hasAttribute('inert')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    const live = await screen.findByRole('menu');
    expect(shape(live)).toEqual(shape(still ?? live));
  });
});
