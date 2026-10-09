import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Member } from '../../ask/page/question';
import { renderMarkdownBody } from '../markdown';
import type { DossierRow, DossierVersionRow } from '../store';
import { lineDiff, type DiffLine } from './approval-diff';
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
//
// PRD 1322 s7, the approve screen: once the PRD's product (its repository's product) lists a member asked
// to approve (supabase/migrations/20261124090000_product_approvers.sql), only those members get the
// button, as dossier_approve() refuses anyone else; with no product, nobody asked, or the list unread,
// any member does and the database decides. A void appended after the approval in force (approval_voids,
// supabase/migrations/20261125090000_approval_requests.sql) reads a fourth state, voided · approve again,
// naming who pushed and the hashes. Whoever gets the button reads, above it, the diff of each changed
// file first (./approval-diff.ts), then the spec's Problem and Solution.

/** Where the page approves, as the signed-in person. */
export const APPROVAL_ROUTE = '/api/dossiers/approval';

/** An approval in force as a member reads it: its row, who approved, when, and each pinned file. */
const ApprovalRowSchema = z.object({
  id: z.string().min(1),
  approver_login: z.string().min(1),
  approved_at: z.string().refine((at) => !Number.isNaN(Date.parse(at))),
  files: z.array(z.looseObject({ kind: z.string().min(1), path: z.string().min(1), version_id: z.string().min(1) })),
});
export type ApprovalRow = z.infer<typeof ApprovalRowSchema>;

/** The approval in force (null: none yet), or `unread` when it could not be read. */
export type ApprovalRead = ApprovalRow | null | 'unread';

/** A void appended after an approval (PRD 1322): the kind a push changed, its old and new hash, who pushed. */
const ApprovalVoidSchema = z.object({
  approval_id: z.string().min(1),
  kind: z.string().min(1),
  from_sha256: z.string().min(1),
  to_sha256: z.string().min(1),
  pusher_login: z.string().min(1),
  voided_at: z.string().refine((at) => !Number.isNaN(Date.parse(at))),
});
export type ApprovalVoid = z.infer<typeof ApprovalVoidSchema>;

/** A changed pinned file's diff since it was approved; `rows` null when a version could not be read. */
type FileDiff ={ path: string; rows: DiffLine[] | null };

/** What the approve screen shows above Approve: the changed files' diffs, then the spec's Problem and
 * Solution as HTML; `spec` says when the spec could not be read, or has neither section. */
export type ApproveScreen = {
  diffs: FileDiff[];
  sections: { name: 'Problem' | 'Solution'; html: string }[];
  spec: 'read' | 'none' | 'unread';
};

/** What the page reads beside a ◆ PRD's approval in force (PRD 1322 s7). */
export type ApprovalFacts = {
  /** The voids of the dossier's approvals, oldest first. */
  voids: readonly ApprovalVoid[];
  /** The members asked to approve the PRD's product (none: any member may), or `unread`. */
  asked: readonly string[] | 'unread';
  /** The approve screen, read for a viewer who gets the button; left out, the button alone. */
  screen?: ApproveScreen | undefined;
};

export type ApprovalState = 'waiting' | 'approved' | 'drifted' | 'voided' | 'unread';

export type ApprovalView = {
  state: ApprovalState;
  /** `waiting for approval`, `approved`, `drifted · approve again`, `voided · approve again`, or why it could not be read. */
  words: string;
  /** `by ada · 9 Oct 2026, 09:12 UTC`, what changed since and who approved it, or who voided it; null with no approval. */
  detail: string | null;
  /** The pinned files a void named or a newer version replaced, in the order they were pinned. */
  changed: string[];
  /** Whether the viewer gets the Approve button: a member allowed to approve, while it waits, drifted or was voided. */
  canApprove: boolean;
  /** The dossier the button approves. */
  dossier: string;
  /** What the viewer reads above Approve; null without the button, or when it was not read. */
  screen: ApproveScreen | null;
};

const WORDS: Record<ApprovalState, string> = {
  waiting: 'waiting for approval',
  approved: 'approved',
  drifted: 'drifted · approve again',
  voided: 'voided · approve again',
  unread: 'The approval could not be read. Reload the page in a moment.',
};

/** The latest approval of dossier `id` the caller reads, or null when nobody approved it yet; throws when
 * the database fails or answers out of shape. */
export async function readApproval(db: Pick<SupabaseClient, 'from'>, id: string): Promise<ApprovalRow | null> {
  const { data, error } = await db.from('approvals').select('id, approver_login, approved_at, files').eq('dossier_id', id)
    .order('approved_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`read the approval: ${error.message}`);
  if (data === null) return null;
  const parsed = ApprovalRowSchema.safeParse(data);
  if (!parsed.success) throw new Error(`read the approval: answered out of shape for ${id}`);
  return parsed.data;
}

/** The voids of dossier `id` the caller reads, oldest first; throws when the database fails or answers out of shape. */
export async function readVoids(db: Pick<SupabaseClient, 'from'>, id: string): Promise<ApprovalVoid[]> {
  const { data, error } = await db.from('approval_voids').select('approval_id, kind, from_sha256, to_sha256, pusher_login, voided_at')
    .eq('dossier_id', id).order('voided_at', { ascending: true });
  if (error) throw new Error(`read the approval's voids: ${error.message}`);
  const parsed = z.array(ApprovalVoidSchema).safeParse(data);
  if (!parsed.success) throw new Error(`read the approval's voids: answered out of shape for ${id}`);
  return parsed.data;
}

const ProductOfRepo = z.object({ product_id: z.string().nullable() });
const AskedApprover = z.object({ user_id: z.string().min(1) });

/** The members asked to approve the PRDs of the dossier's product (its repository's product): none when
 * the repository has no product or the product asks nobody; throws when the database fails. */
export async function readAskedApprovers(db: Pick<SupabaseClient, 'from'>, dossier: Pick<DossierRow, 'workspace_id' | 'home_repo'>): Promise<string[]> {
  const repo = await db.from('repositories').select('product_id').eq('workspace_id', dossier.workspace_id)
    .eq('full_name', dossier.home_repo).maybeSingle();
  if (repo.error) throw new Error(`read the product's approvers: ${repo.error.message}`);
  if (repo.data === null) return [];
  const product = ProductOfRepo.safeParse(repo.data);
  if (!product.success) throw new Error('read the product\'s approvers: the repository answered out of shape');
  if (product.data.product_id === null) return [];
  const rows = await db.from('product_approvers').select('user_id').eq('product_id', product.data.product_id).eq('state', 'asked');
  if (rows.error) throw new Error(`read the product's approvers: ${rows.error.message}`);
  const asked = z.array(AskedApprover).safeParse(rows.data);
  if (!asked.success) throw new Error('read the product\'s approvers: answered out of shape');
  return asked.data.map((row) => row.user_id);
}

/** The latest version of each kind; versions are oldest first. */
function latestOf(versions: readonly DossierVersionRow[]): Map<string, string> {
  const latest = new Map<string, string>();
  for (const v of versions) latest.set(v.kind, v.id);
  return latest;
}

/** The pinned files a void names, or whose kind has a newer version than the one pinned, in pinned order. */
function changedSince(approval: ApprovalRow, voids: readonly ApprovalVoid[], versions: readonly DossierVersionRow[]): string[] {
  const latest = latestOf(versions);
  const voided = new Set(voids.map((v) => v.kind));
  return approval.files.filter((file) => {
    // The personas' rounds (voice) are appended by the loop after approval, its shipped round
    // included: a newer voice never drifts an approval (PRD 1322).
    if (file.kind === 'voice') return false;
    const now = latest.get(file.kind);
    return voided.has(file.kind) || (now !== undefined && now !== file.version_id);
  }).map((file) => file.path);
}

const short = (sha: string) => sha.slice(0, 7);

/** The approval of a ◆ PRD as its page shows it to `me`; null for any other dossier. */
export function approvalView(
  read: {
    dossier: DossierRow; versions: readonly DossierVersionRow[]; members: readonly Member[];
    approval?: ApprovalRead | undefined; approvalFacts?: ApprovalFacts | undefined;
  },
  me: string | null,
): ApprovalView | null {
  const { dossier } = read;
  if ((dossier.kind ?? 'prd') !== 'prd' || dossier.prd === null || dossier.birthplace !== 'server') return null;
  const asked = read.approvalFacts?.asked ?? [];
  const member = me !== null && read.members.some((m) => m.user_id === me);
  const allowed = member && (asked === 'unread' || !asked.length || asked.includes(me));
  const view = (state: ApprovalState, detail: string | null = null, changed: string[] = []): ApprovalView => {
    const canApprove = allowed && (state === 'waiting' || state === 'drifted' || state === 'voided');
    return { state, words: WORDS[state], detail, changed, canApprove, dossier: dossier.id, screen: canApprove ? read.approvalFacts?.screen ?? null : null };
  };
  const { approval } = read;
  if (approval === null) return view('waiting');
  if (approval === undefined || approval === 'unread') return view('unread');
  const at = stamp(approval.approved_at);
  const voids = (read.approvalFacts?.voids ?? []).filter((v) => v.approval_id === approval.id);
  const changed = changedSince(approval, voids, read.versions);
  const last = voids[voids.length - 1];
  if (last) {
    const push = `voided by ${last.pusher_login}'s push ${short(last.from_sha256)}→${short(last.to_sha256)} · ${stamp(last.voided_at)}`;
    return view('voided', `${push} · ${approval.approver_login} had approved it ${at}`, changed);
  }
  if (!changed.length) return view('approved', `by ${approval.approver_login} · ${at}`);
  return view('drifted', `${changed.join(', ')} changed since ${approval.approver_login} approved it · ${at}`, changed);
}

const SECTIONS = ['Problem', 'Solution'] as const;

/** The body of the spec's `## <heading>` section, up to the next `## `; null when it has none or it is empty. */
function sectionOf(spec: string, heading: (typeof SECTIONS)[number]): string | null {
  const [, ...after] = spec.split(new RegExp(`^## ${heading}[ \\t]*\\r?$`, 'm'));
  const body = after.join('').split(/^## /m)[0]?.trim();
  return body ? body : null;
}

/** Reads what the approve screen shows for `view`: each changed file's diff since the approved version,
 * and the latest spec's Problem and Solution. `content` reads a version's text, null when it has none;
 * a read that fails leaves that part saying so, never the screen. */
export async function readApproveScreen(
  content: (versionId: string) => Promise<string | null>,
  versions: readonly DossierVersionRow[],
  approval: ApprovalRead | undefined,
  view: Pick<ApprovalView, 'changed'>,
): Promise<ApproveScreen> {
  const latest = latestOf(versions);
  const text = async (versionId: string | undefined): Promise<string | null> => {
    if (versionId === undefined) return null;
    try {
      return await content(versionId);
    } catch (error) {
      console.error(error);
      return null;
    }
  };
  const files = approval === null || approval === undefined || approval === 'unread' ? [] : approval.files;
  const diffs = Promise.all(view.changed.map(async (path): Promise<FileDiff> => {
    const file = files.find((f) => f.path === path);
    const [before, after] = await Promise.all([text(file?.version_id), text(file ? latest.get(file.kind) : undefined)]);
    return { path, rows: before === null || after === null ? null : lineDiff(before, after) };
  }));
  const specId = latest.get('spec');
  const spec = await text(specId);
  const sections = spec === null ? [] : SECTIONS.flatMap((name) => {
    const body = sectionOf(spec, name);
    return body === null ? [] : [{ name, html: renderMarkdownBody(body) }];
  });
  const read = sections.length ? 'read' : 'none';
  return { diffs: await diffs, sections, spec: spec === null && specId !== undefined ? 'unread' : read };
}
