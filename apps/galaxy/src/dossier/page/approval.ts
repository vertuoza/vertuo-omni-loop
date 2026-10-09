import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Member } from '../../ask/page/question';
import type { DossierRow, DossierVersionRow } from '../store';
import { stamp } from './dates';

// The approval of a PRD born on the server (◆, PRD 1299 s3), on its page, as pure functions of what the
// viewer reads: its latest row of `approvals` (supabase/migrations/20261123090000_approvals.sql), which a
// member reads under the table's policy, and the dossier's versions. It reads one of three states:
//
// - waiting for approval: nobody approved it yet;
// - approved, by whom and when: every file the approval in force pinned is still its kind's latest version;
// - drifted · approve again: a version newer than a pinned one was pushed since, the changed files named.
//
// Waiting or drifted, a member of the dossier's workspace gets the Approve button (./ApproveButton.tsx),
// which posts to the approval route (/api/dossiers/approval, src/approval/approval-api.ts). An approval
// that could not be read says so, with no button. A PRD born in the repository (◇), a draft, a fix, and a
// PRD whose first spec was not pushed yet show none of it: their page is unchanged.

/** Where the page approves, as the signed-in person. */
export const APPROVAL_ROUTE = '/api/dossiers/approval';

/** An approval in force as a member reads it: who approved, when, and each pinned file. */
const ApprovalRowSchema = z.object({
  approver_login: z.string().min(1),
  approved_at: z.string().refine((at) => !Number.isNaN(Date.parse(at))),
  files: z.array(z.looseObject({ kind: z.string().min(1), path: z.string().min(1), version_id: z.string().min(1) })),
});
export type ApprovalRow = z.infer<typeof ApprovalRowSchema>;

/** The approval in force (null: none yet), or `unread` when it could not be read. */
export type ApprovalRead = ApprovalRow | null | 'unread';

export type ApprovalState = 'waiting' | 'approved' | 'drifted' | 'unread';

export type ApprovalView = {
  state: ApprovalState;
  /** `waiting for approval`, `approved`, `drifted · approve again`, or why it could not be read. */
  words: string;
  /** `by ada · 9 Oct 2026, 09:12 UTC`, or what changed since and who approved it; null with no approval. */
  detail: string | null;
  /** The pinned files a newer version replaced, in the order they were pinned. */
  changed: string[];
  /** Whether the viewer gets the Approve button: a member, while it waits or drifted. */
  canApprove: boolean;
  /** The dossier the button approves. */
  dossier: string;
};

const WORDS: Record<ApprovalState, string> = {
  waiting: 'waiting for approval',
  approved: 'approved',
  drifted: 'drifted · approve again',
  unread: 'The approval could not be read. Reload the page in a moment.',
};

/** The latest approval of dossier `id` the caller reads, or null when nobody approved it yet; throws when
 * the database fails or answers out of shape. */
export async function readApproval(db: Pick<SupabaseClient, 'from'>, id: string): Promise<ApprovalRow | null> {
  const { data, error } = await db.from('approvals').select('approver_login, approved_at, files').eq('dossier_id', id)
    .order('approved_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`read the approval: ${error.message}`);
  if (data === null) return null;
  const parsed = ApprovalRowSchema.safeParse(data);
  if (!parsed.success) throw new Error(`read the approval: answered out of shape for ${id}`);
  return parsed.data;
}

/** The pinned files whose kind has a newer version than the one pinned; versions are oldest first. */
function changedSince(approval: ApprovalRow, versions: readonly DossierVersionRow[]): string[] {
  const latest = new Map<string, string>();
  for (const v of versions) latest.set(v.kind, v.id);
  return approval.files.filter((file) => {
    const now = latest.get(file.kind);
    return now !== undefined && now !== file.version_id;
  }).map((file) => file.path);
}

/** The approval of a ◆ PRD as its page shows it to `me`; null for any other dossier. */
export function approvalView(
  read: { dossier: DossierRow; versions: readonly DossierVersionRow[]; members: readonly Member[]; approval?: ApprovalRead | undefined },
  me: string | null,
): ApprovalView | null {
  const { dossier } = read;
  if ((dossier.kind ?? 'prd') !== 'prd' || dossier.prd === null || dossier.birthplace !== 'server') return null;
  const member = me !== null && read.members.some((m) => m.user_id === me);
  const view = (state: ApprovalState, detail: string | null = null, changed: string[] = []): ApprovalView =>
    ({ state, words: WORDS[state], detail, changed, canApprove: member && (state === 'waiting' || state === 'drifted'), dossier: dossier.id });
  const { approval } = read;
  if (approval === null) return view('waiting');
  if (approval === undefined || approval === 'unread') return view('unread');
  const at = stamp(approval.approved_at);
  const changed = changedSince(approval, read.versions);
  if (!changed.length) return view('approved', `by ${approval.approver_login} · ${at}`);
  return view('drifted', `${changed.join(', ')} changed since ${approval.approver_login} approved it · ${at}`, changed);
}
