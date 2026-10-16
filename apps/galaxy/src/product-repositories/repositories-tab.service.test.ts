import { describe, expect, it, vi } from 'vitest';
import { GONE, NOT_MEMBER, NOT_OWNER } from '../products/approvers';
import type { RepositoriesTabRepository, StoredTabLink, StoredTabProduct } from './repositories-tab.repository';
import { repositoriesTabService } from './repositories-tab.service';

// The Repositories & approvers tab's rules (PRD 1364 s11) on a fake store: what the tab shows (the
// product's links, the workspace's repositories not in it yet, whether the reader owns the workspace,
// and its Approvers list), a product of another workspace not found, and each change answered in the
// tab's shapes, a refusal by its kind and in plain words.

const ACME = 'w-acme';
const MOBILE: StoredTabProduct = { id: 'p-mobile', workspace_id: ACME, name: 'Mobile', plan_repository: null, plan_archived_at: null };
const API: StoredTabLink = { repository: 'acme/api', role: 'api', knowledge: 'own', read_at: null, read_only: false, consumes: [], added_by: 'person', ladder_step: 5 };
const APP: StoredTabLink = { repository: 'acme/app', role: null, knowledge: 'own', read_at: null, read_only: true, consumes: ['acme/api'], added_by: 'prd', ladder_step: 5 };
const ROSTER = [
  { user_id: 'u-ada', name: 'Ada', github_login: 'ada', avatar_url: null, fleet: null },
  { user_id: 'u-bo', name: null, github_login: 'bo', avatar_url: null, fleet: null },
];

type Over = Partial<{ [K in keyof RepositoriesTabRepository]: RepositoriesTabRepository[K] }>;

function store(over: Over = {}) {
  const calls: string[] = [];
  const fake: RepositoriesTabRepository = {
    product: (id) => Promise.resolve(id === MOBILE.id ? MOBILE : null),
    links: () => Promise.resolve([API, APP]),
    repositories: () => Promise.resolve(['acme/app', 'acme/api', 'acme/web', 'acme/billing']),
    owner: () => Promise.resolve(true),
    roster: () => Promise.resolve(ROSTER),
    approvers: () => Promise.resolve([{ user_id: 'u-bo', state: 'asked' as const }]),
    openBornInGit: () => Promise.resolve([]),
    archive: (product, archived) => { calls.push(`archive ${product} ${String(archived)}`); return Promise.resolve({ ok: true as const, archivedAt: archived ? '2026-10-16T09:00:00Z' : null }); },
    link: (product, link) => { calls.push(`link ${product} ${link.repository}`); return Promise.resolve({ ok: true as const, link: { ...link, added_by: 'person' as const, ladder_step: 1 } }); },
    unlink: (product, repo) => { calls.push(`unlink ${product} ${repo}`); return Promise.resolve({ ok: true as const, removed: true }); },
    setApprover: (product, member, state) => { calls.push(`set ${product} ${member} ${state}`); return Promise.resolve({ ok: true as const, state }); },
    removeApprover: (product, member) => { calls.push(`remove ${product} ${member}`); return Promise.resolve({ ok: true as const, removed: true }); },
    ...over,
  };
  return { service: repositoriesTabService(fake), calls };
}

describe('the tab', () => {
  it('shows the product\'s links, the repositories not in it yet, the owner flag and the Approvers list', async () => {
    expect(await store().service.tab(ACME, MOBILE.id)).toEqual({
      product: { id: MOBILE.id, name: 'Mobile' },
      owner: true,
      links: [
        { repo: 'acme/api', role: 'api', knowledge: 'own', readAt: null, readOnly: false, consumes: [], addedBy: 'person', ladderStep: 5 },
        { repo: 'acme/app', role: null, knowledge: 'own', readAt: null, readOnly: true, consumes: ['acme/api'], addedBy: 'prd', ladderStep: 5 },
      ],
      addable: ['acme/billing', 'acme/web'],
      approvers: {
        owner: true,
        members: [{ id: 'u-ada', name: 'Ada', login: 'ada' }, { id: 'u-bo', name: null, login: 'bo' }],
        listed: [{ id: 'u-bo', name: null, login: 'bo', state: 'asked' }],
      },
      plan: null,
    });
  });

  it('is not found for a product the reader does not read, or one of another workspace', async () => {
    expect(await store().service.tab(ACME, 'p-nothing')).toBeNull();
    expect(await store().service.tab('w-other', MOBILE.id)).toBeNull();
  });

  it('reads a member, or anyone whose role cannot be read, as no owner', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await store({ owner: () => Promise.resolve(false) }).service.tab(ACME, MOBILE.id)).toMatchObject({ owner: false, approvers: { owner: false } });
    expect(await store({ owner: () => Promise.reject(new Error('down')) }).service.tab(ACME, MOBILE.id)).toMatchObject({ owner: false });
  });

  it('keeps the links when the Approvers list cannot be read, and says so with a null list', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await store({ roster: () => Promise.reject(new Error('down')) }).service.tab(ACME, MOBILE.id)).toMatchObject({ approvers: null, links: [{ repo: 'acme/api' }, { repo: 'acme/app' }] });
    expect(await store({ approvers: () => Promise.reject(new Error('down')) }).service.tab(ACME, MOBILE.id)).toMatchObject({ approvers: null });
  });

  it('throws when the links cannot be read', async () => {
    await expect(store({ links: () => Promise.reject(new Error('down')) }).service.tab(ACME, MOBILE.id)).rejects.toThrow('down');
  });
});

describe('the changes', () => {
  const write = { repo: 'Acme/Web', role: ' web ', knowledge: 'own' as const, readAt: null, readOnly: false, consumes: ['acme/api'] };

  it('writes a link with every field, the repository in lower case and an empty role as none', async () => {
    const { service, calls } = store();
    expect(await service.saveLink(MOBILE.id, write)).toEqual({
      ok: true,
      value: { link: { repo: 'acme/web', role: 'web', knowledge: 'own', readAt: null, readOnly: false, consumes: ['acme/api'], addedBy: 'person', ladderStep: 1 } },
    });
    expect(calls).toEqual([`link ${MOBILE.id} acme/web`]);
    expect(await service.saveLink(MOBILE.id, { ...write, role: '  ' })).toMatchObject({ ok: true, value: { link: { role: null } } });
  });

  it('refuses a link write by kind, in the database\'s own words', async () => {
    const refusing = (code: string | null, message: string) => store({ link: () => Promise.resolve({ ok: false as const, code, message }) }).service;
    expect(await refusing('42501', 'Only an owner of the workspace changes the repositories of Mobile.').saveLink(MOBILE.id, write))
      .toEqual({ ok: false, kind: 'not-owner', error: 'Only an owner of the workspace changes the repositories of Mobile.' });
    expect(await refusing('22023', 'Role: Web App is not one kebab-case word.').saveLink(MOBILE.id, write))
      .toEqual({ ok: false, kind: 'refused', error: 'Role: Web App is not one kebab-case word.' });
    expect(await refusing('P0002', 'Repository: no repository acme/web in this workspace.').saveLink(MOBILE.id, write))
      .toEqual({ ok: false, kind: 'refused', error: 'Repository: no repository acme/web in this workspace.' });
    expect(await refusing('XX000', 'boom').saveLink(MOBILE.id, write)).toEqual({ ok: false, kind: 'database', error: 'boom' });
  });

  it('takes a repository out, or refuses while another consumes it', async () => {
    const { service, calls } = store();
    expect(await service.removeLink(MOBILE.id, 'Acme/API')).toEqual({ ok: true, value: { repo: 'acme/api', removed: true } });
    expect(calls).toEqual([`unlink ${MOBILE.id} acme/api`]);
    const consumed = 'Consumes: acme/app consumes acme/api; take it out of its consumes first.';
    expect(await store({ unlink: () => Promise.resolve({ ok: false as const, code: '22023', message: consumed }) }).service.removeLink(MOBILE.id, 'acme/api'))
      .toEqual({ ok: false, kind: 'refused', error: consumed });
  });

  it('sets and removes an approver, a refusal in the page\'s own words', async () => {
    const { service, calls } = store();
    expect(await service.setApprover(MOBILE.id, 'u-ada', 'skipped')).toEqual({ ok: true, value: { member: 'u-ada', state: 'skipped' } });
    expect(await service.removeApprover(MOBILE.id, 'u-ada')).toEqual({ ok: true, value: { member: 'u-ada', removed: true } });
    expect(calls).toEqual([`set ${MOBILE.id} u-ada skipped`, `remove ${MOBILE.id} u-ada`]);
    const refusing = (code: string) => store({ setApprover: () => Promise.resolve({ ok: false as const, code, message: 'x' }), removeApprover: () => Promise.resolve({ ok: false as const, code, message: 'x' }) }).service;
    expect(await refusing('42501').setApprover(MOBILE.id, 'u-ada', 'asked')).toEqual({ ok: false, kind: 'not-owner', error: NOT_OWNER });
    expect(await refusing('22023').setApprover(MOBILE.id, 'u-ada', 'asked')).toEqual({ ok: false, kind: 'refused', error: NOT_MEMBER });
    expect(await refusing('P0002').removeApprover(MOBILE.id, 'u-ada')).toEqual({ ok: false, kind: 'missing', error: GONE });
  });
});

describe('the plan repository and its archive (PRD 2011 s17)', () => {
  const PLANNED: StoredTabProduct = { ...MOBILE, plan_repository: 'acme/plan', plan_archived_at: null };
  const planned = (over: Over = {}) => store({ product: () => Promise.resolve(PLANNED), ...over });
  const below = { ...APP, ladder_step: 3 };

  it('shows no plan while the product names none', async () => {
    expect((await store().service.tab(ACME, MOBILE.id))?.plan).toBeNull();
  });

  it('offers Archive when nothing holds the plan repository', async () => {
    expect((await planned().service.tab(ACME, MOBILE.id))?.plan).toEqual({ repository: 'acme/plan', archivedAt: null, holds: [] });
  });

  it('names each hold: a repository below step 5 (the plan repository itself never holds), then a record born in git still open', async () => {
    const { service } = planned({
      links: () => Promise.resolve([API, below, { ...API, repository: 'acme/plan', ladder_step: 1 }]),
      openBornInGit: () => Promise.resolve([{ kind: 'roadmap', number: 412 }, { kind: 'bug', number: 1210 }, { kind: 'prd', number: 2011 }]),
    });
    expect((await service.tab(ACME, MOBILE.id))?.plan?.holds).toEqual([
      { name: 'app', why: 'step 3' },
      { name: 'roadmap 0412', why: 'in git' },
      { name: 'bug 1210', why: 'in git' },
      { name: 'PRD 2011', why: 'in git' },
    ]);
  });

  it('says an archived plan repository with no hold, whatever is open', async () => {
    const { service } = planned({ product: () => Promise.resolve({ ...PLANNED, plan_archived_at: '2026-10-16T09:00:00Z' }), links: () => Promise.resolve([below]) });
    expect((await service.tab(ACME, MOBILE.id))?.plan).toEqual({ repository: 'acme/plan', archivedAt: '2026-10-16T09:00:00Z', holds: [] });
  });

  it('holds the archive, saying so, when what is open cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { service } = planned({ openBornInGit: () => Promise.reject(new Error('down')) });
    expect((await service.tab(ACME, MOBILE.id))?.plan?.holds).toEqual([{ name: 'Open records', why: 'could not be read just now' }]);
    expect(await service.archive(MOBILE.id, true)).toEqual({ ok: false, kind: 'refused', error: 'Archive: still held by Open records: could not be read just now.' });
  });

  it('refuses Archive naming every hold, and calls the database for nothing', async () => {
    const { service, calls } = planned({ links: () => Promise.resolve([below]), openBornInGit: () => Promise.resolve([{ kind: 'roadmap', number: 412 }]) });
    expect(await service.archive(MOBILE.id, true)).toEqual({ ok: false, kind: 'refused', error: 'Archive: still held by app at step 3 · roadmap 0412 born in git, open.' });
    expect(calls).toEqual([]);
  });

  it('archives once nothing holds it, and undoes it without looking at the holds', async () => {
    const { service, calls } = planned();
    expect(await service.archive(MOBILE.id, true)).toEqual({ ok: true, value: { archivedAt: '2026-10-16T09:00:00Z' } });
    const open = planned({ links: () => Promise.resolve([below]), openBornInGit: () => Promise.resolve([{ kind: 'prd', number: 7 }]) });
    expect(await open.service.archive(MOBILE.id, false)).toEqual({ ok: true, value: { archivedAt: null } });
    expect(calls).toEqual([`archive ${MOBILE.id} true`]);
    expect(open.calls).toEqual([`archive ${MOBILE.id} false`]);
  });

  it('is refused to anyone who does not own the workspace, and for a product it does not read', async () => {
    const member = planned({ owner: () => Promise.resolve(false) });
    expect(await member.service.archive(MOBILE.id, true)).toMatchObject({ ok: false, kind: 'not-owner' });
    expect(member.calls).toEqual([]);
    expect(await store().service.archive('p-nothing', true)).toEqual({ ok: false, kind: 'missing', error: 'No such product.' });
  });

  it("keeps the database's refusal by kind, its ladder words included", async () => {
    const refusing = (code: string | null, message: string) => planned({ archive: () => Promise.resolve({ ok: false as const, code, message }) }).service;
    expect(await refusing('55000', 'Archive: still held by web at step 4.').archive(MOBILE.id, true)).toEqual({ ok: false, kind: 'refused', error: 'Archive: still held by web at step 4.' });
    expect(await refusing('22023', 'Archived: true or false.').archive(MOBILE.id, true)).toMatchObject({ kind: 'refused' });
    expect(await refusing('42501', 'Only an owner.').archive(MOBILE.id, true)).toMatchObject({ kind: 'not-owner' });
    expect(await refusing('P0002', 'gone').archive(MOBILE.id, true)).toMatchObject({ kind: 'missing' });
    expect(await refusing('XX000', 'boom').archive(MOBILE.id, true)).toEqual({ ok: false, kind: 'database', error: 'boom' });
  });
});
