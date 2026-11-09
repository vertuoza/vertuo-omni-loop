import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Member } from '../../ask/page/question';
import { renderMarkdownBody } from '../markdown';
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { DossierRow, DossierVersionRow } from '../store';
import { lineDiff, type DiffLine } from './approval-diff';
import { stamp } from './dates';
import type { LawsView } from '../../business-laws/verdicts.service';

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
//
// PRD 2632 s4: above Approve, the latest spec's business laws verdict (../../business-laws/): a red names each
// law broken and turns Approve off, saying why; a green says what was judged; a spec not judged says why. Once
// approved, the approved spec's verdict stays under the seal.

/** Why Approve is off while the latest spec breaks a business law. */
export const LAWS_HOLD = 'Change the spec, or amend the law.';

/** Why Approve is off for `view`: a red business law verdict; null when it is on. */
export function approveOff(view: Pick<ApprovalView, 'laws'>): string | null {
  return view.laws?.show === 'verdict' && view.laws.verdict.state === 'red' ? LAWS_HOLD : null;
}

/** Where the page approves, as the signed-in person. */
export const APPROVAL_ROUTE = '/api/dossiers/approval';

/** An approval in force as a member reads it: its row, who approved, when, and each pinned file. */
const ApprovalRowSchema = z.object({
  id: z.string().min(1),
  approver_login: z.string().min(1),
  approved_at: z.string().refine((at) => !Number.isNaN(Date.parse(at))),
  files: z.array(z.looseObject({ kind: z.string().min(1), path: z.string().min(1), version_id: z.string().min(1), sha256: z.string().min(1).optional() })),
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

/** A PRD's Tech Approval request as the page reads it (PRD 2608): the one member it names, and where it stands
 * (asked: no tech approval since; approved: one is in force; voided: a push voided the last, or its files moved
 * on), with the tech approval row the state came from. */
export type TechFacts = { user: string; state: 'asked' | 'approved' | 'voided'; approval: ApprovalRow | null };

/** What the page reads beside a ◆ PRD's approval in force (PRD 1322 s7). */
export type ApprovalFacts = {
  /** The PRD's Tech Approval request; left out (or null) when nobody asked for one (BR-PRODUCT-127), `unread` when it could not be read. */
  tech?: TechFacts | null | 'unread' | undefined;
  /** The voids of the dossier's approvals, oldest first. */
  voids: readonly ApprovalVoid[];
  /** The members asked to approve the PRD's product (none: any member may), or `unread`. */
  asked: readonly string[] | 'unread';
  /** The approve screen, read for a viewer who gets the button; left out, the button alone. */
  screen?: ApproveScreen | undefined;
  /** The business laws' verdict (PRD 2632 s4): the latest spec's for a viewer who gets the button, the approved
   * spec's once approved; left out, none is shown. */
  laws?: LawsView | undefined;
  /** A product PRD's id, `mobile-12` (#2671): what it goes by with no repository number; null or left out for any other dossier. */
  productPrd?: string | null | undefined;
  /** The Tech Approval's screen, read for the named person: the changes since their last approval, then the spec's Problem and Solution. */
  techScreen?: ApproveScreen | undefined;
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
  /** The seal an approval in force shows on the page (#1351): the PRD, who approved it and when, and each
   * pinned file with its short hash (null when the row kept none); null unless approved. */
  seal: ApprovalSeal | null;
  /** The business laws' verdict shown above Approve, or under the seal (PRD 2632 s4); a red turns Approve off. */
  laws?: LawsView | null;
  /** The Tech Approval part (PRD 2608); null when nobody asked for one, so a PRD with no request renders as before. */
  tech: TechView | null;
  /** Whether the viewer, the PRD's author, gets **Request a Tech Approval**: a ◆ PRD not yet approved, with no request. */
  canRequestTech: boolean;
};

/** What the page shows of a Tech Approval (PRD 2608). */
export type TechView = {
  state: 'asked' | 'approved' | 'voided';
  /** Who the request names, as the page names a member. */
  name: string;
  /** Whether the viewer is the named person and may give it, with the changes since their last approval in `screen`. */
  canGive: boolean;
  screen: ApproveScreen | null;
  /** The tech seal, shown first, once both approvals hold. */
  seal: ApprovalSeal | null;
  /** The line a product approver reads in place of Approve while the Tech Approval is missing; null otherwise. */
  waiting: string | null;
};

/** What the seal of an approval in force shows. */
export type ApprovalSeal = { prd: PrdNumber | string; approver: string; at: string; files: Array<{ path: string; hash: string | null }> };

const WORDS: Record<ApprovalState, string> = {
  waiting: 'waiting for approval',
  approved: 'approved',
  drifted: 'drifted · approve again',
  voided: 'voided · approve again',
  unread: 'The approval could not be read. Reload the page in a moment.',
};

/** The latest product approval of dossier `id` (a tech approval is never the product one, PRD 2608) the caller reads, or null when nobody approved it yet; throws when
 * the database fails or answers out of shape. */
export async function readApproval(db: Pick<SupabaseClient, 'from'>, id: string): Promise<ApprovalRow | null> {
  const { data, error } = await db.from('approvals').select('id, approver_login, approved_at, files').eq('dossier_id', id).eq('approval_kind', 'product')
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

const TechRequestRow = z.object({ asked: z.array(z.string().min(1)).min(1), asked_at: z.string().refine((at) => !Number.isNaN(Date.parse(at))) });

/** The dossier's Tech Approval request and where it stands (PRD 2608), as the member reads it: null when nobody
 * requested one. A tech approval is read by kind `tech`, from the request on; a void after it, or a pinned file
 * that moved on, reads `voided`. Throws when the database fails or answers out of shape. */
export async function readTech(db: Pick<SupabaseClient, 'from'>, id: string, versions: readonly { id: string; kind: string }[], voids: readonly ApprovalVoid[]): Promise<TechFacts | null> {
  const request = await db.from('approval_requests').select('asked, asked_at').eq('dossier_id', id).eq('approval_kind', 'tech')
    .order('asked_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
  if (request.error) throw new Error(`read the tech request: ${request.error.message}`);
  if (request.data === null) return null;
  const asked = TechRequestRow.safeParse(request.data);
  if (!asked.success) throw new Error(`read the tech request: answered out of shape for ${id}`);
  const user = asked.data.asked[0] ?? '';
  const given = await db.from('approvals').select('id, approver_login, approved_at, files').eq('dossier_id', id).eq('approval_kind', 'tech')
    .gte('approved_at', asked.data.asked_at).order('approved_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
  if (given.error) throw new Error(`read the tech approval: ${given.error.message}`);
  if (given.data === null) return { user, state: 'asked', approval: null };
  const approval = ApprovalRowSchema.safeParse(given.data);
  if (!approval.success) throw new Error(`read the tech approval: answered out of shape for ${id}`);
  return { user, state: judgeApproval(approval.data, voids, versions).state === 'approved' ? 'approved' : 'voided', approval: approval.data };
}

const ProductNumberOfDossier = z.object({ product_seq: z.number().int().positive().nullable(), product_id: z.string().nullable() });
const KeyOfProduct = z.object({ key: z.string().min(1) });

/** A dossier with no repository number's id on its product, `mobile-12` (#2671): null for a draft or a dossier
 * numbered in its repository, which reads nothing; throws when the database fails. */
export async function readProductPrd(db: Pick<SupabaseClient, 'from'>, dossier: Pick<DossierRow, 'id' | 'prd'>): Promise<string | null> {
  if (dossier.prd !== null) return null;
  const row = await db.from('dossiers').select('product_seq, product_id').eq('id', dossier.id).maybeSingle();
  if (row.error) throw new Error(`read the PRD's number on its product: ${row.error.message}`);
  const numbered = ProductNumberOfDossier.safeParse(row.data);
  if (!numbered.success || numbered.data.product_seq === null || numbered.data.product_id === null) return null;
  const product = await db.from('products').select('key').eq('id', numbered.data.product_id).maybeSingle();
  if (product.error) throw new Error(`read the PRD's product key: ${product.error.message}`);
  const keyed = KeyOfProduct.safeParse(product.data);
  return keyed.success ? `${keyed.data.key}-${String(numbered.data.product_seq)}` : null;
}

const ProductOfDossier = z.object({ product_id: z.string().nullable() });
const AskedApprover = z.object({ user_id: z.string().min(1) });

/** The members asked to approve the PRDs of the dossier's own product, as dossier_approve() reads it
 * (PRD 1364): none when the PRD has no product or the product asks nobody; throws when the database fails. */
export async function readAskedApprovers(db: Pick<SupabaseClient, 'from'>, dossier: Pick<DossierRow, 'id'>): Promise<string[]> {
  const row = await db.from('dossiers').select('product_id').eq('id', dossier.id).maybeSingle();
  if (row.error) throw new Error(`read the product's approvers: ${row.error.message}`);
  if (row.data === null) return [];
  const product = ProductOfDossier.safeParse(row.data);
  if (!product.success) throw new Error('read the product\'s approvers: the dossier answered out of shape');
  if (product.data.product_id === null) return [];
  const rows = await db.from('product_approvers').select('user_id').eq('product_id', product.data.product_id).eq('state', 'asked');
  if (rows.error) throw new Error(`read the product's approvers: ${rows.error.message}`);
  const asked = z.array(AskedApprover).safeParse(rows.data);
  if (!asked.success) throw new Error('read the product\'s approvers: answered out of shape');
  return asked.data.map((row) => row.user_id);
}

/** The latest version of each kind; versions are oldest first. */
function latestOf(versions: readonly { id: string; kind: string }[]): Map<string, string> {
  const latest = new Map<string, string>();
  for (const v of versions) latest.set(v.kind, v.id);
  return latest;
}

/** The pinned files a void names, or whose kind has a newer version than the one pinned, in pinned order. */
function changedSince(approval: ApprovalRow, voids: readonly ApprovalVoid[], versions: readonly { id: string; kind: string }[]): string[] {
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

/** What an approval in force reads, given the versions since: voided by a push, approved (the pinned files
 * with their short hashes), or drifted, with the files changed and its words; shared by a PRD's page and a
 * product roadmap's (./RoadmapRecord.ts). */
export type Judged =
  | { state: 'voided' | 'drifted'; detail: string; changed: string[] }
  | { state: 'approved'; detail: string; changed: []; at: string; files: Array<{ path: string; hash: string | null }> };

export function judgeApproval(approval: ApprovalRow, allVoids: readonly ApprovalVoid[], versions: readonly { id: string; kind: string }[]): Judged {
  const at = stamp(approval.approved_at);
  const voids = allVoids.filter((v) => v.approval_id === approval.id);
  const changed = changedSince(approval, voids, versions);
  const last = voids[voids.length - 1];
  if (last) {
    const push = `voided by ${last.pusher_login}'s push ${short(last.from_sha256)}→${short(last.to_sha256)} · ${stamp(last.voided_at)}`;
    return { state: 'voided', detail: `${push} · ${approval.approver_login} had approved it ${at}`, changed };
  }
  if (!changed.length) {
    const files = approval.files.map((file) => ({ path: file.path, hash: file.sha256 ? short(file.sha256) : null }));
    return { state: 'approved', detail: `by ${approval.approver_login} · ${at}`, changed: [], at, files };
  }
  return { state: 'drifted', detail: `${changed.join(', ')} changed since ${approval.approver_login} approved it · ${at}`, changed };
}

/** Who looks at a ◆ PRD's approval and what they may do: a member, asked or not by the product, and the Tech
 * Approval request the page read (PRD 2608). */
type Seat = { me: string | null; member: boolean; tech: TechFacts | null; techUnread: boolean; allowed: boolean };

function seatOf(read: { members: readonly Member[]; approvalFacts?: ApprovalFacts | undefined }, me: string | null): Seat {
  const member = me !== null && read.members.some((m) => m.user_id === me);
  const found = read.approvalFacts?.tech;
  const tech = techFound(found);
  // While a requested Tech Approval is missing (asked, or voided), the database refuses the product approval,
  // so a product approver reads who it waits on in place of Approve.
  const allowed = member && askedAllows(read.approvalFacts?.asked ?? [], me) && (tech === null || tech.state === 'approved');
  return { me, member, tech, techUnread: found === 'unread', allowed };
}

/** The Tech Approval request the page read, null with none or when it could not be read. */
function techFound(found: ApprovalFacts['tech']): TechFacts | null {
  return found && found !== 'unread' ? found : null;
}

/** Whether the product asks `me` to approve: nobody asked (any member may), the list unread (the database decides), or `me` asked. */
function askedAllows(asked: ApprovalFacts['asked'], me: string | null): boolean {
  return asked === 'unread' || !asked.length || (me !== null && asked.includes(me));
}

/** The Tech Approval part of the page for the request `tech`: who it names, whether `me` gives it, the waiting
 * line a product approver reads, and the tech seal once the product approval holds too (`seal`). */
function techViewOf(
  tech: TechFacts,
  at: { members: readonly Member[]; seat: Seat; screen: ApproveScreen | undefined; open: boolean; seal: ApprovalSeal | null },
): TechView {
  const name = nameOfMember(at.members, tech.user);
  const missing = tech.state !== 'approved';
  const canGive = missing && at.seat.member && tech.user === at.seat.me;
  return {
    state: tech.state, name, canGive, screen: canGive ? at.screen ?? null : null,
    seal: !missing && at.seal ? techSeal(tech, at.seal) : null,
    waiting: missing && at.open ? `waiting for ${name}'s tech approval` : null,
  };
}

/** How the page names the member `user`, or that they left the workspace. */
function nameOfMember(members: readonly Member[], user: string): string {
  const named = members.find((m) => m.user_id === user);
  return named ? (named.name ?? named.email) : 'someone who left the workspace';
}

/** The tech seal, beside the product one (`seal`): the tech approval's approver, time and pinned files. */
function techSeal({ approval }: TechFacts, seal: ApprovalSeal): ApprovalSeal | null {
  if (approval === null) return null;
  return { prd: seal.prd, approver: approval.approver_login, at: stamp(approval.approved_at), files: approval.files.map((file) => ({ path: file.path, hash: file.sha256 ? short(file.sha256) : null })) };
}

/** An approval's view for the state it reads, to the viewer `seat`. */
function viewOf(
  read: { dossier: DossierRow; members: readonly Member[]; approvalFacts?: ApprovalFacts | undefined },
  seat: Seat,
  state: ApprovalState,
  rest: { detail: string | null; changed: string[]; seal: ApprovalSeal | null },
): ApprovalView {
  const open = state === 'waiting' || state === 'drifted' || state === 'voided';
  const tech = seat.tech && techViewOf(seat.tech, { members: read.members, seat, screen: read.approvalFacts?.techScreen, open, seal: rest.seal });
  const canApprove = seat.allowed && open;
  return {
    state, words: wordsOf(state, tech), ...rest, canApprove,
    dossier: read.dossier.id, screen: canApprove ? approveScreenOf(read.approvalFacts) : null, tech,
    canRequestTech: open && isAuthor(seat, read.dossier),
    ...lawsPartOf(read.approvalFacts),
  };
}

/** The business laws' verdict the page read, left out with none (PRD 2632 s4). */
function lawsPartOf(facts: ApprovalFacts | undefined): Pick<ApprovalView, 'laws'> {
  return facts?.laws ? { laws: facts.laws } : {};
}

/** The approve screen the page read, null with none. */
function approveScreenOf(facts: ApprovalFacts | undefined): ApproveScreen | null {
  return facts?.screen ?? null;
}

/** Whether the viewer is the PRD's author, a member, with no Tech Approval requested or unread (PRD 2608). */
function isAuthor(seat: Seat, dossier: Pick<DossierRow, 'opened_by'>): boolean {
  return seat.member && seat.me === dossier.opened_by && !seat.tech && !seat.techUnread;
}

/** The words of an approval's state; while it waits on a Tech Approval someone else gives, they say who. */
function wordsOf(state: ApprovalState, tech: TechView | null): string {
  return tech?.waiting && !tech.canGive && state === 'waiting' ? tech.waiting : WORDS[state];
}

/** The approval of a ◆ PRD as its page shows it to `me`; null for any other dossier. */
export function approvalView(
  read: {
    dossier: DossierRow; versions: readonly DossierVersionRow[]; members: readonly Member[];
    approval?: ApprovalRead | undefined; approvalFacts?: ApprovalFacts | undefined;
  },
  me: string | null,
): ApprovalView | null {
  const { dossier, approval } = read;
  // A PRD is numbered in its repository or on its product (#2671); with neither it is a draft, and has no approval.
  const prd = dossier.prd ?? read.approvalFacts?.productPrd ?? null;
  if ((dossier.kind ?? 'prd') !== 'prd' || prd === null || dossier.birthplace !== 'server') return null;
  const seat = seatOf(read, me);
  const plain = { detail: null, changed: [], seal: null };
  if (approval === null) return viewOf(read, seat, 'waiting', plain);
  if (approval === undefined || approval === 'unread') return viewOf(read, seat, 'unread', plain);
  const judged = judgeApproval(approval, read.approvalFacts?.voids ?? [], read.versions);
  if (judged.state !== 'approved') return viewOf(read, seat, judged.state, { detail: judged.detail, changed: judged.changed, seal: null });
  const seal = { prd, approver: approval.approver_login, at: judged.at, files: judged.files };
  return viewOf(read, seat, 'approved', { detail: judged.detail, changed: [], seal });
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
