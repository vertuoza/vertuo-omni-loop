// @vitest-environment happy-dom
// Omni's own parts in a DOM: the stage track says each stage in words, the references are links named by
// the thing they point at, and an outbox item shows its level as a Badge.
import { cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { OutboxItem } from './OutboxItem.tsx';
import { PersonRef } from './PersonRef.tsx';
import { PrdRef } from './PrdRef.tsx';
import { RepoRef } from './RepoRef.tsx';
import { StageTrack } from './StageTrack.tsx';

afterEach(cleanup);

describe('StageTrack', () => {
  it('names every stage and its state in words, and marks the current one', () => {
    render(createElement(StageTrack, { stage: 'Building' }));
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(7);
    expect(items[0]?.textContent).toContain('Idea (done)');
    expect(items[3]?.textContent).toContain('Building (current)');
    expect(items[3]?.getAttribute('aria-current')).toBe('step');
    expect(items[6]?.textContent).toContain('Retro (pending)');
  });
});

describe('PrdRef, RepoRef and PersonRef', () => {
  it('are links with their name as text', () => {
    render(createElement('div', null,
      createElement(PrdRef, { number: 12, title: 'Parts', href: '/prd/12' }),
      createElement(RepoRef, { owner: 'demo-org', name: 'omni' }),
      createElement(PersonRef, { name: 'Ada Lovelace', href: '/people/ada' })));
    expect(screen.getByRole('link', { name: 'PRD 12 Parts' }).getAttribute('href')).toBe('/prd/12');
    const repo = screen.getByRole('link', { name: 'demo-org/omni' });
    expect(repo.getAttribute('href')).toBe('https://github.com/demo-org/omni');
    expect(repo.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getByRole('link', { name: 'Ada Lovelace' }).getAttribute('href')).toBe('/people/ada');
  });
});

describe('OutboxItem', () => {
  it('shows its level as a word', () => {
    const { container } = render(createElement(OutboxItem, { level: 'high', title: 'Keep the old route?', detail: 'PRD 12', href: '/outbox/1' }));
    expect(container.querySelector('.omni-badge')?.textContent).toBe('High');
    expect(screen.getByRole('link').textContent).toContain('Keep the old route?');
  });
});
