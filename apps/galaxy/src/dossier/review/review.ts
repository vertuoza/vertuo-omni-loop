import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { approveOff, type ApprovalView, type ApproveScreen } from '../page/approval';
import type { ReadyView } from '../page/ready';
import { dossierPath } from '../page/view';
import type { DossierVersionRow } from '../store';

// The review screen of a PRD (PRD omni-loop-20 s5), as pure functions of what its route read: which signed
// decision waits on the viewer, and the words, sections and actions of the one screen it opens at
// /prd/<id>/review. Three decisions, the first that applies:
//
// - Review the plan: the viewer is the member a Tech Approval request names, and it is missing (PRD 2608);
// - Review and approve: the viewer may approve the PRD, while it waits, drifted or was voided (PRD 1322 s7);
// - Review the feature: the Omni App's latest verdict says the feature PR is ready (PRD 2898 s9): its decision
//   is Merge on GitHub, a link, since only a person merges into `main`.
//
// None of them, and the route sends the viewer back to the PRD's page. Approve and Give Tech Approval post
// exactly what the page's buttons post (../page/ApproveButton.tsx); a red business-law verdict turns Approve
// off with its reason, never Give Tech Approval (BR-PRODUCT-129). Request changes is not offered: the server
// keeps no record of it (the spec keeps how approval is recorded unchanged).

export type ReviewKind = 'approve' | 'tech' | 'feature';

/** Where the review screen of PRD dossier `id` lives. */
export const reviewPath = (id: string) => `${dossierPath(id)}/review`;

/** How the screen names a PRD: `PRD 7`, `PRD mobile-12`, or `PRD` for one with no number. */
export const prdLabel = (prd: PrdNumber | string | null | undefined) => (prd === null || prd === undefined ? 'PRD' : `PRD ${String(prd)}`);

/** The decision that waits on the viewer, or null when none does. */
export function reviewKindOf(approval: Pick<ApprovalView, 'canApprove' | 'tech'> | null, ready: Pick<ReadyView, 'tone' | 'foot'> | null): ReviewKind | null {
  if (approval?.tech?.canGive) return 'tech';
  if (approval?.canApprove) return 'approve';
  if (ready?.tone === 'pass' && ready.foot.action) return 'feature';
  return null;
}

/** The kinds an approval pins, and how a person names them (supabase dossier_approve(): the latest of each). */
const PINNED = [['spec', 'Spec'], ['plan', 'Plan'], ['before-after', 'Before/after']] as const;

/** One file the approval pins: its kind's name and its latest version, `Spec v3`. */
export type PinnedFile = { kind: string; name: string };

/** The files Approve pins, each its kind's latest version, in the order the approval lists them. */
export function pinnedOf(versions: readonly Pick<DossierVersionRow, 'kind'>[]): PinnedFile[] {
  return PINNED.flatMap(([kind, label]) => {
    const count = versions.filter((v) => v.kind === kind).length;
    return count > 0 ? [{ kind, name: `${label} v${String(count)}` }] : [];
  });
}

/** `Plan v2 · 14 slices`: the latest plan, and its slices when known; null with no plan. */
export function planLine(versions: readonly Pick<DossierVersionRow, 'kind'>[], slices: number | null): string | null {
  const plan = pinnedOf(versions).find((file) => file.kind === 'plan');
  if (!plan) return null;
  return slices === null ? plan.name : `${plan.name} · ${String(slices)} ${slices === 1 ? 'slice' : 'slices'}`;
}

/** What the decision bar says and does, per decision. */
export type ReviewWords = { title: string; question: string; lede: string; detail: string };

const TITLES: Readonly<Record<ReviewKind, string>> = {
  approve: 'Review and approve',
  tech: 'Review the plan',
  feature: 'Review the feature',
};

const QUESTIONS: Readonly<Record<ReviewKind, string>> = {
  approve: 'Approve this spec and plan?',
  tech: 'Give your Tech Approval to this plan?',
  feature: 'Merge the feature PR on GitHub?',
};

/** Who decided what before the viewer: the approval in force or its voiding, or that nobody decided yet. */
function approveLede(approval: Pick<ApprovalView, 'state' | 'detail'>): string {
  if (approval.state === 'waiting' || approval.detail === null) return 'Nobody has approved it yet.';
  return approval.detail;
}

function techLede(tech: Pick<NonNullable<ApprovalView['tech']>, 'state'>): string {
  return tech.state === 'voided'
    ? 'Your last Tech Approval no longer holds.'
    : 'You are asked for the Tech Approval.';
}

/** The title, question, lede and the line under the question for decision `kind`, read by the member `me`. */
export function reviewWords(kind: ReviewKind, at: { approval: ApprovalView | null; ready: ReadyView | null; me: string }): ReviewWords {
  const base = { title: TITLES[kind], question: QUESTIONS[kind] };
  if (kind === 'feature') {
    return { ...base, lede: at.ready?.title ?? '', detail: 'Not merged yet. Only a person merges.' };
  }
  if (kind === 'tech') {
    const lede = at.approval?.tech ? techLede(at.approval.tech) : '';
    return { ...base, lede, detail: `You give it as ${at.me}.` };
  }
  const off = at.approval ? approveOff(at.approval) : null;
  const lede = at.approval ? approveLede(at.approval) : '';
  return { ...base, lede, detail: off ?? `You approve as ${at.me}.` };
}

/** The approve screen the viewer reads for decision `kind`: the Tech Approval's, or the product approval's. */
export function screenOf(kind: ReviewKind, approval: ApprovalView | null): ApproveScreen | null {
  if (!approval) return null;
  return kind === 'tech' ? approval.tech?.screen ?? null : approval.screen;
}
