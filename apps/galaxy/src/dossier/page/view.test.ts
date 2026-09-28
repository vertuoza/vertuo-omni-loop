import { describe, it, expect } from 'vitest';
import type { DossierRoundRow, DossierRow, DossierVersionRow } from '../store';
import { dossierView, readPick, sandboxPath, shortDay, stamp, versionSource } from './view';

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
  it('reads Questions, answered out of asked, then Before/after, Spec, Plan, each with its latest version', () => {
    expect(view().tabs).toEqual([
      { kind: 'questions', label: 'Questions', badge: '2/4 answered', href: `/prd/${ID}`, current: true },
      { kind: 'before-after', label: 'Before/after', badge: 'v2', href: `/prd/${ID}?tab=before-after`, current: false },
      { kind: 'spec', label: 'Spec', badge: 'v3', href: `/prd/${ID}?tab=spec`, current: false },
      { kind: 'plan', label: 'Plan', badge: null, href: `/prd/${ID}?tab=plan`, current: false },
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
      ]);
    }
  });

  it('counts no question when none was asked, or when they could not be read', () => {
    expect(view(readPick({}), numbered, PIERRE.user_id, versions, []).tabs[0].badge).toBeNull();
    expect(view(readPick({}), numbered, PIERRE.user_id, versions, null).tabs[0].badge).toBeNull();
  });

  it('opens the tab the address names, whatever the default', () => {
    for (const asked of [rounds, []]) {
      for (const tab of ['questions', 'before-after', 'spec', 'plan'] as const) {
        const v = view(readPick({ tab }), numbered, PIERRE.user_id, versions, asked);
        expect(v.tab, `${tab}, ${asked.length} rounds`).toBe(tab);
        expect(v.tabs.find((t) => t.current)?.kind).toBe(tab);
      }
    }
  });

  it('falls back to the default for a tab it does not know', () => {
    expect(view(readPick({ tab: 'outbox' })).tab).toBe('questions');
    expect(view(readPick({ tab: 'outbox' }), numbered, PIERRE.user_id, versions, []).tab).toBe('before-after');
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
    expect([q.answered, q.asked]).toEqual([2, 4]);
  });

  it('shows each question with its options, the chosen ones marked, and the answer as given', () => {
    const [first, second] = questions().questions.rounds ?? [];
    expect(first.questions).toEqual([{
      header: 'Shape', question: 'Square or hexagonal tiles?', multiSelect: false, answer: 'Square (Recommended)',
      options: [
        { label: 'Square', recommended: true, description: 'cheaper', chosen: true },
        { label: 'Hexagonal', recommended: false, description: 'prettier', chosen: false },
      ],
    }]);
    expect(second.questions[0].options.map((o) => [o.label, o.chosen])).toEqual([['Unit', true], ['Access', true], ['Manual', false]]);
    expect(second.questions[0].answer).toBe('Unit, Access');
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
    expect(first).toMatchObject({ asked: 'asked by Pierre · 27 Sep 2026, 09:15 UTC', category: 'UX/UI', categoryValue: 'ux-ui', href: '/ask/q/r1' });
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
    expect(only.questions).toEqual([{ header: '', question: 'Asked in the terminal?', multiSelect: false, options: [], answer: 'Yes' }]);
    expect(only.outcome).toBe('answered by someone who left the workspace after 42 s, in the terminal');
  });

  it('has no rounds to list when they could not be read', () => {
    expect(view(readPick({ tab: 'questions' }), numbered, PIERRE.user_id, versions, null).questions).toEqual({ rounds: null, asked: 0, answered: 0 });
  });
});

describe('what the address picks', () => {
  it('reads the tab and the version', () => {
    expect(readPick({ tab: 'plan', v: '4' })).toEqual({ tab: 'plan', version: 4 });
    expect(readPick({ tab: ['spec', 'plan'], v: ['2'] })).toEqual({ tab: 'spec', version: 2 });
    expect(readPick({ tab: 'questions' })).toEqual({ tab: 'questions', version: null });
    expect(readPick({ tab: 'before-after' })).toEqual({ tab: 'before-after', version: null });
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
