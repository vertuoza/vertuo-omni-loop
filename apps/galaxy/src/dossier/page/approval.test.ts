import type { SupabaseClient } from '@supabase/supabase-js';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { DossierRow, DossierVersionRow } from '../store';
import { approvalView, readApproval, type ApprovalRow } from './approval';
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
      state: 'waiting', words: 'waiting for approval', detail: null, changed: [], canApprove: true, dossier: ID,
    });
  });

  it('is approved, with who and when, while every pinned file is still the latest of its kind', () => {
    expect(approvalView(read(born('server'), APPROVED), ADA.user_id)).toEqual({
      state: 'approved', words: 'approved', detail: 'by ada · 9 Oct 2026, 09:12 UTC', changed: [], canApprove: false, dossier: ID,
    });
  });

  it('drifts once a version newer than a pinned one was pushed, naming the file, with the button back', () => {
    expect(approvalView(read(born('server'), APPROVED, [...VERSIONS, NEWER_PLAN]), ADA.user_id)).toEqual({
      state: 'drifted', words: 'drifted · approve again', detail: 'plan.md changed since ada approved it · 9 Oct 2026, 09:12 UTC',
      changed: ['plan.md'], canApprove: true, dossier: ID,
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
      ['from', 'approvals'], ['select', 'approver_login, approved_at, files'], ['eq', 'dossier_id', ID],
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
