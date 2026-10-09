import type { SupabaseClient } from '@supabase/supabase-js';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { DossierRow, DossierVersionRow } from '../store';
import {
  approvalView, readApproval, readApproveScreen, readAskedApprovers, readVoids, type ApprovalFacts, type ApprovalRow, type ApprovalVoid,
} from './approval';
import { DossierPage } from './DossierPage';
import { dossierView, readPick, type DossierRead } from './view';

// The approval of a PRD born on the server (PRD 1299 s3), on its page: waiting for approval with the
// Approve button, approved with who and when, or drifted · approve again with the files changed since.
// A PRD born in the repository (◇) shows none of it, and only a member of its workspace sees the button.

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', async (original) => ({ ...(await original<typeof import('next/navigation')>()), useRouter: () => ({ refresh: () => {} }) }));

const ID = '00000000-0000-4000-8000-0000000000d1';
const ADA = { user_id: 'u-ada', email: 'ada@vertuoza.com', name: 'Ada' };

/** A dossier row as it read before PRD 1299: no birthplace. */
const unborn = (): DossierRow => ({
  id: ID, workspace_id: 'w1', home_repo: 'vertuoza/vertuo-omni-loop', prd: parsePrd(1299), title: 'Phase 0 approved on the server',
  opened_by: ADA.user_id, created_at: '2026-10-09T08:00:00Z', numbered_at: '2026-10-09T08:05:00Z',
});
const born = (birthplace: DossierRow['birthplace']): DossierRow => ({ ...unborn(), birthplace });

const version = (id: string, kind: DossierVersionRow['kind'], at: string): DossierVersionRow => ({
  id, dossier_id: ID, kind, bytes: 10, source: 'kit', uploaded_by: ADA.user_id, commit_sha: null, created_at: at,
});

// Oldest first, as the reader lists them.
const VERSIONS = [
  version('v-spec-1', 'spec', '2026-10-09T08:05:00Z'),
  version('v-plan-1', 'plan', '2026-10-09T08:06:00Z'),
  version('v-ba-1', 'before-after', '2026-10-09T08:07:00Z'),
];
const NEWER_PLAN = version('v-plan-2', 'plan', '2026-10-09T10:00:00Z');

const APPROVED: ApprovalRow = {
  id: 'a-1',
  approver_login: 'ada',
  approved_at: '2026-10-09T09:12:00Z',
  files: [
    { kind: 'spec', path: 'spec.md', version_id: 'v-spec-1' },
    { kind: 'plan', path: 'plan.md', version_id: 'v-plan-1' },
    { kind: 'before-after', path: 'before-after.html', version_id: 'v-ba-1' },
  ],
};

const read = (dossier: DossierRow, approval: DossierRead['approval'], versions = VERSIONS): DossierRead =>
  ({ dossier, versions, members: [ADA], rounds: [], approval });

const page = (r: DossierRead, me: string | null = ADA.user_id) =>
  renderToStaticMarkup(createElement(DossierPage, { view: dossierView(r, me, readPick({})), markdown: null, supabase: null }));

describe('approvalView', () => {
  it('waits for approval while none was given, with the button for a member', () => {
    expect(approvalView(read(born('server'), null), ADA.user_id)).toEqual({
      state: 'waiting', words: 'waiting for approval', detail: null, changed: [], canApprove: true, dossier: ID, screen: null,
    });
  });

  it('is approved, with who and when, while every pinned file is still the latest of its kind', () => {
    expect(approvalView(read(born('server'), APPROVED), ADA.user_id)).toEqual({
      state: 'approved', words: 'approved', detail: 'by ada · 9 Oct 2026, 09:12 UTC', changed: [], canApprove: false, dossier: ID, screen: null,
    });
  });

  it('drifts once a version newer than a pinned one was pushed, naming the file, with the button back', () => {
    expect(approvalView(read(born('server'), APPROVED, [...VERSIONS, NEWER_PLAN]), ADA.user_id)).toEqual({
      state: 'drifted', words: 'drifted · approve again', detail: 'plan.md changed since ada approved it · 9 Oct 2026, 09:12 UTC',
      changed: ['plan.md'], canApprove: true, dossier: ID, screen: null,
    });
  });

  it('names every changed file, in the order they were pinned', () => {
    const changed = [...VERSIONS, NEWER_PLAN, version('v-spec-2', 'spec', '2026-10-09T11:00:00Z')];
    expect(approvalView(read(born('server'), APPROVED, changed), ADA.user_id)?.changed).toEqual(['spec.md', 'plan.md']);
  });

  it('does not drift on a kind that was not pinned', () => {
    const voice = [...VERSIONS, version('v-voice-1', 'voice', '2026-10-09T10:00:00Z')];
    expect(approvalView(read(born('server'), APPROVED, voice), ADA.user_id)?.state).toBe('approved');
  });

  it('never drifts on a newer voice, which the loop appends after approval', () => {
    const pinnedVoice: ApprovalRow = { ...APPROVED, files: [...APPROVED.files, { kind: 'voice', path: 'voice.json', version_id: 'v-voice-1' }] };
    const voice = [...VERSIONS, version('v-voice-2', 'voice', '2026-10-09T12:00:00Z')];
    expect(approvalView(read(born('server'), pinnedVoice, voice), ADA.user_id)?.state).toBe('approved');
  });

  it('says so when the approval could not be read, and offers no button', () => {
    expect(approvalView(read(born('server'), 'unread'), ADA.user_id)).toMatchObject({ state: 'unread', canApprove: false });
    expect(approvalView(read(born('server'), undefined), ADA.user_id)).toMatchObject({ state: 'unread', canApprove: false });
  });

  it('offers no button to a viewer who is not a member of the workspace', () => {
    expect(approvalView(read(born('server'), null), 'u-stranger')?.canApprove).toBe(false);
    expect(approvalView(read(born('server'), null), null)?.canApprove).toBe(false);
    expect(approvalView(read(born('server'), APPROVED, [...VERSIONS, NEWER_PLAN]), 'u-stranger')?.canApprove).toBe(false);
  });

  it('is none for a PRD born in the repository, a PRD not born yet, a draft or a fix', () => {
    expect(approvalView(read(born('repo'), null), ADA.user_id)).toBeNull();
    expect(approvalView(read(born(null), null), ADA.user_id)).toBeNull();
    expect(approvalView(read(born(undefined), null), ADA.user_id)).toBeNull();
    expect(approvalView(read({ ...born('server'), prd: null }, null), ADA.user_id)).toBeNull();
    expect(approvalView(read({ ...born('server'), kind: 'bug' }, null), ADA.user_id)).toBeNull();
  });
});

describe('readApproval', () => {
  const db = (answer: { data: unknown; error: { message: string } | null }) => {
    const calls: unknown[][] = [];
    const builder = {
      select: (...a: unknown[]) => (calls.push(['select', ...a]), builder),
      eq: (...a: unknown[]) => (calls.push(['eq', ...a]), builder),
      order: (...a: unknown[]) => (calls.push(['order', ...a]), builder),
      limit: (...a: unknown[]) => (calls.push(['limit', ...a]), builder),
      maybeSingle: () => Promise.resolve(answer),
    };
    // Only the steps readApproval takes: the rest of a Supabase client is never reached.
    const client = { from: (table: string) => (calls.push(['from', table]), builder) } as unknown as Pick<SupabaseClient, 'from'>;
    return { calls, client };
  };

  it('reads the latest approval of the dossier, as the member', async () => {
    const stub = db({ data: { ...APPROVED, files: [...APPROVED.files.map((f) => ({ ...f, sha256: 'abc' }))] }, error: null });
    expect(await readApproval(stub.client, ID)).toEqual({ ...APPROVED, files: APPROVED.files.map((f) => ({ ...f, sha256: 'abc' })) });
    expect(stub.calls).toEqual([
      ['from', 'approvals'], ['select', 'id, approver_login, approved_at, files'], ['eq', 'dossier_id', ID],
      ['order', 'approved_at', { ascending: false }], ['order', 'id', { ascending: false }], ['limit', 1],
    ]);
  });

  it('reads null when nobody approved yet', async () => {
    expect(await readApproval(db({ data: null, error: null }).client, ID)).toBeNull();
  });

  it('throws when the database fails or answers out of shape', async () => {
    await expect(readApproval(db({ data: null, error: { message: 'down' } }).client, ID)).rejects.toThrow('read the approval: down');
    await expect(readApproval(db({ data: { approver_login: 'ada', approved_at: 'never', files: [] }, error: null }).client, ID)).rejects.toThrow('out of shape');
    await expect(readApproval(db({ data: { ...APPROVED, files: [{ kind: 'spec' }] }, error: null }).client, ID)).rejects.toThrow('out of shape');
  });
});

describe('the PRD page', () => {
  it('shows a ◆ PRD waiting for approval, with the Approve button', () => {
    const html = page(read(born('server'), null));
    expect(html).toContain('<dt>Approval</dt>');
    expect(html).toContain('waiting for approval');
    expect(html).toMatch(/<button[^>]*>Approve<\/button>/);
  });

  it('shows a ◆ PRD approved, with who and when, and no button', () => {
    const html = page(read(born('server'), APPROVED));
    expect(html).toContain('approved');
    expect(html).toContain('by ada · 9 Oct 2026, 09:12 UTC');
    expect(html).not.toMatch(/<button[^>]*>Approve<\/button>/);
  });

  it('shows a ◆ PRD drifted · approve again, with the changed files and the button back', () => {
    const html = page(read(born('server'), APPROVED, [...VERSIONS, NEWER_PLAN]));
    expect(html).toContain('drifted · approve again');
    expect(html).toContain('plan.md changed since ada approved it');
    expect(html).toMatch(/<button[^>]*>Approve<\/button>/);
  });

  it('says when the approval could not be read', () => {
    expect(page(read(born('server'), 'unread'))).toContain('The approval could not be read');
  });

  it('shows no button to a viewer outside the workspace', () => {
    expect(page(read(born('server'), null), 'u-stranger')).not.toMatch(/<button[^>]*>Approve<\/button>/);
  });

  it('leaves a ◇ PRD exactly as it was', () => {
    const repo = page(read(born('repo'), null));
    expect(repo).not.toContain('Approval');
    expect(repo).not.toContain('Approve');
    expect(repo).toBe(page({ dossier: unborn(), versions: VERSIONS, members: [ADA], rounds: [] }));
  });
});

// PRD 1322 s7: who may approve, the voided state, and the approve screen.

const VOID: ApprovalVoid = {
  approval_id: 'a-1', kind: 'plan', from_sha256: 'a'.repeat(64), to_sha256: 'b'.repeat(64), pusher_login: 'bob', voided_at: '2026-10-09T10:00:00Z',
};
const BOB = { user_id: 'u-bob', email: 'bob@vertuoza.com', name: 'Bob' };
const withFacts = (r: DossierRead, facts: ApprovalFacts): DossierRead => ({ ...r, members: [ADA, BOB], approvalFacts: facts });

describe('approvalView, with the product\'s approvers and the voids', () => {
  it('gives the button only to a member the product asks, once it asks someone', () => {
    const r = withFacts(read(born('server'), null), { voids: [], asked: [ADA.user_id] });
    expect(approvalView(r, ADA.user_id)?.canApprove).toBe(true);
    expect(approvalView(r, BOB.user_id)?.canApprove).toBe(false);
    expect(approvalView(r, BOB.user_id)?.state).toBe('waiting');
  });

  it('gives it to any member when the product asks nobody, or its list could not be read', () => {
    expect(approvalView(withFacts(read(born('server'), null), { voids: [], asked: [] }), BOB.user_id)?.canApprove).toBe(true);
    expect(approvalView(withFacts(read(born('server'), null), { voids: [], asked: 'unread' }), BOB.user_id)?.canApprove).toBe(true);
    expect(approvalView(withFacts(read(born('server'), null), { voids: [], asked: 'unread' }), 'u-stranger')?.canApprove).toBe(false);
  });

  it('reads voided · approve again once a void follows the approval in force, naming the push and the voided file', () => {
    const view = approvalView(withFacts(read(born('server'), APPROVED), { voids: [VOID], asked: [] }), ADA.user_id);
    expect(view).toMatchObject({
      state: 'voided', words: 'voided · approve again', changed: ['plan.md'], canApprove: true,
      detail: 'voided by bob\'s push aaaaaaa→bbbbbbb · 9 Oct 2026, 10:00 UTC · ada had approved it 9 Oct 2026, 09:12 UTC',
    });
  });

  it('ignores the voids of an earlier approval', () => {
    const view = approvalView(withFacts(read(born('server'), APPROVED), { voids: [{ ...VOID, approval_id: 'a-0' }], asked: [] }), ADA.user_id);
    expect(view?.state).toBe('approved');
  });

  it('carries the approve screen only to a viewer who gets the button', () => {
    const screen = { diffs: [], sections: [], spec: 'none' as const };
    const r = withFacts(read(born('server'), null), { voids: [], asked: [ADA.user_id], screen });
    expect(approvalView(r, ADA.user_id)?.screen).toBe(screen);
    expect(approvalView(r, BOB.user_id)?.screen).toBeNull();
  });
});

describe('readApproveScreen', () => {
  const SPEC_1 = '---\nprd: 7\n---\n# T\n\n## Problem\n\nNobody is told.\n\n## Solution\n\nAsk **them**.\n\n## Scope\n\nAll.\n';
  const contents: Record<string, string> = {
    'v-spec-1': SPEC_1, 'v-plan-1': 'one\ntwo\nthree', 'v-plan-2': 'one\n2\nthree', 'v-ba-1': '<p>page</p>',
  };
  const content = (id: string) => Promise.resolve(contents[id] ?? null);

  it('reads the spec\'s Problem and Solution, rendered, and no other section', async () => {
    const screen = await readApproveScreen(content, VERSIONS, null, { changed: [] });
    expect(screen).toEqual({
      diffs: [], spec: 'read',
      sections: [{ name: 'Problem', html: '<p>Nobody is told.</p>\n' }, { name: 'Solution', html: '<p>Ask <strong>them</strong>.</p>\n' }],
    });
  });

  it('reads each changed file\'s diff from the pinned version to the latest', async () => {
    const screen = await readApproveScreen(content, [...VERSIONS, NEWER_PLAN], APPROVED, { changed: ['plan.md'] });
    expect(screen.diffs).toEqual([{ path: 'plan.md', rows: [
      { sign: ' ', text: 'one' }, { sign: '-', text: 'two' }, { sign: '+', text: '2' }, { sign: ' ', text: 'three' },
    ] }]);
  });

  it('says when a version could not be read, and when the spec has neither section', async () => {
    const failing = (id: string) => (id === 'v-plan-2' || id === 'v-spec-1' ? Promise.reject(new Error('down')) : content(id));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const screen = await readApproveScreen(failing, [...VERSIONS, NEWER_PLAN], APPROVED, { changed: ['plan.md'] });
    expect(screen).toEqual({ diffs: [{ path: 'plan.md', rows: null }], sections: [], spec: 'unread' });
    const bare = await readApproveScreen((id) => Promise.resolve(id === 'v-spec-1' ? '# Only a title\n' : null), VERSIONS, null, { changed: [] });
    expect(bare.spec).toBe('none');
    expect((await readApproveScreen(content, [], null, { changed: [] })).spec).toBe('none');
  });
});

describe('readVoids and readAskedApprovers', () => {
  /** A client whose every query answers the next of `answers`, recording each step. */
  const client = (answers: { data: unknown; error: { message: string } | null }[]) => {
    const calls: unknown[][] = [];
    const next = () => Promise.resolve(answers.shift() ?? { data: null, error: null });
    const builder = {
      select: (...a: unknown[]) => (calls.push(['select', ...a]), builder),
      eq: (...a: unknown[]) => (calls.push(['eq', ...a]), builder),
      order: (...a: unknown[]) => (calls.push(['order', ...a]), builder),
      maybeSingle: next,
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => next().then(resolve, reject),
    };
    // Only the steps the readers take: the rest of a Supabase client is never reached.
    const db = { from: (table: string) => (calls.push(['from', table]), builder) } as unknown as Pick<SupabaseClient, 'from'>;
    return { calls, db };
  };

  it('reads the dossier\'s voids, oldest first', async () => {
    const stub = client([{ data: [VOID], error: null }]);
    expect(await readVoids(stub.db, ID)).toEqual([VOID]);
    expect(stub.calls).toEqual([
      ['from', 'approval_voids'], ['select', 'approval_id, kind, from_sha256, to_sha256, pusher_login, voided_at'],
      ['eq', 'dossier_id', ID], ['order', 'voided_at', { ascending: true }],
    ]);
  });

  it('throws when the voids cannot be read or answer out of shape', async () => {
    await expect(readVoids(client([{ data: null, error: { message: 'down' } }]).db, ID)).rejects.toThrow('down');
    await expect(readVoids(client([{ data: [{ kind: 'plan' }], error: null }]).db, ID)).rejects.toThrow('out of shape');
  });

  const DOSSIER = { workspace_id: 'w1', home_repo: 'acme/widgets' };

  it('reads the members the repository\'s product asks to approve', async () => {
    const stub = client([{ data: { product_id: 'p1' }, error: null }, { data: [{ user_id: 'u-ada' }], error: null }]);
    expect(await readAskedApprovers(stub.db, DOSSIER)).toEqual(['u-ada']);
    expect(stub.calls).toEqual([
      ['from', 'repositories'], ['select', 'product_id'], ['eq', 'workspace_id', 'w1'], ['eq', 'full_name', 'acme/widgets'],
      ['from', 'product_approvers'], ['select', 'user_id'], ['eq', 'product_id', 'p1'], ['eq', 'state', 'asked'],
    ]);
  });

  it('reads nobody for a repository not tracked, or with no product', async () => {
    expect(await readAskedApprovers(client([{ data: null, error: null }]).db, DOSSIER)).toEqual([]);
    expect(await readAskedApprovers(client([{ data: { product_id: null }, error: null }]).db, DOSSIER)).toEqual([]);
  });

  it('throws when either read fails or answers out of shape', async () => {
    await expect(readAskedApprovers(client([{ data: null, error: { message: 'down' } }]).db, DOSSIER)).rejects.toThrow('down');
    await expect(readAskedApprovers(client([{ data: { product_id: 3 }, error: null }]).db, DOSSIER)).rejects.toThrow('out of shape');
    await expect(readAskedApprovers(client([{ data: { product_id: 'p1' }, error: null }, { data: null, error: { message: 'gone' } }]).db, DOSSIER)).rejects.toThrow('gone');
    await expect(readAskedApprovers(client([{ data: { product_id: 'p1' }, error: null }, { data: [{}], error: null }]).db, DOSSIER)).rejects.toThrow('out of shape');
  });
});

describe('the approve screen on the page', () => {
  const screenOf = (html: string) => /<section class="dossier-approve-screen"[\s\S]*?<\/section>/.exec(html)?.[0] ?? '';
  const SCREEN = {
    diffs: [{ path: 'plan.md', rows: [{ sign: '-' as const, text: 'two' }, { sign: '+' as const, text: '2' }, { sign: '…' as const, text: '' }] }],
    sections: [{ name: 'Problem' as const, html: '<p>Nobody is told.</p>' }, { name: 'Solution' as const, html: '<p>Ask them.</p>' }],
    spec: 'read' as const,
  };

  it('shows the changed file\'s diff, then Problem and Solution, then Approve, and no Approve among the actions', () => {
    const html = page(withFacts(read(born('server'), APPROVED, [...VERSIONS, NEWER_PLAN]), { voids: [VOID], asked: [], screen: SCREEN }));
    const screen = screenOf(html);
    expect(screen).toContain('<pre class="dossier-diff" aria-label="Changes to plan.md"><span class="dossier-diff-del">- two\n</span><span class="dossier-diff-add">+ 2\n</span><span class="dossier-diff-gap">…\n</span></pre>');
    const order = ['<h3>plan.md</h3>', '<h2>Problem</h2>', '<h2>Solution</h2>', '>Approve</button>'].map((s) => screen.indexOf(s));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(/<div class="dossier-actions">[\s\S]*?<\/div>/.exec(html)?.[0]).not.toContain('Approve');
  });

  it('says when a changed file or the spec could not be read', () => {
    const unread = { diffs: [{ path: 'plan.md', rows: null }], sections: [], spec: 'unread' as const };
    const screen = screenOf(page(withFacts(read(born('server'), null), { voids: [], asked: [], screen: unread })));
    expect(screen).toContain('This file’s change could not be read');
    expect(screen).toContain('The spec could not be read');
    expect(screen).toContain('>Approve</button>');
  });

  it('shows no screen to a viewer who may not approve, nor once approved', () => {
    expect(page(withFacts(read(born('server'), null), { voids: [], asked: [ADA.user_id], screen: SCREEN }), BOB.user_id)).not.toContain('dossier-approve-screen');
    expect(page(read(born('server'), APPROVED))).not.toContain('dossier-approve-screen');
  });
});
