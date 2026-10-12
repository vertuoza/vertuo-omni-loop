import { z } from 'zod';

// A product's Approvers list (PRD 1322 s1) as pure data, on its home's Repositories & approvers tab
// (PRD 1364 s11, src/product-repositories/): members of the workspace, each asked to approve the
// product's PRDs or skipped (supabase/migrations/20261124090000_product_approvers.sql). Once anyone is
// asked, only the asked may approve (dossier_approve()); before, any member may, as PRD 1299 had it.
// Every member reads the list; only a workspace owner changes it, through the tab's routes
// (src/product-repositories/repositories-tab.controller.ts), which call product_approver_set() and
// product_approver_remove() as the signed-in person.

export const APPROVER_STATES = [
  { value: 'asked', label: 'Asked to approve' },
  { value: 'skipped', label: 'Skipped' },
] as const;

export const ApproverState = z.enum(['asked', 'skipped']);
export type ApproverState = z.infer<typeof ApproverState>;

/** A public.product_approvers row, as the page reads it. */
export const StoredApprover = z.object({ user_id: z.string(), state: ApproverState });
export type StoredApprover = z.infer<typeof StoredApprover>;
export const APPROVER_COLUMNS = 'user_id, state';

/** A member of the workspace, as the list names them: their name, else their GitHub login. */
export interface Member {
  id: string;
  name: string | null;
  login: string | null;
}

export interface Approver extends Member {
  state: ApproverState;
}

/** What the section draws: whether the reader owns the workspace, its members, and who is listed. */
export interface Approvers {
  owner: boolean;
  members: Member[];
  listed: Approver[];
}

export const memberLabel = (member: Member): string => member.name ?? member.login ?? 'A member';

/** The stored rows, in the members' order; a row whose member is not in the workspace is dropped. */
export function approversOf(members: readonly Member[], rows: readonly StoredApprover[]): Approver[] {
  const states = new Map(rows.map((r) => [r.user_id, r.state]));
  return members.flatMap((m) => {
    const state = states.get(m.id);
    return state ? [{ ...m, state }] : [];
  });
}

/** The members an owner may still add. */
export const addableOf = (approvers: Approvers): Member[] =>
  approvers.members.filter((m) => !approvers.listed.some((a) => a.id === m.id));

export const ONLY_ASKED = 'Only the members asked to approve may approve this product’s PRDs.';
export const NOBODY_ASKED = 'Nobody is asked yet, so any member of the workspace may approve this product’s PRDs.';

/** The rule the list sets on approving the product's PRDs. */
export const approveRuleOf = (listed: readonly Approver[]): string =>
  (listed.some((a) => a.state === 'asked') ? ONLY_ASKED : NOBODY_ASKED);

// ── The page's state ──

export type ApproversForm = { approvers: Approvers; busy: boolean; message: string | null };

export type ApproversAction =
  | { type: 'busy' }
  | { type: 'set'; member: string; state: ApproverState }
  | { type: 'removed'; member: string }
  | { type: 'refused'; message: string };

export const initialApproversForm = (approvers: Approvers): ApproversForm => ({ approvers, busy: false, message: null });

function withState(approvers: Approvers, member: string, state: ApproverState): Approvers {
  const listed = approvers.listed.map((a) => (a.id === member ? { ...a, state } : a));
  const rows = [...listed.map((a) => ({ user_id: a.id, state: a.state })), { user_id: member, state }];
  return { ...approvers, listed: approversOf(approvers.members, rows) };
}

export function approversReducer(form: ApproversForm, action: ApproversAction): ApproversForm {
  switch (action.type) {
    case 'busy':
      return { ...form, busy: true };
    case 'set':
      return { approvers: withState(form.approvers, action.member, action.state), busy: false, message: null };
    case 'removed':
      return { approvers: { ...form.approvers, listed: form.approvers.listed.filter((a) => a.id !== action.member) }, busy: false, message: null };
    case 'refused':
      return { ...form, busy: false, message: action.message };
  }
}

// ── What a refused change says ──

export const NOT_OWNER = 'Only a workspace owner can change who approves this product’s PRDs.';
export const NOT_MEMBER = 'That person is not a member of this workspace any more. Reload the page.';
export const GONE = 'That product is no longer in this workspace. Reload the page.';
