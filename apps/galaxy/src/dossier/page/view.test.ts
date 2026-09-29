import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { UNREAD, type GithubSummary, type OutboxItem } from '../github/summary';
import type { DossierRoundRow, DossierRow, DossierVersionRow } from '../store';
import { REPLIES_UNREAD, SEND_OFF, SIGN_IN_TO_ANSWER } from './outbox-view';
import { dossierView, GITHUB_UNREAD, isQuick, OUTBOX_EMPTY, readPick, RETRO_EMPTY, sandboxPath, shortDay, stamp, versionSource, wayBack } from './view';

// /prd/<id> (PRD 216), as pure functions of the rows the viewer may read, the workspace's members and
// what the address picks: the header, the tabs, each artifact's versions, newest first, and the
// questions that shaped it.

const PIERRE = { user_id: 'u-pierre', email: 'pierre@vertuoza.com', name: 'Pierre' };
const MARIE = { user_id: 'u-marie', email: 'marie@vertuoza.com', name: null };
const MEMBERS = [PIERRE, MARIE];

const ID = '00000000-0000-4000-8000-0000000000d1';

const numbered: DossierRow = {
  id: ID, workspace_id: 'w1', home_repo: 'vertuoza/vertuo-omni-loop', prd: 216, title: 'PRD dossiers',
  opened_by: PIERRE.user_id, created_at: '2026-09-27T09:12:40Z', numbered_at: '2026-09-27T10:00:00Z',
};
const draft: DossierRow = { ...numbered, prd: null, numbered_at: null, title: 'Offline quotes' };

let next = 0;
function version(kind: DossierVersionRow['kind'], at: string, more: Partial<DossierVersionRow> = {}): DossierVersionRow {
  next += 1;
  return {
    id: `v${next}`, dossier_id: ID, kind, bytes: 100, source: 'kit', uploaded_by: PIERRE.user_id, commit_sha: null,
    created_at: at, ...more,
  };
}

const versions = [
  version('spec', '2026-09-27T09:20:00Z'),
  version('before-after', '2026-09-27T09:20:01Z'),
  version('spec', '2026-09-27T11:00:00Z', { uploaded_by: MARIE.user_id }),
  version('spec', '2026-09-28T08:00:00Z', { source: 'github', uploaded_by: null, commit_sha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678' }),
  version('before-after', '2026-09-28T08:00:01Z'),
];

const SHAPE = {
  question: 'Square or hexagonal tiles?', header: 'Shape', multiSelect: false,
  options: [{ label: 'Square (Recommended)', description: 'cheaper' }, { label: 'Hexagonal', description: 'prettier' }],
};
const CHECKS = {
  question: 'Which checks gate the slice?', header: 'Checks', multiSelect: true,
  options: [{ label: 'Unit', description: '' }, { label: 'Access', description: 'two accounts' }, { label: 'Manual', description: '' }],
};

function round(id: string, rule: DossierRoundRow['rule'], at: string, more: Partial<DossierRoundRow> = {}): DossierRoundRow {
  return {
    rule, round_id: id, session_id: 's1', asked_by: PIERRE.user_id, repo: 'vertuoza/vertuo-omni-loop', branch: 'main',
    questions: [SHAPE], answers: null, status: 'open', answered_via: null, answered_by: null, category: null, category_by: null,
    prd: null, skill: '/omni:brainstorm', created_at: at, answered_at: null, ...more,
  };
}

const rounds = [
  round('r3', 'delivery', '2026-09-28T08:00:00Z', {
    status: 'abandoned', prd: 216, branch: 'feat/prd-dossiers--s3', skill: '/omni:do-work', asked_by: MARIE.user_id,
  }),
  round('r1', 'brainstorm', '2026-09-27T09:15:00Z', {
    status: 'answered', answers: { [SHAPE.question]: 'Square (Recommended)' }, answered_via: 'page', answered_by: MARIE.user_id,
    answered_at: '2026-09-27T09:16:35Z', category: 'ux-ui', category_by: 'model',
  }),
  round('r2', 'brainstorm', '2026-09-27T09:30:00Z', {
    questions: [CHECKS], status: 'answered', answers: { [CHECKS.question]: 'Unit, Access' }, answered_via: 'terminal',
    answered_by: PIERRE.user_id, answered_at: '2026-09-27T11:30:00Z', category: 'harness', category_by: PIERRE.user_id,
  }),
  round('r4', 'delivery', '2026-09-28T09:00:00Z', { prd: 216, skill: null, branch: null }),
];

const view = (pick = readPick({}), dossier = numbered, me = PIERRE.user_id, rows = versions, asked: DossierRoundRow[] | null = rounds) =>
  dossierView({ dossier, versions: rows, members: MEMBERS, rounds: asked }, me, pick);

describe('the header', () => {
  it('names a numbered dossier PRD #n, with its title, its repository and who opened it when', () => {
    const v = view();
    expect(v).toMatchObject({
      heading: 'PRD #216', draft: false, title: 'PRD dossiers', repos: ['vertuoza/vertuo-omni-loop'],
      opened: 'opened by Pierre · 27 Sep 2026, 09:12 UTC', link: `/prd/${ID}`,
    });
  });

  it('names a draft DRAFT', () => {
    expect(view(readPick({}), draft)).toMatchObject({ heading: 'DRAFT', draft: true, title: 'Offline quotes' });
  });

  it('links PRD #n to its issue, and gives a draft no link but idea once a question is answered, Brainstorming before (PRD 587)', () => {
    expect(view().issueUrl).toBe('https://github.com/vertuoza/vertuo-omni-loop/issues/216');
    expect(view(readPick({}), draft)).toMatchObject({ issueUrl: null, stage: { id: 'idea', words: 'Stage: idea', caption: 'Brainstorm in progress' } });
    const unanswered = dossierView({ dossier: draft, versions, members: [PIERRE], rounds: [] }, null, readPick({}));
    expect(unanswered.stage).toMatchObject({ id: 'brainstorming', words: 'Brainstorming' });
    expect(unanswered.stage?.track.every((s) => s.state === 'ahead')).toBe(true);
  });

  it('shows no track when the stages were not asked for, and the stored stage when they were, whatever GitHub says (PRD 587)', () => {
    expect(view().stage).toBeNull();
    const read = { dossier: numbered, versions, members: [PIERRE], rounds };
    const stored = [{ stage: 'shipped' as const, reached_at: '2026-09-28T10:00:00Z', synced_at: '2026-09-29T09:15:00Z' }];
    expect(dossierView({ ...read, github: null, stages: stored }, null, readPick({})).stage)
      .toMatchObject({ id: 'shipped', words: 'Stage: shipped', synced: 'last synced 29 Sep 2026, 09:15 UTC' });
    expect(dossierView({ ...read, github: null, stages: [] }, null, readPick({})).stage).toMatchObject({ id: 'syncing', words: 'Syncing…' });
    expect(dossierView({ ...read, github: null, stages: null }, null, readPick({})).stage).toMatchObject({ id: 'syncing' });
    const github = {
      repo: 'vertuoza/vertuo-omni-loop', prd: 216, folder: '0216-prd-dossiers', topic: 'prd-dossiers', issue: null, retro: null,
      phase0: { number: 220, url: 'https://github.com/vertuoza/vertuo-omni-loop/pull/220', state: 'merged' as const, draft: false },
      feature: { number: 221, url: 'https://github.com/vertuoza/vertuo-omni-loop/pull/221', state: 'open' as const, draft: true },
      mergedSlices: 1,
    };
    const building = [{ stage: 'building' as const, reached_at: '2026-09-28T10:00:00Z', synced_at: '2026-09-29T09:15:00Z' }];
    expect(dossierView({ ...read, github, slices: 5, stages: building }, null, readPick({})).stage).toMatchObject({ id: 'building', caption: 'Being built · 1/5 slices' });
    expect(dossierView({ ...read, github, slices: 5 }, null, readPick({})).stage).toBeNull();
  });

  it('names an opener by their email when they chose no name, and one who left as such', () => {
    expect(view(readPick({}), { ...numbered, opened_by: MARIE.user_id }).opened).toMatch(/^opened by marie@vertuoza\.com · /);
    expect(view(readPick({}), { ...numbered, opened_by: 'u-gone' }).opened).toMatch(/^opened by someone who left the workspace · /);
  });

  it('says a dossier nobody opened was read from GitHub', () => {
    expect(view(readPick({}), { ...numbered, opened_by: null }).opened).toBe('read from GitHub · 27 Sep 2026, 09:12 UTC');
  });

  it('chips every repository of the dossier as the history lists them, else its home repository alone', () => {
    const read = { dossier: numbered, versions, members: MEMBERS, rounds };
    const repos = ['vertuoza/vertuo-omni-loop', 'vertuoza/vertuo-ai-domain', 'vertuoza/vertuo-core'];
    expect(dossierView({ ...read, repos }, PIERRE.user_id, readPick({})).repos).toEqual(repos);
    expect(dossierView({ ...read, repos: null }, PIERRE.user_id, readPick({})).repos).toEqual(['vertuoza/vertuo-omni-loop']);
    expect(dossierView({ ...read, repos: [] }, PIERRE.user_id, readPick({})).repos).toEqual(['vertuoza/vertuo-omni-loop']);
  });
});

describe('who may delete', () => {
  it('lets the opener delete their draft', () => {
    expect(view(readPick({}), draft, PIERRE.user_id).canDelete).toBe(true);
  });

  it('lets nobody else delete it, and nobody delete a numbered dossier', () => {
    expect(view(readPick({}), draft, MARIE.user_id).canDelete).toBe(false);
    expect(view(readPick({}), numbered, PIERRE.user_id).canDelete).toBe(false);
    expect(view(readPick({}), { ...draft, opened_by: null }, PIERRE.user_id).canDelete).toBe(false);
  });
});

describe('the tabs', () => {
  it('reads Questions, questions answered out of asked and how many are left, then Before/after, Spec, Plan, each with its latest version, then Outbox and Retro, dimmed while empty', () => {
    expect(view().tabs).toEqual([
      { kind: 'questions', label: 'Questions', badge: '2/4', alert: '1 to answer', href: `/prd/${ID}`, current: true, empty: false },
      { kind: 'before-after', label: 'Before/after', badge: 'v2', alert: null, href: `/prd/${ID}?tab=before-after`, current: false, empty: false },
      { kind: 'spec', label: 'Spec', badge: 'v3', alert: null, href: `/prd/${ID}?tab=spec`, current: false, empty: false },
      { kind: 'plan', label: 'Plan', badge: null, alert: null, href: `/prd/${ID}?tab=plan`, current: false, empty: false },
      { kind: 'outbox', label: 'Outbox', badge: null, alert: null, href: `/prd/${ID}?tab=outbox`, current: false, empty: true },
      { kind: 'retro', label: 'Retro', badge: null, alert: null, href: `/prd/${ID}?tab=retro`, current: false, empty: true },
    ]);
  });

  it('opens on Questions when at least one round was asked, its link naming no tab', () => {
    const one = view(readPick({}), numbered, PIERRE.user_id, versions, [rounds[3]]);
    expect(one.tab).toBe('questions');
    expect(one.tabs.find((t) => t.current)).toMatchObject({ kind: 'questions', href: `/prd/${ID}` });
  });

  it('opens on Before/after when no round was asked, or none could be read, its link naming no tab', () => {
    for (const asked of [[], null]) {
      const v = view(readPick({}), numbered, PIERRE.user_id, versions, asked);
      expect(v.tab, String(asked)).toBe('before-after');
      expect(v.tabs.map((t) => [t.kind, t.href, t.current]), String(asked)).toEqual([
        ['questions', `/prd/${ID}?tab=questions`, false],
        ['before-after', `/prd/${ID}`, true],
        ['spec', `/prd/${ID}?tab=spec`, false],
        ['plan', `/prd/${ID}?tab=plan`, false],
        ['outbox', `/prd/${ID}?tab=outbox`, false],
        ['retro', `/prd/${ID}?tab=retro`, false],
      ]);
    }
  });

  it('counts no question when none was asked, or when they could not be read', () => {
    expect(view(readPick({}), numbered, PIERRE.user_id, versions, []).tabs[0].badge).toBeNull();
    expect(view(readPick({}), numbered, PIERRE.user_id, versions, null).tabs[0].badge).toBeNull();
    expect(view(readPick({}), numbered, PIERRE.user_id, versions, []).tabs[0].alert).toBeNull();
  });

  it('counts questions, not rounds (PRD 498): 3 + 1 answered, 2 open and 1 moved read 4/7 · 2 to answer', () => {
    const q = (n: number) => ({ ...SHAPE, question: `Question ${n}?`, header: `H${n}` });
    const answers = (...ns: number[]) => Object.fromEntries(ns.map((n) => [`Question ${n}?`, 'Hexagonal']));
    const answered = { status: 'answered' as const, answered_via: 'page' as const, answered_by: PIERRE.user_id, answered_at: '2026-09-27T10:00:00Z' };
    const mixed = [
      round('a3', 'brainstorm', '2026-09-27T09:00:00Z', { questions: [q(1), q(2), q(3)], answers: answers(1, 2, 3), ...answered }),
      round('a1', 'brainstorm', '2026-09-27T09:10:00Z', { questions: [q(4)], answers: answers(4), ...answered }),
      round('o2', 'delivery', '2026-09-27T09:20:00Z', { questions: [q(5), q(6)] }),
      round('m1', 'delivery', '2026-09-27T09:30:00Z', { questions: [q(7)], status: 'abandoned' }),
    ];
    const v = view(readPick({}), numbered, PIERRE.user_id, versions, mixed);
    expect(v.questions).toMatchObject({ asked: 7, answered: 4, open: 2 });
    expect(v.tabs[0]).toMatchObject({ badge: '4/7', alert: '2 to answer' });
    const settled = view(readPick({}), numbered, PIERRE.user_id, versions, mixed.slice(0, 2));
    expect(settled.questions).toMatchObject({ asked: 4, answered: 4, open: 0 });
    expect(settled.tabs[0]).toMatchObject({ badge: '4/4 answered', alert: null });
  });

  it('gives each round its line: its state, its headers in lower case, its count and when it was asked (PRD 498)', () => {
    const [first, second, third, fourth] = view().questions.rounds ?? [];
    expect(first).toMatchObject({ state: 'answered', headers: 'shape', count: '1/1', when: '27 Sep, 09:15' });
    expect(second).toMatchObject({ state: 'answered', headers: 'checks', count: '1/1' });
    expect(third).toMatchObject({ state: 'moved', count: 'moved to the terminal', when: '28 Sep, 08:00' });
    expect(fourth).toMatchObject({ state: 'open', count: '1 to answer' });
    const two = round('o2', 'delivery', '2026-09-27T09:20:00Z', { questions: [SHAPE, CHECKS] });
    const [open] = view(readPick({}), numbered, PIERRE.user_id, versions, [two]).questions.rounds ?? [];
    expect(open).toMatchObject({ headers: 'shape, checks', count: '2 to answer' });
  });

  it('opens the tab the address names, whatever the default', () => {
    for (const asked of [rounds, []]) {
      for (const tab of ['questions', 'before-after', 'spec', 'plan', 'outbox', 'retro'] as const) {
        const v = view(readPick({ tab }), numbered, PIERRE.user_id, versions, asked);
        expect(v.tab, `${tab}, ${asked.length} rounds`).toBe(tab);
        expect(v.tabs.find((t) => t.current)?.kind).toBe(tab);
      }
    }
  });

  it('falls back to the default for a tab it does not know', () => {
    expect(view(readPick({ tab: 'elsewhere' })).tab).toBe('questions');
    expect(view(readPick({ tab: 'elsewhere' }), numbered, PIERRE.user_id, versions, []).tab).toBe('before-after');
  });
});

describe('the Outbox tab (PRD 426)', () => {
  const item = (id: string, rank: OutboxItem['rank'], more: Partial<OutboxItem> = {}): OutboxItem => ({
    id, rank, question: `${id}?`, decision: `Did ${id}.`, options: [{ letter: 'A', text: 'Built.' }, { letter: 'B', text: 'Other.' }], personSteps: null, ...more,
  });
  const settled = (id: string, verdict: string) => ({ id, title: `${id}?`, verdict, answer: `Answer to ${id}.` });
  const github = (outbox: GithubSummary['outbox'], more: Partial<GithubSummary> = {}): GithubSummary => ({
    repo: 'vertuoza/vertuo-omni-loop', prd: 216, folder: '0216-prd-dossiers', topic: 'prd-dossiers', issue: null, retro: null,
    phase0: { number: 220, url: 'https://github.com/vertuoza/vertuo-omni-loop/pull/220', state: 'merged', draft: false },
    feature: { number: 221, url: 'https://github.com/vertuoza/vertuo-omni-loop/pull/221', state: 'open', draft: true },
    mergedSlices: 1, outbox, outboxComment: 'https://github.com/vertuoza/vertuo-omni-loop/pull/221#issuecomment-7', ...more,
  });
  const outboxOf = (summary: GithubSummary | null | undefined, dossier = numbered) =>
    dossierView({ dossier, versions, members: MEMBERS, rounds, github: summary }, PIERRE.user_id, readPick({ tab: 'outbox' }));
  const tabOf = (v: ReturnType<typeof outboxOf>) => v.tabs.find((t) => t.kind === 'outbox');

  it('lists the open items highest rank first, then the settled ones in file order, and answers on the outbox comment', () => {
    const v = outboxOf(github({
      open: [item('s1-01-m', 'medium'), item('s2-01-h', 'high'), item('s2-02-p', 'human-action', { options: [], personSteps: 'Add the key.' }), item('s3-01-h', 'high')],
      settled: [settled('s1-02-z', 'adopted'), settled('s1-01-a', 'agreed')],
    }));
    expect(v.tab).toBe('outbox');
    expect(v.versions).toEqual([]);
    expect(tabOf(v)).toMatchObject({ badge: '4 open', empty: false, current: true });
    expect(v.outbox.state).toBe('items');
    expect(v.outbox.answerUrl).toBe('https://github.com/vertuoza/vertuo-omni-loop/pull/221#issuecomment-7');
    expect(v.outbox.open.map((i) => [i.id, i.rankWords])).toEqual([['s2-02-p', 'needs a person'], ['s2-01-h', 'high'], ['s3-01-h', 'high'], ['s1-01-m', 'medium']]);
    expect(v.outbox.open[1]).toEqual({
      id: 's2-01-h', number: null, rank: 'high', rankWords: 'high', kind: 'decision', adopted: false, intro: null, punchline: null,
      question: 's2-01-h?', decision: 'Did s2-01-h.', steps: null, bearsOn: [], details: [], pending: null,
      options: [{ letter: 'A', text: 'Built.', built: true }, { letter: 'B', text: 'Other.', built: false }],
    });
    expect(v.outbox.open[0]).toMatchObject({ kind: 'action', options: [], steps: 'Add the key.' });
    expect(v.outbox.settled.map((s) => [s.id, s.verdict])).toEqual([['s1-02-z', 'adopted'], ['s1-01-a', 'agreed']]);
  });

  it('counts the settled ones when none is open, and answers on the feature PR when no outbox comment is found', () => {
    const v = outboxOf(github({ open: [], settled: [settled('s1-01-a', 'agreed')] }, { outboxComment: null }));
    expect(tabOf(v)).toMatchObject({ badge: '1 settled', empty: false });
    expect(v.outbox.answerUrl).toBe('https://github.com/vertuoza/vertuo-omni-loop/pull/221');
  });

  it('is empty, dimmed and says why, when there is no outbox yet, for a draft, and when GitHub was not asked', () => {
    for (const v of [outboxOf(github(null)), outboxOf(github({ open: [], settled: [] })), outboxOf(undefined), outboxOf(undefined, draft)]) {
      expect(tabOf(v)).toMatchObject({ badge: null, empty: true });
      expect(v.outbox).toMatchObject({ state: 'empty', words: OUTBOX_EMPTY, answerUrl: null, open: [], adopted: [], settled: [] });
    }
  });

  it('says GitHub did not answer when the summary or its outbox could not be read', () => {
    for (const v of [outboxOf(null), outboxOf(github(UNREAD))]) {
      expect(v.outbox).toMatchObject({ state: 'unread', words: GITHUB_UNREAD, open: [], settled: [] });
      expect(tabOf(v)).toMatchObject({ badge: null, empty: true });
    }
    expect(GITHUB_UNREAD).toBe('GitHub did not answer. The page tries again within a minute.');
    expect(OUTBOX_EMPTY).toBe('No decision yet: the outbox fills while the PRD is built.');
  });
});

describe('the version picker', () => {
  it('lists the tab\'s versions newest first, each with its number, day and source', () => {
    expect(view(readPick({ tab: 'spec' })).versions.map((v) => [v.number, v.label, v.current])).toEqual([
      [3, 'v3 · 28 Sep · commit a1b2c3d (github)', true],
      [2, 'v2 · 27 Sep · marie@vertuoza.com (kit)', false],
      [1, 'v1 · 27 Sep · Pierre (kit)', false],
    ]);
  });

  it('shows the latest version unless the address picks another', () => {
    expect(view(readPick({ tab: 'spec' })).shown).toMatchObject({ number: 3, id: 'v4' });
    const older = view(readPick({ tab: 'spec', v: '1' }));
    expect(older.shown).toMatchObject({ number: 1, id: 'v1' });
    expect(older.versions.find((v) => v.current)?.number).toBe(1);
  });

  it('shows the latest when the address picks a version that does not exist', () => {
    expect(view(readPick({ tab: 'spec', v: '9' })).shown).toMatchObject({ number: 3 });
  });

  it('has nothing to show for an artifact with no version yet', () => {
    const plan = view(readPick({ tab: 'plan' }));
    expect(plan.versions).toEqual([]);
    expect(plan.shown).toBeNull();
    expect(view(readPick({}), draft, PIERRE.user_id, []).shown).toBeNull();
  });

  it('points each version of the before/after page at its sandboxed route', () => {
    const page = view(readPick({ tab: 'before-after' }));
    expect(page.shown).toMatchObject({ number: 2, frame: `/prd/${ID}/v/2/page` });
    expect(page.versions.map((v) => v.href)).toEqual([`/prd/${ID}?tab=before-after&v=2`, `/prd/${ID}?tab=before-after&v=1`]);
  });

  it('names no tab in a version\'s link when Before/after is the default', () => {
    const page = view(readPick({}), numbered, PIERRE.user_id, versions, []);
    expect(page.versions.map((v) => v.href)).toEqual([`/prd/${ID}?v=2`, `/prd/${ID}?v=1`]);
  });
});

describe('the Questions tab', () => {
  const questions = () => view(readPick({ tab: 'questions' }));

  it('opens from the address, with no version picker', () => {
    const v = questions();
    expect(v.tab).toBe('questions');
    expect(v.tabs.find((t) => t.current)?.kind).toBe('questions');
    expect(v.versions).toEqual([]);
    expect(v.shown).toBeNull();
  });

  it('lists every round in the order it was asked, brainstorm or delivery, answered out of asked', () => {
    const q = questions().questions;
    expect(q.rounds?.map((r) => [r.id, r.rule])).toEqual([['r1', 'brainstorm'], ['r2', 'brainstorm'], ['r3', 'delivery'], ['r4', 'delivery']]);
    expect([q.answered, q.asked, q.open]).toEqual([2, 4, 1]);
  });

  it('shows an answered question with only its chosen option, and the answer as given', () => {
    const [first] = questions().questions.rounds ?? [];
    expect(first.questions).toEqual([{
      header: 'Shape', question: 'Square or hexagonal tiles?', multiSelect: false, shape: 'answered', answer: 'Square (Recommended)', written: null,
      options: [{ label: 'Square', recommended: true, description: 'cheaper', chosen: true }],
    }]);
  });

  it('shows each chosen option of a multi-select answer, and none it did not choose', () => {
    const [, second] = questions().questions.rounds ?? [];
    expect(second.questions[0].options.map((o) => [o.label, o.description, o.chosen])).toEqual([['Unit', '', true], ['Access', 'two accounts', true]]);
    expect(second.questions[0]).toMatchObject({ shape: 'answered', answer: 'Unit, Access', written: null });
  });

  it('shows an answer that matches no option as the text given, with no option', () => {
    const other = round('r5', 'brainstorm', '2026-09-27T10:00:00Z', {
      status: 'answered', answers: { [SHAPE.question]: 'Triangles, obviously' }, answered_via: 'page', answered_by: PIERRE.user_id,
      answered_at: '2026-09-27T10:01:00Z',
    });
    const [only] = view(readPick({ tab: 'questions' }), numbered, PIERRE.user_id, versions, [other]).questions.rounds ?? [];
    expect(only.questions[0]).toMatchObject({ shape: 'answered', options: [], written: 'Triangles, obviously' });
  });

  it('shows the chosen options of a multi-select answer, and the rest as the text given', () => {
    const mixed = round('r6', 'brainstorm', '2026-09-27T10:00:00Z', {
      questions: [CHECKS], status: 'answered', answers: { [CHECKS.question]: 'Access, Load test' }, answered_via: 'page',
      answered_by: PIERRE.user_id, answered_at: '2026-09-27T10:01:00Z',
    });
    const [only] = view(readPick({ tab: 'questions' }), numbered, PIERRE.user_id, versions, [mixed]).questions.rounds ?? [];
    expect(only.questions[0].options.map((o) => o.label)).toEqual(['Access']);
    expect(only.questions[0].written).toBe('Load test');
  });

  it('shows every option of an open question, none chosen', () => {
    const [, , , fourth] = questions().questions.rounds ?? [];
    expect(fourth.questions[0]).toMatchObject({ shape: 'open', answer: null, written: null });
    expect(fourth.questions[0].options.map((o) => [o.label, o.chosen])).toEqual([['Square', false], ['Hexagonal', false]]);
  });

  it('shows no option for a question moved to the terminal', () => {
    const [, , third] = questions().questions.rounds ?? [];
    expect(third.questions[0]).toMatchObject({ shape: 'moved', question: 'Square or hexagonal tiles?', options: [], answer: null, written: null });
    expect(third.outcome).toBe('moved to the terminal, no answer recorded');
  });

  it('says who answered, after how long and where, or that nobody did', () => {
    expect(questions().questions.rounds?.map((r) => r.outcome)).toEqual([
      'answered by marie@vertuoza.com after 1 min 35 s, on the page',
      'answered by Pierre after 2 h 0 min, in the terminal',
      'moved to the terminal, no answer recorded',
      'not answered yet',
    ]);
  });

  it('names who asked it and when, its category, where it came from, and links to the question', () => {
    const [first, second, third, fourth] = questions().questions.rounds ?? [];
    expect(first).toMatchObject({ asked: 'asked by Pierre · 27 Sep 2026, 09:15 UTC', category: 'UX/UI', categoryValue: 'ux-ui', href: `/ask/q/r1?from=${ID}` });
    expect(second).toMatchObject({ category: 'Harness', categoryValue: 'harness' });
    expect(third).toMatchObject({ asked: 'asked by marie@vertuoza.com · 28 Sep 2026, 08:00 UTC', category: 'unsorted', categoryValue: null });
    expect(third.context).toEqual(['vertuoza/vertuo-omni-loop', 'feat/prd-dossiers--s3', 'PRD #216', '/omni:do-work']);
    expect(fourth.context).toEqual(['vertuoza/vertuo-omni-loop', 'PRD #216']);
  });

  it('keeps an answer to a question the round does not name, and reads a round with no question it can show', () => {
    const odd = round('r9', 'delivery', '2026-09-28T10:00:00Z', {
      questions: [{ header: 'no text' }], status: 'answered', answers: { 'Asked in the terminal?': 'Yes' }, answered_via: 'terminal',
      answered_by: 'u-gone', answered_at: '2026-09-28T10:00:42Z',
    });
    const [only] = view(readPick({ tab: 'questions' }), numbered, PIERRE.user_id, versions, [odd]).questions.rounds ?? [];
    expect(only.questions).toEqual([{ header: '', question: 'Asked in the terminal?', multiSelect: false, shape: 'answered', options: [], answer: 'Yes', written: 'Yes' }]);
    expect(only.outcome).toBe('answered by someone who left the workspace after 42 s, in the terminal');
  });

  it('has no rounds to list when they could not be read', () => {
    expect(view(readPick({ tab: 'questions' }), numbered, PIERRE.user_id, versions, null).questions).toEqual({ rounds: null, asked: 0, answered: 0, open: 0 });
  });
});

describe('the Retro tab (PRD 426, s3)', () => {
  const RETRO_PR = { number: 230, url: 'https://github.com/vertuoza/vertuo-omni-loop/pull/230', draft: false };
  const github = (more: Partial<GithubSummary>): GithubSummary => ({
    repo: 'vertuoza/vertuo-omni-loop', prd: 216, folder: '0216-prd-dossiers', topic: 'prd-dossiers', issue: null,
    phase0: { number: 220, url: 'https://github.com/vertuoza/vertuo-omni-loop/pull/220', state: 'merged', draft: false },
    feature: { number: 221, url: 'https://github.com/vertuoza/vertuo-omni-loop/pull/221', state: 'merged', draft: false },
    mergedSlices: 3, retro: null, retroText: null, ...more,
  });
  const retroOf = (summary: GithubSummary | null | undefined, dossier = numbered) =>
    dossierView({ dossier, versions, members: MEMBERS, rounds, github: summary }, PIERRE.user_id, readPick({ tab: 'retro' }));
  const tabOf = (v: ReturnType<typeof retroOf>) => v.tabs.find((t) => t.kind === 'retro');

  it('shows retro.md with the retro PR on top, badged "open PR" while it is open', () => {
    const v = retroOf(github({ retro: { ...RETRO_PR, state: 'open' }, retroText: '# Retro\n' }));
    expect(v.tab).toBe('retro');
    expect(v.versions).toEqual([]);
    expect(tabOf(v)).toMatchObject({ label: 'Retro', badge: 'open PR', empty: false, current: true });
    expect(v.retro).toEqual({ state: 'text', words: null, prUrl: RETRO_PR.url, text: '# Retro\n' });
  });

  it('is badged "merged" once the retro PR is merged', () => {
    expect(tabOf(retroOf(github({ retro: { ...RETRO_PR, state: 'merged' }, retroText: '# Retro\n' })))).toMatchObject({ badge: 'merged', empty: false });
  });

  it('is empty, dimmed and says why, with no retro PR, for a draft, when GitHub was not asked, and while retro.md is not there', () => {
    for (const v of [retroOf(github({})), retroOf(undefined), retroOf(undefined, draft), retroOf(github({ retroText: undefined }))]) {
      expect(tabOf(v)).toMatchObject({ badge: null, empty: true });
      expect(v.retro).toEqual({ state: 'empty', words: RETRO_EMPTY, prUrl: null, text: null });
    }
    const pending = retroOf(github({ retro: { ...RETRO_PR, state: 'open' }, retroText: null }));
    expect(tabOf(pending)).toMatchObject({ badge: 'open PR', empty: true });
    expect(pending.retro).toEqual({ state: 'empty', words: RETRO_EMPTY, prUrl: RETRO_PR.url, text: null });
    expect(RETRO_EMPTY).toBe('The retro is written when the feature PR merges.');
  });

  it('says GitHub did not answer when the summary, the retro PR or retro.md could not be read', () => {
    for (const v of [retroOf(null), retroOf(github({ retro: UNREAD })), retroOf(github({ retro: { ...RETRO_PR, state: 'open' }, retroText: UNREAD }))]) {
      expect(v.retro).toMatchObject({ state: 'unread', words: GITHUB_UNREAD, text: null });
      expect(tabOf(v)).toMatchObject({ empty: true });
    }
  });
});

describe('what the address picks', () => {
  it('reads the tab and the version', () => {
    expect(readPick({ tab: 'plan', v: '4' })).toEqual({ tab: 'plan', version: 4 });
    expect(readPick({ tab: ['spec', 'plan'], v: ['2'] })).toEqual({ tab: 'spec', version: 2 });
    expect(readPick({ tab: 'questions' })).toEqual({ tab: 'questions', version: null });
    expect(readPick({ tab: 'before-after' })).toEqual({ tab: 'before-after', version: null });
    expect(readPick({ tab: 'retro' })).toEqual({ tab: 'retro', version: null });
  });

  it('names no tab for a tab it does not know, and the latest version for a version that is not one', () => {
    for (const tab of [undefined, 'Questions', 'spec.md', '']) expect(readPick({ tab }), String(tab)).toEqual({ tab: null, version: null });
    for (const v of ['0', '-1', 'v2', '1.5', '99999999999', '']) expect(readPick({ tab: 'spec', v }), v).toEqual({ tab: 'spec', version: null });
  });
});

describe('the words', () => {
  it('names a version by who uploaded it, or by the commit the fallback read', () => {
    expect(versionSource(version('spec', '2026-09-27T09:00:00Z'), MEMBERS)).toBe('Pierre (kit)');
    expect(versionSource(version('spec', '2026-09-27T09:00:00Z', { source: 'github', uploaded_by: null, commit_sha: 'a1b2c3d4e5f6' }), MEMBERS)).toBe('commit a1b2c3d (github)');
  });

  it('writes days and times in UTC, the same on the server and in any browser', () => {
    expect(shortDay('2026-01-05T23:59:00Z')).toBe('5 Jan');
    expect(shortDay('2026-12-31T00:00:00+02:00')).toBe('30 Dec');
    expect(stamp('2026-09-27T09:02:40Z')).toBe('27 Sep 2026, 09:02 UTC');
  });

  it('builds the sandboxed route of a version', () => {
    expect(sandboxPath(ID, 3)).toBe(`/prd/${ID}/v/3/page`);
  });
});

describe('the way back from a question answered on its own page (PRD 384)', () => {
  const SESSION = '00000000-0000-4000-8000-0000000000a5';
  const back = (from: string | null, asked: DossierRoundRow[] | null = rounds, roundId = 'r1') => wayBack({ from, sessionId: SESSION, roundId, rounds: asked });

  it('goes to the Questions tab of the dossier it came from, at the next round still open', () => {
    expect(back(ID)).toBe(`/prd/${ID}?tab=questions#r4`);
  });

  it('picks the first round still open in the order asked, never the one just answered', () => {
    const early = round('r0', 'brainstorm', '2026-09-27T09:00:00Z');
    const answeredNow = round('r5', 'brainstorm', '2026-09-27T08:00:00Z');
    expect(back(ID, [...rounds, early, answeredNow], 'r5')).toBe(`/prd/${ID}?tab=questions#r0`);
  });

  it('goes to the Questions tab alone when no round is left open, or the rounds cannot be read', () => {
    const settled = rounds.filter((r) => r.status !== 'open');
    expect(back(ID, settled)).toBe(`/prd/${ID}?tab=questions`);
    expect(back(ID, [])).toBe(`/prd/${ID}?tab=questions`);
    expect(back(ID, null)).toBe(`/prd/${ID}?tab=questions`);
  });

  it("goes to the ask page of the question's session when it came from no dossier", () => {
    expect(back(null)).toBe(`/ask/${SESSION}`);
    for (const from of ['', 'https://evil.example/prd', '//evil.example', `${ID}/../x`, 'not-a-dossier']) {
      expect(back(from), from).toBe(`/ask/${SESSION}`);
    }
  });
});

describe('a quick round, answered on the list (PRD 384)', () => {
  const AT = '2026-09-28T09:00:00Z';
  const SOON = Date.parse(AT) + 60_000;
  const LATE = Date.parse(AT) + 540_000;
  const PREVIEWED = { ...SHAPE, options: [{ label: 'Square', description: '', preview: '[ ]' }, { label: 'Hexagonal', description: '' }] };
  const quick = (more: Partial<DossierRoundRow> = {}, now = SOON) => isQuick(round('q', 'brainstorm', AT, more), now);

  it('is an open round of one single-choice question with no preview, with time left', () => {
    expect(quick()).toBe(true);
  });

  it('is not quick once answered or moved, or once its time is up', () => {
    expect(quick({ status: 'answered', answers: { [SHAPE.question]: 'Hexagonal' } })).toBe(false);
    expect(quick({ status: 'abandoned' })).toBe(false);
    expect(quick({}, LATE)).toBe(false);
    expect(quick({}, LATE - 1)).toBe(true);
  });

  it('is not quick with several questions, a multi-select, a preview, or no option', () => {
    expect(quick({ questions: [SHAPE, SHAPE] })).toBe(false);
    expect(quick({ questions: [CHECKS] })).toBe(false);
    expect(quick({ questions: [PREVIEWED] })).toBe(false);
    expect(quick({ questions: [{ ...SHAPE, options: [] }] })).toBe(false);
    expect(quick({ questions: [] })).toBe(false);
  });

  const asked = [
    round('a', 'brainstorm', '2026-09-28T08:59:00Z', { status: 'answered', answers: { [SHAPE.question]: 'Hexagonal' } }),
    round('q1', 'brainstorm', AT),
    round('q2', 'brainstorm', '2026-09-28T09:00:30Z', { questions: [CHECKS] }),
  ];
  const quickView = (me: string, answerable: string[]) =>
    dossierView({ dossier: numbered, versions, members: MEMBERS, rounds: asked, answerable }, me, readPick({}), SOON).questions.rounds!;

  it('gives a viewer who may answer a button per option, the answer exactly as offered, and the next open round', () => {
    const [answered, first, second] = quickView(PIERRE.user_id, ['q1', 'q2']);
    expect(answered.quick).toBeNull();
    expect(second.quick).toBeNull();
    expect(first.quick).toEqual({
      question: SHAPE.question,
      choices: [
        { label: 'Square', recommended: true, description: 'cheaper', value: 'Square (Recommended)' },
        { label: 'Hexagonal', recommended: false, description: 'prettier', value: 'Hexagonal' },
      ],
      canAnswer: true,
      owner: 'Pierre',
      next: 'q2',
      names: { [PIERRE.user_id]: 'Pierre', [MARIE.user_id]: 'marie@vertuoza.com' },
    });
  });

  it('decides who may answer from what the server read, never from the viewer alone', () => {
    const [, first] = quickView(PIERRE.user_id, []);
    expect(first.quick).toMatchObject({ canAnswer: false, owner: 'Pierre', names: {} });
    expect(quickView(MARIE.user_id, ['q1'])[1].quick).toMatchObject({ canAnswer: true });
  });

  it('keeps each round id as the id the way back lands on', () => {
    expect(quickView(PIERRE.user_id, []).map((r) => r.id)).toEqual(['a', 'q1', 'q2']);
  });
});

describe('the Outbox tab as the place to answer (PRD 251, s9)', () => {
  const PR = 'https://github.com/vertuoza/vertuo-omni-loop/pull/221';
  const item = (id: string, rank: OutboxItem['rank'], more: Partial<OutboxItem> = {}): OutboxItem => ({
    id, rank, question: `${id}?`, decision: `Did ${id}.`, options: [{ letter: 'A', text: 'Built.' }, { letter: 'B', text: 'Other.' }], personSteps: null,
    bearsOn: 'P-PRODUCT-3, ADR-0004', intro: 'An intro.', punchline: 'A punchline.',
    details: { decide: 'What to do.', meanwhile: 'Built A.', cost: 'A constant.', unknown: 'The traffic.' }, ...more,
  });
  const summary = (more: Partial<GithubSummary> = {}): GithubSummary => ({
    repo: 'vertuoza/vertuo-omni-loop', prd: 216, folder: '0216-prd-dossiers', topic: 'prd-dossiers',
    issue: { number: 216, url: 'https://github.com/vertuoza/vertuo-omni-loop/issues/216', state: 'open' }, retro: null,
    phase0: { number: 220, url: 'https://github.com/vertuoza/vertuo-omni-loop/pull/220', state: 'merged', draft: false },
    feature: { number: 221, url: PR, state: 'open', draft: true },
    mergedSlices: 1, outboxComment: `${PR}#issuecomment-7`,
    outbox: {
      open: [item('s2-01-h', 'high'), item('s2-02-p', 'human-action', { options: [], personSteps: 'Add the key.' }), item('s3-01-new', 'high')],
      adopted: [item('s1-03-m', 'medium')],
      settled: [
        { id: 's1-03-m', title: 's1-03-m?', verdict: 'adopted', answer: 'Adopted when raised.', by: 'omni', at: '2026-09-26', url: null },
        { id: 's1-01-a', title: 's1-01-a?', verdict: 'agreed', answer: 'A. Built.', by: 'marie', at: '2026-09-26T10:00:00Z', url: `${PR}#issuecomment-3` },
      ],
    },
    replies: {
      numbering: [{ number: 1, id: 's2-02-p' }, { number: 2, id: 's2-01-h' }, { number: 3, id: 's1-03-m' }, { number: 4, id: 's1-01-a' }],
      pending: [{ number: 2, id: 's2-01-h', text: 'B because cheaper', by: 'uma', at: '2026-09-27T09:30:00Z', url: `${PR}#issuecomment-9`, counted: false, door: 'page' }],
    },
    ...more,
  });
  const outboxOf = (github: GithubSummary | null | undefined, { me = PIERRE.user_id as string | null, query = {} as Record<string, string>, demo = false } = {}) =>
    dossierView({ dossier: numbered, versions, members: MEMBERS, rounds, github, demo }, me, readPick({ tab: 'outbox', ...query }));

  it('numbers the cards as the pull request does, highest rank first, and puts the pending answer on its card', () => {
    const { outbox } = outboxOf(summary());
    expect(outbox.open.map((c) => [c.number, c.id, c.kind])).toEqual([[1, 's2-02-p', 'action'], [2, 's2-01-h', 'decision'], [null, 's3-01-new', 'decision']]);
    expect(outbox.open[1]).toMatchObject({
      intro: 'An intro.', punchline: 'A punchline.',
      bearsOn: [{ id: 'P-PRODUCT-3', href: '/knowledge?entry=P-PRODUCT-3' }, { id: 'ADR-0004', href: '/knowledge?entry=ADR-0004' }],
      details: [
        { label: 'What I had to decide', text: 'What to do.' }, { label: 'What I did meanwhile', text: 'Built A.' },
        { label: 'What it costs to change later', text: 'A constant.' }, { label: 'What I could not know', text: 'The traffic.' },
      ],
      pending: { text: 'B because cheaper', by: 'uma', where: 'on the Omni page', when: '27 Sep 2026, 09:30 UTC', url: `${PR}#issuecomment-9`, counted: false },
    });
    expect(outbox.open[0]).toMatchObject({ steps: 'Add the key.', options: [], pending: null });
  });

  it('puts the adopted mediums in their own group, and every other ledger entry in Settled, numbered', () => {
    const { outbox, tabs } = outboxOf(summary());
    expect(outbox.adopted).toMatchObject([{ id: 's1-03-m', number: 3, adopted: true, rankWords: 'adopted' }]);
    expect(outbox.settled).toEqual([
      { id: 's1-01-a', number: 4, title: 's1-01-a?', verdict: 'agreed', answer: 'A. Built.', by: 'marie', when: '26 Sep 2026, 10:00 UTC', url: `${PR}#issuecomment-3` },
    ]);
    expect(tabs.find((t) => t.kind === 'outbox')?.badge).toBe('3 open');
  });

  it('lets a signed-in member answer, with Send shown but not open yet', () => {
    expect(outboxOf(summary()).outbox).toMatchObject({ readOnly: false, note: null, signIn: null, sendOff: SEND_OFF.notYet, repliesUnread: null });
  });

  it('is read-only once the feature PR merged, or the PRD closed, and says so', () => {
    const merged = outboxOf(summary({ feature: { number: 221, url: PR, state: 'merged', draft: false, mergedAt: '2026-09-28T08:00:00Z' } })).outbox;
    expect(merged).toMatchObject({ readOnly: true, note: 'The feature pull request merged on 28 Sep 2026: what was still open was adopted.' });
    const closed = outboxOf(summary({ feature: null, issue: { number: 216, url: 'x', state: 'closed' } })).outbox;
    expect(closed).toMatchObject({ readOnly: true, note: 'The feature pull request closed: what was still open was adopted.' });
  });

  it('is read-only for a viewer who is not signed in, who is asked to sign in with GitHub', () => {
    expect(outboxOf(summary(), { me: null }).outbox).toMatchObject({ readOnly: true, signIn: SIGN_IN_TO_ANSWER });
    expect(SIGN_IN_TO_ANSWER).toBe('Sign in with GitHub to answer here.');
  });

  it('in the demo, Send is off and says so', () => {
    expect(outboxOf(summary(), { demo: true }).outbox).toMatchObject({ readOnly: false, sendOff: 'A demo outbox: Send is off here.' });
  });

  it('shows the outbox with no number and no pending answer when the replies could not be read, and says so', () => {
    const { outbox } = outboxOf(summary({ replies: UNREAD }));
    expect(outbox.state).toBe('items');
    expect(outbox.repliesUnread).toBe(REPLIES_UNREAD);
    expect(outbox.open.every((c) => c.number === null && c.pending === null)).toBe(true);
  });

  it('has a context rail switching between Before/after, Spec and Brainstorm, Before/after by default', () => {
    const { outbox, shown } = outboxOf(summary());
    expect(outbox.context).toEqual({
      current: 'before-after',
      links: [
        { kind: 'before-after', label: 'Before/after', href: `/prd/${ID}?tab=outbox`, current: true },
        { kind: 'spec', label: 'Spec', href: `/prd/${ID}?tab=outbox&context=spec`, current: false },
        { kind: 'brainstorm', label: 'Brainstorm', href: `/prd/${ID}?tab=outbox&context=brainstorm`, current: false },
      ],
      frame: sandboxPath(ID, 2),
      spec: 3,
      brainstorm: [
        { question: 'Square or hexagonal tiles?', answer: 'Square (Recommended)' },
        { question: 'Which checks gate the slice?', answer: 'Unit, Access' },
      ],
    });
    expect(shown).toBeNull();
  });

  it('while the rail shows the spec, its latest version is the one shown, so the route renders it', () => {
    const v = outboxOf(summary(), { query: { context: 'spec' } });
    expect(v.outbox.context?.current).toBe('spec');
    expect(v.shown).toMatchObject({ id: versions[3].id, number: 3, frame: null });
    expect(v.versions).toEqual([]);
    expect(readPick({ tab: 'outbox', context: 'elsewhere' })).toEqual({ tab: 'outbox', version: null });
  });
});

describe('the words of an unknown stage (PRD 587)', () => {
  it('appear nowhere in apps/galaxy/src: the stage is stored, so it is never unknown', () => {
    const words = ['Stage', 'unknown'].join(' ');
    const src = join(import.meta.dirname, '..', '..');
    const files = readdirSync(src, { recursive: true, encoding: 'utf8' }).filter((f) => /\.(tsx?|css)$/.test(f));
    expect(files.length).toBeGreaterThan(100);
    expect(files.filter((f) => readFileSync(join(src, f), 'utf8').includes(words))).toEqual([]);
  });
});
