import 'server-only';
import { approvalView, readApproval, readApproveScreen, judgeApproval, readAskedApprovers, readProductPrd, readTech, readVoids, type ApprovalFacts, type ApprovalView, type ApprovalRead } from '../page/approval';
import { readContent, type Db } from '../page/source';
import type { DossierRead } from '../page/view';
import { lawsForPage, lawsOfApproved } from '../../business-laws/verdicts.live';
import type { LawsView } from '../../business-laws/verdicts.service';

// A ◆ PRD's approval as the member `me` reads it, shared by its page (../page/DossierRoute.tsx) and its review
// screen (./ReviewRoute.tsx, PRD omni-loop-20 s5), lifted out of the page's route unchanged: the approval in
// force, its voids, who the product asks to approve, the Tech Approval request, and, for a viewer who takes a
// decision, what they read before it (PRD 1322 s7, PRD 2608, PRD 2632 s4). A read that fails is logged and
// reads as unread, never hides the page.

const logged = <T,>(fallback: T) => (error: unknown): T => {
  console.error(error);
  return fallback;
};

/** A ◆ PRD's approval in force, `unread` when it or its voids could not be read, with its voids, who the
 * product asks to approve (`unread` when that could not be read), and, for `me` when they get the
 * button, the approve screen (PRD 1322 s7); nothing for any other dossier. */
export async function approvalOf(db: Db, read: DossierRead, me: string): Promise<Pick<DossierRead, 'approval' | 'approvalFacts'>> {
  const { dossier } = read;
  if (dossier.birthplace !== 'server') return {};
  const [row, voids, asked, productPrd] = await Promise.all([
    readApproval(db, dossier.id).catch(logged<ApprovalRead>('unread')),
    readVoids(db, dossier.id).catch(logged(null)),
    readAskedApprovers(db, dossier).catch(logged<'unread'>('unread')),
    readProductPrd(db, dossier).catch(logged<string | null>(null)),
  ]);
  const approval: ApprovalRead = voids === null ? 'unread' : row;
  const tech = await readTech(db, dossier.id, read.versions, voids ?? []).catch(logged<'unread'>('unread'));
  const facts: ApprovalFacts = { voids: voids ?? [], asked, tech, productPrd };
  return { approval, approvalFacts: { ...facts, ...await screensOf(db, read, approval, facts, me) } };
}

/** What `me` reads beside the approval: the approve screen when they get Approve (PRD 1322 s7), the Tech Approval's when they give it (PRD 2608), and the business laws' verdict (PRD 2632 s4). */
async function screensOf(db: Db, read: DossierRead, approval: ApprovalRead, facts: ApprovalFacts, me: string): Promise<Pick<ApprovalFacts, 'screen' | 'techScreen' | 'laws'>> {
  const view = approvalView({ ...read, approval, approvalFacts: facts }, me);
  const content = (id: string) => readContent(db, id);
  const [techScreen, screen, laws] = await Promise.all([
    view?.tech?.canGive ? techScreenOf(content, read, facts) : undefined,
    view?.canApprove ? readApproveScreen(content, read.versions, approval, view) : undefined,
    lawsOfView(db, read.dossier.id, view, approval),
  ]);
  return { techScreen, screen, laws };
}

/** The business laws' verdict `view` shows (PRD 2632 s4): the latest spec's for whoever gets a button, the approved spec's under the seal. */
function lawsOfView(db: Db, dossier: string, view: ApprovalView | null, approval: ApprovalRead): Promise<LawsView> | undefined {
  if (!view) return undefined;
  if (view.canApprove || view.tech?.canGive) return lawsForPage(db, dossier);
  const spec = view.seal ? pinnedSpecOf(approval) : undefined;
  return spec && lawsOfApproved(db, dossier, spec.version_id);
}

/** The spec an approval pinned, when it holds one. */
function pinnedSpecOf(approval: ApprovalRead) {
  return approval === null || approval === 'unread' ? undefined : approval.files.find((file) => file.kind === 'spec');
}

/** The named person's screen (PRD 2608): what changed since their last tech approval, then the spec's Problem and Solution. */
function techScreenOf(content: (id: string) => Promise<string | null>, read: DossierRead, facts: ApprovalFacts) {
  const { tech } = facts;
  const given = tech && tech !== 'unread' ? tech.approval : null;
  const changed = given ? judgeApproval(given, facts.voids, read.versions).changed : [];
  return readApproveScreen(content, read.versions, given, { changed });
}
