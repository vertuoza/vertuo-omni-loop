// @vitest-environment happy-dom
// SettingsField in a DOM, in light and dark: reachable by label, help and error announced with the
// control, and the disabled-by-permission state said in words.
import { cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Input } from './Input.tsx';
import { NOT_AN_OWNER, SettingsField } from './SettingsField.tsx';

afterEach(cleanup);

describe.each(['light', 'dark'])('SettingsField in %s', (theme) => {
  const show = (props: Record<string, unknown>) =>
    render(createElement('div', { 'data-theme': theme }, createElement(SettingsField, { label: 'Name', ...props }, createElement(Input, { name: 'name' }))));

  it('AC-2: the control is reached by its label and described by the help', () => {
    show({ help: 'As it shows on the page.' });
    const control = screen.getByLabelText('Name');
    const help = screen.getByText('As it shows on the page.');
    expect(control.getAttribute('aria-describedby')).toContain(help.id);
  });

  it('AC-2: an error is shown, announced with the control and marks it invalid', () => {
    show({ help: 'Help.', error: 'Enter a name.' });
    const control = screen.getByLabelText('Name');
    expect(control.getAttribute('aria-invalid')).toBe('true');
    expect(control.getAttribute('aria-describedby')).toContain(screen.getByText('Enter a name.').id);
  });

  it('AC-4: disabled by permission, the control is disabled and the field says why in words', () => {
    show({ help: 'Help.', disabledByPermission: true });
    const control = screen.getByLabelText('Name');
    // a disabled fieldset disables the controls inside it; happy-dom does not apply that to :disabled.
    expect(control.closest('fieldset')?.hasAttribute('disabled')).toBe(true);
    const why = screen.getByText(`Help. ${NOT_AN_OWNER}`);
    expect(control.getAttribute('aria-describedby')).toContain(why.id);
  });

  it('AC-4: allowed, the control is enabled and no reason is shown', () => {
    show({});
    expect(screen.getByLabelText('Name').closest('fieldset')).toBeNull();
    expect(screen.queryByText(/Read only/)).toBeNull();
  });
});
