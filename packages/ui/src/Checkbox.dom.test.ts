// @vitest-environment happy-dom
// The choice parts in a DOM: a Field names and describes each, Space toggles a Checkbox and a Switch,
// and the arrow keys move a Radio.
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Checkbox } from './Checkbox.tsx';
import { Field } from './Field.tsx';
import { Radio } from './Radio.tsx';
import { Switch } from './Switch.tsx';

afterEach(cleanup);

const options = [
  { value: 'team', label: 'Team' },
  { value: 'workspace', label: 'Workspace' },
  { value: 'public', label: 'Public' },
];

describe('Checkbox', () => {
  it('is named by its Field, described by its hint and error, and invalid with the error', () => {
    render(createElement(Field, { label: 'Include archived', hint: 'Hidden otherwise', error: 'Pick one.' }, createElement(Checkbox, { name: 'a' })));
    const box = screen.getByRole('checkbox', { name: 'Include archived' });
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect((box.getAttribute('aria-describedby') ?? '').split(' ')).toEqual([screen.getByText('Hidden otherwise').id, screen.getByText('Pick one.').id]);
  });

  it('toggles with Space', async () => {
    const user = userEvent.setup();
    render(createElement(Field, { label: 'Include archived' }, createElement(Checkbox, { name: 'a' })));
    const box = screen.getByRole<HTMLInputElement>('checkbox', { name: 'Include archived' });
    await user.tab();
    expect(document.activeElement).toBe(box);
    await user.keyboard(' ');
    expect(box.checked).toBe(true);
    await user.keyboard(' ');
    expect(box.checked).toBe(false);
  });

  it('takes no toggle while disabled, and a standalone one needs its own label', async () => {
    const user = userEvent.setup();
    render(createElement(Checkbox, { label: 'Agree', disabled: true }));
    const box = screen.getByRole<HTMLInputElement>('checkbox', { name: 'Agree' });
    await user.click(box);
    expect(box.checked).toBe(false);
  });
});

describe('Switch', () => {
  it('is a switch named by its Field, and Space flips it', async () => {
    const user = userEvent.setup();
    render(createElement(Field, { label: 'Email me', hint: 'Daily' }, createElement(Switch, { name: 'e' })));
    const toggle = screen.getByRole<HTMLInputElement>('switch', { name: 'Email me' });
    expect(toggle.getAttribute('aria-describedby')).toBe(screen.getByText('Daily').id);
    await user.tab();
    await user.keyboard(' ');
    expect(toggle.checked).toBe(true);
    await user.keyboard(' ');
    expect(toggle.checked).toBe(false);
  });
});

describe('Radio', () => {
  it('is a group named by its label and described by its Field, invalid with the error', () => {
    render(createElement(Field, { label: 'Who can see it', hint: 'Later too', error: 'Pick one.' }, createElement(Radio, { label: 'Who can see it', name: 'who', options })));
    const group = screen.getByRole('radiogroup', { name: 'Who can see it' });
    expect(group.getAttribute('aria-invalid')).toBe('true');
    expect((group.getAttribute('aria-describedby') ?? '').split(' ')).toEqual([screen.getByText('Later too').id, screen.getByText('Pick one.').id]);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('moves and chooses with the arrow keys', async () => {
    const user = userEvent.setup();
    render(createElement(Field, { label: 'Who' }, createElement(Radio, { label: 'Who', name: 'who', options, defaultValue: 'team' })));
    const team = screen.getByRole<HTMLInputElement>('radio', { name: 'Team' });
    team.focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Workspace' }).checked).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Workspace' }));
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Public' }).checked).toBe(true);
  });

  it('keeps the choice the caller gives', () => {
    render(createElement(Radio, { label: 'Who', name: 'who', options, value: 'public', onChange: () => undefined }));
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Public' }).checked).toBe(true);
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Team' }).checked).toBe(false);
  });
});
