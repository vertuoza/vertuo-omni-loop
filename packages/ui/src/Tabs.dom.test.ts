// @vitest-environment happy-dom
// Tabs: a count as a mono pill, yellow when it waits on the viewer, and an empty tab that stays, dimmed,
// not a link, its reason as its title; the tabs the PRD page passes today draw exactly as before.
import { cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { Tabs } from './Tabs.tsx';

afterEach(cleanup);

const items = [
  { id: 'brainstorm', label: 'Brainstorm', href: '#b', count: '5/5' },
  { id: 'spec', label: 'Specifications', href: '#s', count: '3/7' },
  { id: 'outbox', label: 'Outbox', href: '#o', count: '2 open', attention: true },
  { id: 'retro', label: 'Retro', href: '#r', empty: 'Written when the feature PR merges' },
];

describe('Tabs', () => {
  it('draws a count as a mono pill, and turns it yellow when it waits on the viewer', () => {
    const { container } = render(createElement(Tabs, { label: 'PRD', items, current: 'spec' }));
    const pills = [...container.querySelectorAll('.omni-tab__count')];
    expect(pills.map((pill) => pill.textContent)).toEqual(['5/5', '3/7', '2 open']);
    expect(pills.map((pill) => pill.classList.contains('omni-tab__count--attention'))).toEqual([false, false, true]);
  });

  it('keeps an empty tab, dimmed, not a link, its reason as its title', () => {
    render(createElement(Tabs, { label: 'PRD', items, current: 'spec' }));
    expect(screen.queryByRole('link', { name: /Retro/ })).toBeNull();
    const retro = screen.getByText('Retro');
    expect(retro.className).toContain('omni-tab--empty');
    expect(retro.getAttribute('aria-disabled')).toBe('true');
    expect(retro.getAttribute('title')).toBe('Written when the feature PR merges');
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });

  it('keeps the current tab a link even when it is empty, so the reader sees where they are', () => {
    render(createElement(Tabs, { label: 'PRD', items, current: 'retro' }));
    expect(screen.getByRole('link', { name: 'Retro' }).getAttribute('aria-current')).toBe('page');
  });

  it('draws the tabs it was given before counts existed exactly as before', () => {
    const html = renderToStaticMarkup(createElement(Tabs, { label: 'Artifacts', current: 'b', items: [{ id: 'a', label: 'A', href: '/a' }, { id: 'b', label: 'B', href: '/b' }] }));
    expect(html).toBe('<nav class="omni-tabs omni-tabs--md" aria-label="Artifacts"><a class="omni-tab" href="/a">A</a><a class="omni-tab omni-tab--current" href="/b" aria-current="page">B</a></nav>');
  });
});
