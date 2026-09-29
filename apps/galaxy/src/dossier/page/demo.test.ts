import { afterEach, describe, expect, it, vi } from 'vitest';
import { UNREAD } from '../github/summary';
import { DEMO_VIEWER, demoDossier } from './demo';
import { signature, pulseOf } from './live';
import { stageOf } from './stage';
import { dossierView } from './view';

// Demo mode (PRD 426, part 6): with no database, the page shows a built-in sample summary, a PRD with
// open and settled items and no retro, and makes no GitHub call. Its built-in stored stages (PRD 587)
// put it at building, with its questions badge.

const NOW = Date.parse('2026-09-28T10:00:00Z');

afterEach(() => vi.unstubAllGlobals());

describe('the demo dossier\'s GitHub summary', () => {
  it('is a PRD in the outbox stage, with open and settled items and no retro', () => {
    const { dossier, github, slices } = demoDossier(NOW);
    expect(github).toBeTruthy();
    if (!github) return;
    expect(github.repo).toBe(dossier.home_repo);
    expect(github.prd).toBe(dossier.prd);
    expect(github.retro).toBeNull();
    const outbox = github.outbox;
    expect(outbox && outbox !== UNREAD && outbox.open.length).toBeGreaterThan(0);
    expect(outbox && outbox !== UNREAD && outbox.settled.length).toBeGreaterThan(0);
    expect(stageOf(dossier.prd, github, slices ?? null).id).toBe('outbox');
  });

  it('renders the building stage from its stored stages, its questions badge, its button and the Outbox tab, with no GitHub call', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const view = dossierView(demoDossier(NOW), DEMO_VIEWER, { tab: 'outbox', version: null }, NOW);
    expect(view.stage?.words).toBe('Stage: building');
    expect(view.stage?.badge).toEqual({ label: '2 questions waiting', href: 'https://github.com/vertuoza/vertuo-omni-loop/pull/76#issuecomment-4242' });
    expect(view.stage?.synced).toMatch(/^last synced /);
    expect(view.stage?.action).toMatchObject({ kind: 'link', label: 'Answer the outbox' });
    expect(view.stage?.links.map((l) => l.label)).toEqual(['issue #71', 'phase-0 #74', 'feature #76']);
    expect(view.tabs.find((t) => t.kind === 'outbox')).toMatchObject({ badge: '2 open', empty: false });
    expect(view.outbox.state).toBe('items');
    expect(view.outbox.open.map((c) => [c.number, c.rank])).toEqual([[5, 'human-action'], [4, 'high']]);
    expect(view.outbox.settled.length).toBe(2);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reads like a real outbox on the Outbox tab (PRD 251, s9): an answer pending, a medium adopted, and Send off, saying so', () => {
    const { outbox } = dossierView(demoDossier(NOW), DEMO_VIEWER, { tab: 'outbox', version: null }, NOW);
    expect(outbox.open[1].pending).toMatchObject({ by: 'paula', where: 'on GitHub', counted: true });
    expect(outbox.adopted.map((c) => [c.number, c.id])).toEqual([[3, 's2-01-poll-interval']]);
    expect(outbox).toMatchObject({ readOnly: false, sendOff: 'A demo outbox: Send is off here.' });
  });

  it('shows its people as heroes (PRD 652): the opener, who asked and answered, and the outbox\'s @logins, with no GitHub photo', () => {
    const view = dossierView(demoDossier(NOW), DEMO_VIEWER, { tab: 'outbox', version: null }, NOW);
    expect(view.openedBy?.face.kind).toBe('hero');
    const rounds = dossierView(demoDossier(NOW), DEMO_VIEWER, { tab: 'questions', version: null }, NOW).questions.rounds ?? [];
    expect(rounds.map((r) => r.askedBy.face.kind)).toEqual(rounds.map(() => 'hero'));
    expect(rounds.flatMap((r) => (r.answeredBy ? [r.answeredBy.person.face.kind] : []))).toContain('hero');
    const logins = [...view.outbox.open.flatMap((c) => (c.pending ? [c.pending.face] : [])), ...view.outbox.settled.flatMap((e) => (e.by ? [e.face] : []))];
    expect(logins.length).toBeGreaterThan(0);
    expect(JSON.stringify(logins)).not.toContain('github.com');
  });

  it('gives a signature that carries its stage and open outbox count', () => {
    expect(signature(pulseOf(demoDossier(NOW)))).toMatch(/#outbox:2:1@2026-09-26T09:12:00Z$/);
  });
});
