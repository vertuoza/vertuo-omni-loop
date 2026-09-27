import { describe, it, expect } from 'vitest';
import type { DossierRow, DossierVersionRow } from '../store';
import { dossierView, readPick, sandboxPath, shortDay, stamp, versionSource } from './view';

// /prd/<id> (PRD 216), as pure functions of the rows the viewer may read, the workspace's members and
// what the address picks: the header, the tabs, and each artifact's versions, newest first.

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

const view = (pick = readPick({}), dossier = numbered, me = PIERRE.user_id, rows = versions) =>
  dossierView({ dossier, versions: rows, members: MEMBERS }, me, pick);

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
  it('reads Before/after, Spec, Plan, each with its latest version, Before/after first', () => {
    expect(view().tabs).toEqual([
      { kind: 'before-after', label: 'Before/after', latest: 2, href: `/prd/${ID}`, current: true },
      { kind: 'spec', label: 'Spec', latest: 3, href: `/prd/${ID}?tab=spec`, current: false },
      { kind: 'plan', label: 'Plan', latest: null, href: `/prd/${ID}?tab=plan`, current: false },
    ]);
  });

  it('opens the tab the address names', () => {
    const v = view(readPick({ tab: 'spec' }));
    expect(v.tab).toBe('spec');
    expect(v.tabs.find((t) => t.current)?.kind).toBe('spec');
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
    const page = view();
    expect(page.shown).toMatchObject({ number: 2, frame: `/prd/${ID}/v/2/page` });
    expect(page.versions.map((v) => v.href)).toEqual([`/prd/${ID}?v=2`, `/prd/${ID}?v=1`]);
  });
});

describe('what the address picks', () => {
  it('reads the tab and the version', () => {
    expect(readPick({ tab: 'plan', v: '4' })).toEqual({ tab: 'plan', version: 4 });
    expect(readPick({ tab: ['spec', 'plan'], v: ['2'] })).toEqual({ tab: 'spec', version: 2 });
  });

  it('opens Before/after for a tab it does not know, and the latest version for a version that is not one', () => {
    for (const tab of [undefined, 'questions', 'spec.md', '']) expect(readPick({ tab }), String(tab)).toEqual({ tab: 'before-after', version: null });
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
