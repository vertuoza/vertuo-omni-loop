import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Board, Job, Runner } from '../runners.contract';
import type { RunnersPageView } from './model';
import { RunnersPage } from './RunnersPage';

// The runner card's repositories button and the drawer `?repos=` opens (PRD 3232 s4).

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const NOW = new Date('2027-01-20T12:00:00Z');
const id = (n: number) => `00000000-0000-4000-8000-00000000c${String(n).padStart(3, '0')}`;
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const REPOS = Array.from({ length: 17 }, (_, at) => `acme/repo-${String(16 - at).padStart(2, '0')}`);
const BOX: Runner = { id: id(1), name: 'box-1', owner: id(900), fleet: null, slots: 3, used: 0, repos: REPOS, version: '0.0.640', lastSeenAt: NOW.toISOString(), state: 'online', githubApp: true };
const queued = (n: number, repo: string): Job => ({
  id: id(10 + n), line: `/omni:wave ${String(n)}`, repo, toRunner: null, toFleet: null, sentBy: null, sentByLogin: 'ada', sentByKey: null, status: 'queued', runner: null,
  cancelRequested: false, logTail: '', prUrl: null, exitCode: null, reason: null, queuedAt: NOW.toISOString(), claimedAt: null, runningAt: null, endedAt: null,
});
const JOBS = [queued(1, 'acme/repo-14'), queued(2, 'acme/repo-03'), queued(3, 'acme/repo-09')];

function page(repos: string | null): string {
  const board: Board = { runners: [BOX], jobs: JOBS, saves: [], viewer: { id: id(900), owner: true, fleet: null } };
  const view: RunnersPageView = { kind: 'board', name: 'Acme', board, fleets: [], prds: {}, now: NOW.toISOString(), answered: [] };
  return renderToStaticMarkup(createElement(RunnersPage, { view, supabase: null, signinError: null, jobs: 'all', repos }));
}

describe('the repositories button', () => {
  it('AC-7: reads 17 repositories · 3 with jobs instead of the list', () => {
    const html = page(null);
    expect(text(html)).toContain('17 repositories · 3 with jobs');
    expect(html).not.toContain('repo-16 · repo-15');
    expect(html).not.toContain('data-screen="runner-repositories"');
  });
});

describe('the drawer', () => {
  const html = page('box-1');

  it('AC-7: opens on `?repos=<runner>` with its name, its count, its search and its foot', () => {
    expect(html).toContain('data-screen="runner-repositories"');
    expect(text(html)).toContain('box-1 17 repositories this runner holds');
    expect(html).toContain('type="search"');
    expect(text(html)).toContain('Last job: among the last 50 only.');
  });

  it('AC-7: lists the three busy repositories first, then the others A to Z', () => {
    const order = [...html.matchAll(/data-repo="([^"]+)"/g)].map((match) => match[1]);
    expect(order.slice(0, 5)).toEqual(['acme/repo-03', 'acme/repo-09', 'acme/repo-14', 'acme/repo-00', 'acme/repo-01']);
    expect(order).toHaveLength(17);
    expect(text(html)).toContain('1 queued');
    expect(text(html)).toContain('Only on this runner');
  });

  it('opens nothing for an unknown runner name', () => {
    expect(page('nobody')).not.toContain('data-screen="runner-repositories"');
  });
});
