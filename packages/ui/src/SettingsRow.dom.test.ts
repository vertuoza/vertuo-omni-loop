// @vitest-environment happy-dom
// The settings parts in a DOM, in light and dark: the header names the page, a section groups rows under
// a heading, and a read-only row says why in words.
import { cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { SettingsHeader } from './SettingsHeader.tsx';
import { SettingsRow } from './SettingsRow.tsx';
import { SettingsSection } from './SettingsSection.tsx';

afterEach(cleanup);

describe.each(['light', 'dark'])('settings parts in %s', (theme) => {
  const inTheme = (child: ReturnType<typeof createElement>) => createElement('div', { 'data-theme': theme }, child);

  it('AC-1: the header is the h1 of the page with its description', () => {
    render(inTheme(createElement(SettingsHeader, { title: 'Workspace settings', description: 'Who can see it.' })));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Workspace settings');
    expect(screen.getByText('Who can see it.')).toBeTruthy();
  });

  it('AC-1: a section groups its rows under a heading', () => {
    render(inTheme(createElement(SettingsSection, { title: 'Access' }, createElement(SettingsRow, { label: 'Visibility' }, 'Private'))));
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Access');
    expect(screen.getByRole('group', { name: 'Visibility' }).textContent).toBe('Private');
  });

  it('AC-5: a read-only row says why in words, and its control is described by it', () => {
    render(inTheme(createElement(SettingsRow, { label: 'Visibility', readOnly: true, reason: 'only an owner can change it.' }, 'Private')));
    const reason = screen.getByText('Read only: only an owner can change it.');
    expect(screen.getByRole('group', { name: 'Visibility' }).getAttribute('aria-describedby')).toBe(reason.id);
  });

  it('AC-5: an editable row shows no reason', () => {
    render(inTheme(createElement(SettingsRow, { label: 'Visibility', reason: 'ignored' }, 'Private')));
    expect(screen.queryByText(/Read only/)).toBeNull();
    expect(screen.getByRole('group', { name: 'Visibility' }).getAttribute('aria-describedby')).toBeNull();
  });
});
