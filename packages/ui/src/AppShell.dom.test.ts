// @vitest-environment happy-dom
// The shell parts in a DOM: the skip link moves focus to the main landmark, the navigation names each
// entry by its text, and the Breadcrumb marks only its last crumb as the current page.
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppShell } from './AppShell.tsx';
import { Breadcrumb } from './Breadcrumb.tsx';
import { FilterBar } from './FilterBar.tsx';

afterEach(cleanup);

const navigation = [
  { id: 'home', label: 'Home', href: '/', icon: 'home' },
  { id: 'prds', label: 'PRDs', href: '/prds', icon: 'prds' },
] as const;

describe('AppShell', () => {
  it('AC-1: the skip link moves focus to the main landmark', async () => {
    const user = userEvent.setup();
    render(createElement(AppShell, { navigation, current: 'home' }, 'Page body'));
    await user.tab();
    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(document.activeElement).toBe(skip);
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(screen.getByRole('main'));
  });

  it('names each navigation entry by its text and marks the current one', () => {
    render(createElement(AppShell, { navigation, current: 'prds' }, 'Page body'));
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(nav.querySelectorAll('svg').length).toBe(2);
    expect(screen.getByRole('link', { name: 'PRDs' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBeNull();
  });

  it('contained draws no main landmark', () => {
    render(createElement(AppShell, { navigation, contained: true }, 'Page body'));
    expect(screen.queryByRole('main')).toBeNull();
  });
});

describe('Breadcrumb', () => {
  it('is a nav with aria-current on the last crumb alone', () => {
    render(createElement(Breadcrumb, { items: [{ label: 'PRDs', href: '/prds' }, { label: 'PRD 12' }] }));
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy();
    expect(screen.getByText('PRD 12').getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'PRDs' }).getAttribute('aria-current')).toBeNull();
  });
});

describe('FilterBar', () => {
  it('names the group and every control it holds', () => {
    render(createElement(FilterBar, {
      label: 'Filter PRDs',
      search: { label: 'Search' },
      selects: [{ label: 'Repository', name: 'repo', options: [{ value: 'a', label: 'A' }] }],
      segments: { label: 'State', options: [{ id: 'all', label: 'All' }] },
    }));
    expect(screen.getByRole('group', { name: 'Filter PRDs' })).toBeTruthy();
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Repository' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'State' })).toBeTruthy();
  });
});
