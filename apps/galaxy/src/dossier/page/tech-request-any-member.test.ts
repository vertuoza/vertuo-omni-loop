import { describe, expect, it, vi } from 'vitest';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import type { DossierRow } from '../store';
import { approvalView, type ApprovalRow } from './approval';
import type { DossierRead } from './view';

// Bug #2992: **Request a Tech Approval** shows to any member of the workspace on a ◆ PRD that is not
// approved and holds no request, not only to the PRD's author; a ◇ PRD still shows none of it.

vi.mock('server-only', () => ({}));

const ID = '00000000-0000-4000-8000-0000000029d1';
const ADA = { user_id: 'u-ada', email: 'ada@example.com', name: 'Ada' };
const BOB = { user_id: 'u-bob', email: 'bob@example.com', name: 'Bob' };

const dossier = (birthplace: DossierRow['birthplace']): DossierRow => ({
  id: ID, workspace_id: 'w1', home_repo: 'vertuoza/vertuo-omni-loop', prd: parsePrd(2992), title: 'A PRD Ada opened',
  opened_by: ADA.user_id, created_at: '2026-11-17T08:00:00Z', numbered_at: '2026-11-17T08:05:00Z', birthplace,
});

const APPROVED: ApprovalRow = { id: 'a-1', approver_login: 'ada', approved_at: '2026-11-17T09:00:00Z', files: [] };

const read = (birthplace: DossierRow['birthplace'], approval: DossierRead['approval'] = null): DossierRead =>
  ({ dossier: dossier(birthplace), versions: [], members: [ADA, BOB], rounds: [], approval });

describe('Request a Tech Approval, for any member (bug #2992)', () => {
  it('shows to a member who is not the author, on a ◆ PRD not yet approved', () => {
    expect(approvalView(read('server'), BOB.user_id)?.canRequestTech).toBe(true);
    expect(approvalView(read('server'), ADA.user_id)?.canRequestTech).toBe(true);
  });

  it('shows to nobody once the PRD is approved, to a visitor who is not a member, or on a ◇ PRD', () => {
    expect(approvalView(read('server', APPROVED), BOB.user_id)?.canRequestTech).toBe(false);
    expect(approvalView(read('server'), 'u-stranger')?.canRequestTech).toBe(false);
    expect(approvalView(read('server'), null)?.canRequestTech).toBe(false);
    expect(approvalView(read('repo'), BOB.user_id)).toBeNull();
  });

  it('shows to nobody once a Tech Approval is requested, or while the request cannot be read', () => {
    const asked: DossierRead = { ...read('server'), approvalFacts: { voids: [], asked: [], tech: { user: ADA.user_id, state: 'asked', approval: null } } };
    expect(approvalView(asked, BOB.user_id)?.canRequestTech).toBe(false);
    const unread: DossierRead = { ...read('server'), approvalFacts: { voids: [], asked: [], tech: 'unread' } };
    expect(approvalView(unread, BOB.user_id)?.canRequestTech).toBe(false);
  });
});
