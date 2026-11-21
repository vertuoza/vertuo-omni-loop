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
import { FIX_STAGES } from './StageTrack.meta.ts';
import { StageTrack, stageSince } from './StageTrack.tsx';

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

  it('says the current stage with its progress, in the accent tone while agents work', () => {
    const { container } = render(createElement(StageTrack, { stage: 'Building', progress: '3 of 7 slices', share: 3 / 7 }));
    const current = container.querySelector('[aria-current="step"]');
    expect(current?.querySelector('.omni-stage-track__name')?.textContent).toBe('Building · 3 of 7 slices');
    expect(current?.className).toContain('omni-stage-track__stage--working');
    expect(current?.querySelector('.omni-stage-track__fill rect')?.getAttribute('width')).toBe('43');
  });

  it('turns the current stage to the signal tone while it waits on the viewer', () => {
    const { container } = render(createElement(StageTrack, { stage: 'PRD', progress: 'waits for approval', tone: 'waiting' }));
    const current = container.querySelector('[aria-current="step"]');
    expect(current?.className).toContain('omni-stage-track__stage--waiting');
    expect(current?.textContent).toContain('PRD · waits for approval');
    expect(container.querySelectorAll('.omni-stage-track__stage--working')).toHaveLength(0);
  });

  it('gives a stage its time as hover text', () => {
    render(createElement(StageTrack, { stage: 'Building', times: { Building: 'Building since 17 Nov 09:40 UTC · 10.2 h' } }));
    expect(screen.getAllByRole('listitem')[3]?.getAttribute('title')).toBe('Building since 17 Nov 09:40 UTC · 10.2 h');
    expect(screen.getAllByRole('listitem')[0]?.getAttribute('title')).toBeNull();
  });

  it('draws a fix\'s stages with the same part', () => {
    render(createElement(StageTrack, { stages: FIX_STAGES, stage: 'Approved', label: 'Fix stage' }));
    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.querySelector('.omni-stage-track__name')?.textContent)).toEqual(['Asked', 'Picked', 'Approved', 'Merged', 'Released']);
    expect(items[1]?.textContent).toContain('(done)');
    expect(items[2]?.getAttribute('aria-current')).toBe('step');
    expect(screen.getByRole('list', { name: 'Fix stage' })).toBeTruthy();
  });
});

describe('stageSince', () => {
  it('words a stage\'s time: since when, in UTC, and for how long', () => {
    expect(stageSince('Building', new Date('2026-11-17T09:40:00Z'), new Date('2026-11-17T19:52:00Z'))).toBe('Building since 17 Nov 09:40 UTC · 10.2 h');
    expect(stageSince('Outbox', new Date('2026-11-01T00:05:00Z'), new Date('2026-11-04T00:05:00Z'))).toBe('Outbox since 1 Nov 00:05 UTC · 3.0 d');
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
