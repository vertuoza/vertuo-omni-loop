import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { present } from '../../ask/test-item';
import type { FixSummary } from '../../dossier/github/fix';
import type { DossierRef, FixReader, FixRef } from '../../dossier/github/reader';
import type { GithubSummary } from '../../dossier/github/summary';
import { fakeFixFactsStore } from '../../fixes/facts/store.fake';
import { fakePrdOutboxStore } from '../outbox/store.fake';
import { settled } from '../settled';
import { fakeStageStore } from '../store.fake';
import { syncConfig, type RepoSnapshot } from './core';
import { syncStages, type SyncDeps, type SyncWorkspace } from './sync';

// POST /api/stages/sync (PRD 587, s2), on the store's fake and a fake reader: never GitHub, never a
// database. Two workspaces; the reader answers from the snapshots each test gives.

const SECRET = 'sync-secret-0123456789';
const NOW = '2026-09-29T12:00:00.000Z';
const CONFIG = syncConfig('kit: 1\nrepo:\n  slug: acme/widgets\n', 'acme/widgets');

const ACME: SyncWorkspace = { id: 'w-acme', slug: 'acme', github_org: 'acme', github_installation_id: 11 };
const GLOBEX: SyncWorkspace = { id: 'w-globex', slug: 'globex', github_org: 'globex', github_installation_id: 22 };

const snap = (repository: string, more: Partial<RepoSnapshot> = {}): RepoSnapshot => ({
  repository, config: CONFIG, inbox: [], shipped: [], issues: [], pulls: [], ...more,
});

function deps(more: Partial<SyncDeps> = {}, repos: Record<string, string[]> = { acme: ['acme/widgets', 'acme/gears'], globex: ['globex/core'] }) {
  const store = fakeStageStore(() => NOW);
  const snapshots: Record<string, RepoSnapshot | Error> = {
    'acme/widgets': snap('acme/widgets', { shipped: ['0042-dark-mode'], issues: [{ number: 42, created_at: '2026-09-18T00:00:00Z' }] }),
    'acme/gears': snap('acme/gears', { inbox: ['0007-teeth'] }),
    'globex/core': snap('globex/core', { issues: [{ number: 3, created_at: '2026-09-27T00:00:00Z' }] }),
  };
  const lines: string[] = [];
  const d: SyncDeps = {
    secret: SECRET,
    workspaces: () => Promise.resolve([ACME, GLOBEX]),
    repositories: (w) => Promise.resolve(repos[w.slug] ?? []),
    snapshot: (_w, repo) => settled(() => {
      const s = snapshots[repo];
      if (s instanceof Error) throw s;
      return present(s, `the snapshot of ${repo}`);
    }),
    store,
    now: () => NOW,
    log: (line) => lines.push(line),
    ...more,
  };
  return { d, store, snapshots, lines };
}

/** The route's answer, read through a schema: every key it sends is kept. */
const Answer = z.looseObject({
  repositories: z.array(z.looseObject({ repository: z.string() })),
  skipped: z.array(z.unknown()),
});
const answerOf = async (res: Response) => Answer.parse(await res.json());

const post = (auth?: string) => new Request('http://galaxy.test/api/stages/sync', {
  method: 'POST', headers: auth === undefined ? {} : { authorization: auth },
});

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

describe('the stages sync route', () => {
  it('refuses a missing or wrong bearer with 401, and writes nothing', async () => {
    for (const auth of [undefined, 'Bearer nope', SECRET, `Basic ${SECRET}`, 'Bearer ']) {
      const { d, store } = deps();
      const res = await syncStages(post(auth), d);
      expect(res.status).toBe(401);
      expect(store.writes).toEqual([]);
    }
  });

  it('refuses every call with 401 while the deployment has no secret', async () => {
    const { d, store } = deps({ secret: undefined });
    expect((await syncStages(post('Bearer '), d)).status).toBe(401);
    expect((await syncStages(post('Bearer undefined'), d)).status).toBe(401);
    expect(store.writes).toEqual([]);
  });

  it('records every stage and topic of every workspace\'s repositories, and names the counts per repository', async () => {
    const { d, store } = deps();
    const res = await syncStages(post(`Bearer ${SECRET}`), d);
    expect(res.status).toBe(200);
    const body: unknown = await res.json();
    expect(body).toEqual({
      synced_at: NOW,
      repositories: [
        { workspace: 'acme', repository: 'acme/widgets', stages: 2, topics: 1 },
        { workspace: 'acme', repository: 'acme/gears', stages: 1, topics: 1 },
        { workspace: 'globex', repository: 'globex/core', stages: 1, topics: 0 },
      ],
      skipped: [],
    });
    expect(store.stages.map((s) => `${s.workspace_id} ${s.repository}#${s.prd} ${s.stage} ${s.reached_at}`).sort()).toEqual([
      'w-acme acme/gears#7 inbox 2026-09-29T12:00:00.000Z',
      'w-acme acme/widgets#42 prd 2026-09-18T00:00:00Z',
      'w-acme acme/widgets#42 shipped 2026-09-29T12:00:00.000Z',
      'w-globex globex/core#3 prd 2026-09-27T00:00:00Z',
    ]);
    expect(store.topics).toEqual([
      { workspace_id: 'w-acme', repository: 'acme/widgets', prd: 42, topic: 'dark-mode' },
      { workspace_id: 'w-acme', repository: 'acme/gears', prd: 7, topic: 'teeth' },
    ]);
  });

  it('logs and skips a repository it cannot read, while the others land', async () => {
    const { d, store, snapshots, lines } = deps();
    snapshots['acme/widgets'] = new Error('GitHub answered 502 to /pulls');
    const body = await answerOf(await syncStages(post(`Bearer ${SECRET}`), d));
    expect(body.skipped).toEqual([{ workspace: 'acme', repository: 'acme/widgets', reason: 'GitHub answered 502 to /pulls' }]);
    expect(body.repositories.map((r) => r.repository)).toEqual(['acme/gears', 'globex/core']);
    expect(store.stages.some((s) => s.repository === 'acme/widgets')).toBe(false);
    expect(store.stages.some((s) => s.repository === 'acme/gears')).toBe(true);
    expect(lines.some((l) => l.includes('acme/widgets') && l.includes('502'))).toBe(true);
  });

  it('skips a workspace whose repositories cannot be listed, while the others land', async () => {
    const { d, store } = deps({
      repositories: (w) => settled(() => {
        if (w.slug === 'acme') throw new Error('the App is not installed');
        return ['globex/core'];
      }),
    });
    const body = await answerOf(await syncStages(post(`Bearer ${SECRET}`), d));
    expect(body.skipped).toEqual([{ workspace: 'acme', repository: null, reason: 'the App is not installed' }]);
    expect(store.stages.map((s) => s.repository)).toEqual(['globex/core']);
  });

  it('writes nothing new on a rerun', async () => {
    const { d, store } = deps();
    await syncStages(post(`Bearer ${SECRET}`), d);
    const first = [...store.writes];
    const later = { ...d, now: () => '2026-09-29T12:15:00.000Z' };
    expect((await syncStages(post(`Bearer ${SECRET}`), later)).status).toBe(200);
    expect(store.writes).toEqual(first);
    expect(store.stages.find((s) => s.repository === 'acme/gears')).toMatchObject({ reached_at: NOW, synced_at: '2026-09-29T12:15:00.000Z' });
  });

  it('reads a repository in full on its first sync, then only what changed since it, five minutes early', async () => {
    const seen: [string, string | null | undefined][] = [];
    const { d } = deps();
    const base = { ...d };
    d.snapshot = (w, repo, since) => { seen.push([repo, since]); return base.snapshot(w, repo, since); };
    await syncStages(post(`Bearer ${SECRET}`), d);
    await syncStages(post(`Bearer ${SECRET}`), { ...d, now: () => '2026-09-29T12:15:00.000Z' });
    expect(seen).toEqual([
      ['acme/widgets', null], ['acme/gears', null], ['globex/core', null],
      // acme/gears holds no PRD issue: nothing tells when it was last synced, so it is read in full again.
      ['acme/widgets', '2026-09-29T11:55:00.000Z'], ['acme/gears', null], ['globex/core', '2026-09-29T11:55:00.000Z'],
    ]);
  });

  it('takes when a repository was last synced from its PRD stages only, which no stage event writes', async () => {
    const seen: (string | null | undefined)[] = [];
    const { d, store } = deps({}, { acme: ['acme/widgets'] });
    await store.recordStages([{ workspace_id: 'w-acme', repository: 'acme/widgets', prd: 42, stage: 'prd', reached_at: '2026-09-18T00:00:00Z' }], '2026-09-29T10:00:00.000Z');
    await store.recordStages([{ workspace_id: 'w-acme', repository: 'acme/widgets', prd: 42, stage: 'outbox', reached_at: '2026-09-29T11:30:00Z' }], '2026-09-29T11:30:00.000Z');
    d.snapshot = (_w, repo, since) => { seen.push(since); return Promise.resolve(snap(repo)); };
    await syncStages(post(`Bearer ${SECRET}`), d);
    expect(seen).toEqual(['2026-09-29T09:55:00.000Z']);
  });

  it('keeps a shipped PRD\'s date when its feature PR is older than what the sync reads', async () => {
    const { d, store } = deps({}, { acme: ['acme/widgets'] });
    await syncStages(post(`Bearer ${SECRET}`), {
      ...d,
      now: () => '2026-09-20T00:00:00.000Z',
      snapshot: (_w, repo) => Promise.resolve(snap(repo, {
        shipped: ['0042-dark-mode'], issues: [{ number: 42, created_at: '2026-09-18T00:00:00Z' }],
        pulls: [{ number: 9, head: 'feat/dark-mode', base: 'main', state: 'closed', draft: false, merged_at: '2026-09-19T00:00:00Z', created_at: '2026-09-18T00:00:00Z', ready_at: null }],
      })),
    });
    await syncStages(post(`Bearer ${SECRET}`), { ...d, snapshot: (_w, repo) => Promise.resolve(snap(repo, { shipped: ['0042-dark-mode'] })) });
    expect(store.stages.find((s) => s.stage === 'shipped')).toMatchObject({ reached_at: '2026-09-19T00:00:00Z', synced_at: NOW });
  });

  it('skips a repository whose stages the database refuses, and logs why', async () => {
    const { d, store, lines } = deps();
    const record = store.recordStages.bind(store);
    store.recordStages = async (rows, at) => {
      if (rows.some((r) => r.repository === 'acme/gears')) throw new Error('Supabase refused: boom');
      return record(rows, at);
    };
    const body = await answerOf(await syncStages(post(`Bearer ${SECRET}`), d));
    expect(body.skipped).toEqual([{ workspace: 'acme', repository: 'acme/gears', reason: 'Supabase refused: boom' }]);
    expect(lines.some((l) => l.includes('acme/gears'))).toBe(true);
  });

  it('counts a topic the database refuses as not learnt, and keeps the repository\'s stages', async () => {
    const { d, store, lines } = deps();
    store.topics.push({ workspace_id: 'w-acme', repository: 'acme/gears', prd: 99, topic: 'teeth' });
    const body = await answerOf(await syncStages(post(`Bearer ${SECRET}`), d));
    expect(body.repositories[1]).toEqual({ workspace: 'acme', repository: 'acme/gears', stages: 1, topics: 0 });
    expect(lines.some((l) => l.includes('teeth'))).toBe(true);
  });

  it('answers 500 when the workspaces cannot be read, and writes nothing', async () => {
    const { d, store } = deps({ workspaces: () => Promise.reject(new Error('Supabase is down')) });
    const res = await syncStages(post(`Bearer ${SECRET}`), d);
    expect(res.status).toBe(500);
    expect(store.writes).toEqual([]);
  });
});

describe('the open outbox questions (PRD 657, s5)', () => {
  const building = { number: 5, head: 'feat/teeth--s1', base: 'feat/teeth', state: 'closed' as const, draft: false, merged_at: '2026-09-20T00:00:00Z', created_at: '2026-09-19T00:00:00Z', ready_at: null };
  const outboxOf = (open: number): GithubSummary => ({
    repo: 'acme/gears', prd: 7, folder: '0007-teeth', topic: 'teeth', issue: null, phase0: null, retro: null, mergedSlices: 1,
    feature: { number: 6, url: 'https://github.com/acme/gears/pull/6', state: 'open', draft: true },
    outbox: { open: Array.from({ length: open }, (_, i) => ({ id: `s1-0${i}-x`, rank: 'high' as const, question: `Q${i}?`, decision: null, options: [], personSteps: null })), settled: [] },
  });

  function withOutbox(summary: GithubSummary | null) {
    const setup = deps();
    setup.snapshots['acme/gears'] = snap('acme/gears', { inbox: ['0007-teeth'], pulls: [building] });
    const outbox = fakePrdOutboxStore(() => NOW);
    const asked: DossierRef[] = [];
    setup.d.outbox = { store: outbox, summary: (ref) => { asked.push(ref); return Promise.resolve(summary); } };
    return { ...setup, outbox, asked };
  }

  it('stores the open questions of a PRD at building, and 0 for every other PRD seen, reading GitHub for the first only', async () => {
    const { d, outbox, asked } = withOutbox(outboxOf(2));
    expect((await syncStages(post(`Bearer ${SECRET}`), d)).status).toBe(200);
    expect(asked.map((r) => `${r.home_repo}#${r.prd}`)).toEqual(['acme/gears#7']);
    expect(outbox.writes).toEqual(['w-acme acme/widgets#42 0', 'w-acme acme/gears#7 2', 'w-globex globex/core#3 0']);
    expect(outbox.rows.find((r) => r.prd === 7)).toMatchObject({ synced_at: NOW, waiting: [{ id: 's1-00-x', rank: 'high', question: 'Q0?' }, { id: 's1-01-x', rank: 'high', question: 'Q1?' }] });
  });

  it('keeps a PRD\'s counts when GitHub cannot be read, and a refused recount leaves the stages recorded', async () => {
    const { d, outbox, store, lines } = withOutbox(null);
    await outbox.record([{ workspace_id: 'w-acme', repository: 'acme/gears', prd: 7, open_questions: 4, waiting: [] }]);
    await syncStages(post(`Bearer ${SECRET}`), d);
    expect(outbox.rows.find((r) => r.prd === 7)?.open_questions).toBe(4);

    outbox.fail = 'boom';
    const body = await answerOf(await syncStages(post(`Bearer ${SECRET}`), d));
    expect(body.skipped).toEqual([]);
    expect(store.stages.some((s) => s.repository === 'acme/gears' && s.stage === 'building')).toBe(true);
    expect(lines.some((l) => l.includes('outboxes of acme/gears'))).toBe(true);
  });

  it('recounts nothing without the outbox deps', async () => {
    const { d, store } = deps();
    expect((await syncStages(post(`Bearer ${SECRET}`), d)).status).toBe(200);
    expect(store.writes.length).toBeGreaterThan(0);
  });
});

describe('the fix facts (PRD 691, s2)', () => {
  const REPO = 'acme/widgets';
  const fixRef = (id: string, prd: number): FixRef => ({ id, home_repo: REPO, prd });
  const issue = (n: number) => ({ number: n, url: `https://github.com/${REPO}/issues/${n}`, state: 'open' as const, author: 'ada', createdAt: '2026-09-28T09:00:00Z', risk: null, regression: false });
  const release = { tag: 'v0.0.9', url: `https://github.com/${REPO}/releases/tag/v0.0.9`, at: '2026-09-28T13:00:00Z' };
  const summary = (n: number, more: Partial<FixSummary> = {}): FixSummary => ({ issue: issue(n), pull: null, approvals: [], release: null, ...more });

  /** The sync with its fix deps: acme holds the fixes f1, f2 and f3, globex holds g1. */
  function withFixes(more: { fix?: FixReader['fix']; dossiers?: (w: SyncWorkspace) => Promise<FixRef[]> } = {}) {
    const setup = deps();
    const facts = fakeFixFactsStore(() => NOW);
    const asked: string[] = [];
    const listed: Record<string, FixRef[]> = {
      acme: [fixRef('f1', 1), fixRef('f2', 2), fixRef('f3', 3)],
      globex: [{ id: 'g1', home_repo: 'globex/core', prd: 4 }],
    };
    const fix = more.fix ?? ((r: FixRef) => Promise.resolve(summary(r.prd)));
    const reader: FixReader = { fix: async (r) => { asked.push(r.id); return fix(r); } };
    setup.d.fixes = { dossiers: more.dossiers ?? ((w) => Promise.resolve(listed[w.slug] ?? [])), reader, store: facts };
    return { ...setup, facts, asked };
  }

  it('reads and stores, per workspace, every fix dossier that has no stored release, at the sync\'s time', async () => {
    const { d, facts, asked } = withFixes();
    await facts.writeFacts([{ dossier_id: 'f1', workspace_id: 'w-acme', facts: summary(1, { release }) }], '2026-09-28T00:00:00Z');
    expect((await syncStages(post(`Bearer ${SECRET}`), d)).status).toBe(200);
    expect(asked.sort()).toEqual(['f2', 'f3', 'g1']);
    expect(facts.writes.slice(1)).toEqual(['w-acme f2, w-acme f3', 'w-globex g1']);
    expect(facts.rows.find((r) => r.dossier_id === 'g1')).toMatchObject({ workspace_id: 'w-globex', synced_at: NOW });
    expect(facts.rows.find((r) => r.dossier_id === 'f1')).toMatchObject({ synced_at: '2026-09-28T00:00:00Z' });
  });

  it('refreshes a workspace\'s fixes even when its repositories cannot be listed', async () => {
    const { d, asked } = withFixes();
    d.repositories = (w) => settled(() => {
      if (w.slug === 'acme') throw new Error('the App is not installed');
      return ['globex/core'];
    });
    await syncStages(post(`Bearer ${SECRET}`), d);
    expect(asked.sort()).toEqual(['f1', 'f2', 'f3', 'g1']);
  });

  it('logs a refresh that throws, and the sync still answers 200 with every stage recorded', async () => {
    const { d, facts, store, lines } = withFixes();
    facts.fail = 'boom';
    const res = await syncStages(post(`Bearer ${SECRET}`), d);
    expect(res.status).toBe(200);
    expect((await answerOf(res)).skipped).toEqual([]);
    expect(store.stages.length).toBe(4);
    expect(lines.filter((l) => l.includes('fix facts') && l.includes('boom')).length).toBe(2);
  });

  it('logs a workspace whose fix dossiers cannot be listed, and refreshes the others', async () => {
    const { d, asked, lines } = withFixes({
      dossiers: (w) => settled(() => {
        if (w.slug === 'acme') throw new Error('Supabase refused: nope');
        return [{ id: 'g1', home_repo: 'globex/core', prd: 4 }];
      }),
    });
    expect((await syncStages(post(`Bearer ${SECRET}`), d)).status).toBe(200);
    expect(asked).toEqual(['g1']);
    expect(lines.some((l) => l.includes('acme') && l.includes('nope'))).toBe(true);
  });

  it('logs a fix GitHub cannot read, and keeps its stored facts', async () => {
    const { d, facts, lines } = withFixes({ fix: (r) => settled(() => { if (r.id === 'f2') throw new Error('GitHub answered 502'); return summary(r.prd); }) });
    await facts.writeFacts([{ dossier_id: 'f2', workspace_id: 'w-acme', facts: summary(2) }], '2026-09-28T00:00:00Z');
    await syncStages(post(`Bearer ${SECRET}`), d);
    expect(facts.rows.find((r) => r.dossier_id === 'f2')).toMatchObject({ synced_at: '2026-09-28T00:00:00Z' });
    expect(lines.some((l) => l.includes('502'))).toBe(true);
  });
});
