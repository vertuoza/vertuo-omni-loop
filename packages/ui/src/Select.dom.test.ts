// @vitest-environment happy-dom
// The Select in a DOM: it opens our own list by click and by keyboard, the arrows and typing move the
// highlight, Enter picks and calls onValueChange; Escape and an outside click close it with focus back
// on the trigger; the list is a listbox of options with only the picked one aria-selected; a form
// posts name=value; inside a Field it takes its label, hint and error from it.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field } from './Field.tsx';
import { Select } from './Select.tsx';
import { selectSpecimen } from './Select.specimen.tsx';

afterEach(cleanup);

const roles = [
  { value: 'dev', label: 'Developer' },
  { value: 'pm', label: 'Product' },
  { value: 'design', label: 'Design' },
];
const greek = [
  { value: 'alpha', label: 'Alpha' },
  { value: 'beta', label: 'Beta' },
  { value: 'gamma', label: 'Gamma' },
];

describe('Select', () => {
  it('opens by keyboard, checks the picked option and picks the next one with Enter (AC-1)', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn<(value: string) => void>();
    render(createElement(Select, { label: 'Role', options: roles, defaultValue: 'pm', onValueChange }));
    const trigger = screen.getByRole('combobox', { name: 'Role' });
    expect(trigger.textContent).toContain('Product');
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    const list = await screen.findByRole('listbox');
    const picked = screen.getByRole('option', { name: 'Product' });
    expect(picked.getAttribute('aria-selected')).toBe('true');
    expect(picked.querySelector('svg')).not.toBeNull();
    expect(list).not.toBeNull();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onValueChange).toHaveBeenCalledWith('design');
    await waitFor(() => { expect(screen.queryByRole('listbox')).toBeNull(); });
    expect(document.activeElement).toBe(trigger);
  });

  it('jumps by typing, closes on Escape and on an outside click, the value unchanged (AC-2)', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn<(value: string) => void>();
    render(createElement('div', null, createElement('button', { type: 'button' }, 'outside'), createElement(Select, { label: 'Letter', options: greek, defaultValue: 'alpha', onValueChange })));
    const trigger = screen.getByRole('combobox', { name: 'Letter' });
    await user.click(trigger);
    await screen.findByRole('listbox');
    await user.keyboard('g');
    await waitFor(() => { expect(screen.getByRole('option', { name: 'Gamma' }).hasAttribute('data-highlighted')).toBe(true); });
    await user.keyboard('{Escape}');
    await waitFor(() => { expect(screen.queryByRole('listbox')).toBeNull(); });
    expect(document.activeElement).toBe(trigger);
    await user.click(trigger);
    await screen.findByRole('listbox');
    await user.click(screen.getByRole('button', { name: 'outside' }));
    await waitFor(() => { expect(screen.queryByRole('listbox')).toBeNull(); });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(trigger.textContent).toContain('Alpha');
  });

  it('picks with the mouse and calls onValueChange with the value', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn<(value: string) => void>();
    render(createElement(Select, { label: 'Role', options: roles, onValueChange }));
    await user.click(screen.getByRole('combobox', { name: 'Role' }));
    await user.click(await screen.findByRole('option', { name: 'Design' }));
    expect(onValueChange).toHaveBeenCalledWith('design');
  });

  it('posts name=value in a form (AC-3)', async () => {
    const user = userEvent.setup();
    const { container } = render(createElement('form', null, createElement(Select, { label: 'Role', name: 'role', options: roles, defaultValue: 'dev' })));
    const form = container.querySelector('form');
    if (form === null) throw new Error('no form');
    expect(new FormData(form).get('role')).toBe('dev');
    await user.click(screen.getByRole('combobox', { name: 'Role' }));
    await user.click(await screen.findByRole('option', { name: 'Product' }));
    await waitFor(() => { expect(new FormData(form).get('role')).toBe('pm'); });
  });

  it('is a list box of options inside a Field, named, described and invalid (AC-4)', async () => {
    const user = userEvent.setup();
    render(createElement(Field, { label: 'Role', hint: 'What you do.', error: 'Pick a role.' }, createElement(Select, { options: roles, defaultValue: 'pm' })));
    const trigger = screen.getByRole('combobox', { name: 'Role' });
    expect(trigger.getAttribute('aria-invalid')).toBe('true');
    const described = (trigger.getAttribute('aria-describedby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent);
    expect(described).toEqual(['What you do.', 'Pick a role.']);
    await user.click(trigger);
    await screen.findByRole('listbox');
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options.filter((o) => o.getAttribute('aria-selected') === 'true').map((o) => o.textContent)).toEqual(['Product']);
  });

  it('shows the placeholder while nothing is picked, and wears the sm size', () => {
    render(createElement(Select, { label: 'Role', options: roles, placeholder: 'Pick one', size: 'sm' }));
    const trigger = screen.getByRole('combobox', { name: 'Role' });
    expect(trigger.textContent).toContain('Pick one');
    expect(trigger.className).toContain('omni-select__trigger--sm');
  });

  it('takes disabled and invalid', () => {
    render(createElement(Select, { label: 'Role', options: roles, disabled: true, invalid: true }));
    const trigger = screen.getByRole('combobox', { name: 'Role' });
    expect(trigger.hasAttribute('disabled') || trigger.getAttribute('aria-disabled') === 'true').toBe(true);
    expect(trigger.getAttribute('aria-invalid')).toBe('true');
  });

  it('draws in its catalogue still the open list, inert', () => {
    const { container } = render(selectSpecimen('invalid', 'false'));
    const still = container.querySelector('.omni-select-still');
    expect(still?.hasAttribute('inert')).toBe(true);
    expect(still?.querySelectorAll('.omni-select__item')).toHaveLength(3);
    expect(still?.querySelector('[data-highlighted]')?.textContent).toBe('Design');
  });
});
