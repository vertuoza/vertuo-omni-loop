// @vitest-environment happy-dom
// The Combobox in a DOM: typing filters its options, the arrow keys move through what is left and
// Enter picks one; Escape closes the list and focus stays in the input. Inside a Field it takes its
// label, its hint and its error from it, as an Input does. Its catalogue still draws the list the open
// combobox draws, class for class, so the screenshot on /design is the list a person sees.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Combobox } from './Combobox.tsx';
import { comboboxSpecimen } from './Combobox.specimen.tsx';
import { Field } from './Field.tsx';

afterEach(cleanup);

/** The class names of `el` and of every element under it, in document order. */
function shape(el: Element): string[] {
  return [el, ...el.querySelectorAll('*')].map((node) => node.getAttribute('class') ?? '').filter((c) => c.startsWith('omni-'));
}

const options = [
  { value: 'spec', label: 'Spec' },
  { value: 'plan', label: 'Plan' },
  { value: 'outbox', label: 'Outbox' },
  { value: 'retro', label: 'Retro' },
];

describe('Combobox', () => {
  it('filters its options as the person types and picks one with Enter', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn<(value: string | null) => void>();
    render(createElement(Combobox, { label: 'Section', options, onValueChange }));
    const input = screen.getByRole('combobox', { name: 'Section' });
    await user.click(input);
    await user.keyboard('o');
    await waitFor(() => { expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Outbox', 'Retro']); });
    await user.keyboard('u');
    await waitFor(() => { expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Outbox']); });
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onValueChange).toHaveBeenLastCalledWith('outbox');
    await waitFor(() => { expect(screen.queryByRole('listbox')).toBeNull(); });
    expect((input as HTMLInputElement).value).toBe('Outbox');
  });

  it('says so when nothing matches', async () => {
    const user = userEvent.setup();
    render(createElement(Combobox, { label: 'Section', options, emptyText: 'No section matches.' }));
    await user.click(screen.getByRole('combobox', { name: 'Section' }));
    await user.keyboard('zz');
    await waitFor(() => { expect(screen.queryAllByRole('option')).toHaveLength(0); });
    expect(screen.getByText('No section matches.')).not.toBeNull();
  });

  it('closes on Escape, focus staying in the input', async () => {
    const user = userEvent.setup();
    render(createElement(Combobox, { label: 'Section', options }));
    const input = screen.getByRole('combobox', { name: 'Section' });
    await user.click(input);
    await screen.findByRole('listbox');
    await user.keyboard('{Escape}');
    await waitFor(() => { expect(screen.queryByRole('listbox')).toBeNull(); });
    expect(document.activeElement).toBe(input);
  });

  it('takes its label, hint and error from the Field around it', () => {
    render(createElement(Field, { label: 'Section', hint: 'Where to go.', error: 'Pick a section.' }, createElement(Combobox, { options })));
    const input = screen.getByRole('combobox', { name: 'Section' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const described = (input.getAttribute('aria-describedby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent);
    expect(described).toEqual(['Where to go.', 'Pick a section.']);
    expect(input.className).toContain('omni-input');
  });

  it('draws in its catalogue still the list the open combobox draws', async () => {
    const user = userEvent.setup();
    const { container } = render(comboboxSpecimen('invalid', 'false'));
    const still = container.querySelector('.omni-combobox-still .omni-combobox');
    expect(still).not.toBeNull();
    expect(container.querySelector('.omni-combobox-still')?.hasAttribute('inert')).toBe(true);
    await user.click(screen.getByRole('combobox'));
    const live = await screen.findByRole('listbox');
    const popup = live.closest('.omni-combobox');
    expect(popup).not.toBeNull();
    expect(shape(popup ?? live)).toEqual(shape(still ?? live));
  });
});
