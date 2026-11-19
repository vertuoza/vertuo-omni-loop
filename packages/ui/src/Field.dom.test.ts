// @vitest-environment happy-dom
// The text field parts in a DOM: a Field ties its label, hint and error to the control inside it, and
// each control types, picks and reports its invalid state.
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Field } from './Field.tsx';
import { Input } from './Input.tsx';
import { Select } from './Select.tsx';
import { Textarea } from './Textarea.tsx';

afterEach(cleanup);

const options = [
  { value: 'dev', label: 'Developer' },
  { value: 'pm', label: 'Product' },
];

describe('Field', () => {
  it('names the control by its label and describes it by its hint', () => {
    render(createElement(Field, { label: 'Name', hint: 'As on the page' }, createElement(Input, { name: 'name' })));
    const input = screen.getByLabelText('Name');
    expect(input.tagName).toBe('INPUT');
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByText('As on the page').id);
  });

  it('marks the control invalid and describes it by its hint and its error', () => {
    render(createElement(Field, { label: 'Name', hint: 'As on the page', error: 'Enter a name.' }, createElement(Input, { name: 'name' })));
    const input = screen.getByLabelText('Name');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const ids = (input.getAttribute('aria-describedby') ?? '').split(' ');
    expect(ids).toEqual([screen.getByText('As on the page').id, screen.getByText('Enter a name.').id]);
  });

  it('marks a required control as required, in words too', () => {
    render(createElement(Field, { label: 'Name', required: true }, createElement(Input, { name: 'name' })));
    expect(screen.getByLabelText<HTMLInputElement>(/Name/).required).toBe(true);
    expect(screen.getByText('(required)')).toBeTruthy();
  });

  it('works the same around a Textarea and a Select', () => {
    render(createElement(Field, { label: 'Why', error: 'Say why.' }, createElement(Textarea, { name: 'why' })));
    expect(screen.getByLabelText('Why').tagName).toBe('TEXTAREA');
    expect(screen.getByLabelText('Why').getAttribute('aria-invalid')).toBe('true');
    cleanup();
    render(createElement(Field, { label: 'Role', hint: 'Pick one' }, createElement(Select, { options })));
    expect(screen.getByLabelText('Role').tagName).toBe('SELECT');
    expect(screen.getByLabelText('Role').getAttribute('aria-describedby')).toBe(screen.getByText('Pick one').id);
  });
});

describe('Input, Textarea and Select', () => {
  it('stand alone with their own label, and take typing', async () => {
    const user = userEvent.setup();
    render(createElement(Input, { label: 'Search' }));
    const input = screen.getByRole('textbox', { name: 'Search' });
    await user.type(input, 'omni');
    expect((input as HTMLInputElement).value).toBe('omni');
    cleanup();
    render(createElement(Textarea, { label: 'Comment' }));
    await user.type(screen.getByRole('textbox', { name: 'Comment' }), 'a{Enter}b');
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Comment' }).value).toBe('a\nb');
  });

  it('reports an invalid value of their own, and a disabled one takes no typing', async () => {
    const user = userEvent.setup();
    render(createElement(Input, { label: 'Search', invalid: true, disabled: true }));
    const input = screen.getByRole('textbox', { name: 'Search' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    await user.type(input, 'x');
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('lets a Select pick with the keyboard', async () => {
    const user = userEvent.setup();
    render(createElement(Select, { label: 'Role', options }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Role' }), 'pm');
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Role' }).value).toBe('pm');
  });
});
