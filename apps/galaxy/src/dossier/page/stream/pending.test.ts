import { describe, expect, it } from 'vitest';
import { DEMO_GITHUB, DEMO_VIEWER, demoDossier } from '../demo';
import { dossierView } from '../view';
import { GITHUB_PENDING, pendingView } from './pending';

// A PRD's page before GitHub has answered (PRD 657 s4): what the database gave stays, what only
// GitHub knows says it is being read.

const NOW = Date.parse('2026-09-29T10:00:00Z');
const read = demoDossier(NOW);
const withGithub = dossierView({ ...read, github: DEMO_GITHUB, stages: read.stages ?? [] }, DEMO_VIEWER, { tab: 'outbox', version: null });
const pending = pendingView(dossierView({ ...read, github: undefined, stages: read.stages ?? [] }, DEMO_VIEWER, { tab: 'outbox', version: null }));

describe('a PRD\'s page before GitHub answers', () => {
  it('keeps what the database gave: the heading, the title, the tabs, the questions', () => {
    expect(pending.heading).toBe(withGithub.heading);
    expect(pending.title).toBe(withGithub.title);
    expect(pending.tabs.map((t) => t.kind)).toEqual(withGithub.tabs.map((t) => t.kind));
    expect(pending.questions).toEqual(withGithub.questions);
    expect(pending.tab).toBe('outbox');
  });

  it('says the Outbox and the Retro are being read, never empty or unreadable', () => {
    expect(withGithub.outbox.state).toBe('items');
    expect(pending.outbox).toMatchObject({ state: 'empty', words: GITHUB_PENDING, open: [], settled: [] });
    expect(pending.retro).toEqual({ state: 'empty', words: GITHUB_PENDING, prUrl: null, text: null });
  });

  it('counts nothing on the GitHub tabs yet, and keeps the other badges', () => {
    const badge = (view: typeof pending, kind: string) => view.tabs.find((t) => t.kind === kind)?.badge;
    expect(badge(withGithub, 'outbox')).not.toBeNull();
    expect(badge(pending, 'outbox')).toBeNull();
    expect(badge(pending, 'retro')).toBeNull();
    expect(badge(pending, 'questions')).toBe(badge(withGithub, 'questions'));
  });

  it('draws the stored stage, without the GitHub links', () => {
    expect(pending.stage?.id).toBeDefined();
    expect(pending.stage?.links).toEqual([]);
  });
});
