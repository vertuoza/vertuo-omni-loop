import 'server-only';
import type { ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';
import { serverEnv } from '../../env';
import { approvalView } from '../page/approval';
import { demoReview } from '../page/demo';
import { gated, markdownOf, type DossierRouteProps, type Gated } from '../page/DossierRoute';
import { readyView, type ReadyView } from '../page/ready';
import { readLatestVerdict } from '../page/ready.repository';
import { DossierDatabaseDown, dossierSession } from '../page/route-gate';
import { readContent, readDossier, readPlanSlices, type Db } from '../page/source';
import { dossierPath, type DossierRead } from '../page/view';
import { kindOf, workPath } from '../page/work';
import { approvalOf } from './approval-read';
import { pinnedOf, planLine, prdLabel, reviewKindOf, type ReviewKind } from './review';
import { ReviewPage } from './ReviewPage';

// /prd/<id>/review, the review screen (PRD omni-loop-20 s5): the one signed decision that waits on the viewer,
// read as the signed-in person, so row-level security decides as it does on the PRD's page (../page/DossierRoute.tsx).
// Signed out, the sign-in card, coming back through the PRD's own callback; a dossier the viewer may not
// read, not found; a fix, sent to its own page. The approval is read exactly as the page reads it
// (./approval-read.ts), the Omni App's latest Ready verdict beside it for a numbered PRD. With no decision
// waiting on the viewer, or one they may not take, the viewer is sent back to /prd/<id>. The demo has no
// approval of its own: it draws the demo's review (../page/demo.ts), no database and no network.

export type ReviewRouteProps = DossierRouteProps;

type Member = Extract<Gated, { member: unknown }>['member'];

const unread = (error: unknown): null => {
  console.error(error);
  return null;
};

/** The Omni App's latest Ready verdict for a numbered PRD; null for any other, with none, or when it could not be read. */
function readyOf(db: Db, { dossier }: DossierRead): Promise<ReadyView | null> {
  return dossier.prd === null ? Promise.resolve(null) : readLatestVerdict(db, dossier.home_repo, dossier.prd).then(readyView, unread);
}

/** The latest plan, rendered; null with none, or when it could not be read. */
function planMarkdownOf(db: Db, read: DossierRead) {
  const latest = read.versions.filter((v) => v.kind === 'plan').at(-1);
  return latest ? markdownOf(() => readContent(db, latest.id)) : Promise.resolve(null);
}

/** How the screen names the member `me`: their name, else their email, else that it is them. */
function nameOf(read: DossierRead, me: string): string {
  const member = read.members.find((m) => m.user_id === me);
  return member ? member.name ?? member.email : 'you';
}

/** The dossier `id` the member reads; null when they may not, `down` when the database did not answer. */
async function readOf({ db, user }: Member, id: string): Promise<DossierRead | null | 'down'> {
  try {
    return await readDossier(db, id, user.id);
  } catch (error) {
    console.error(error);
    return 'down';
  }
}

/** The PRD `id` the member reads, or the page shown instead (the database down); not found, and a fix sent to its own page. */
async function prdOf(member: Member, id: string): Promise<DossierRead | { page: ReactNode }> {
  const read = await readOf(member, id);
  if (read === 'down') return { page: <DossierDatabaseDown /> };
  if (!read) notFound();
  const kind = kindOf(read.dossier);
  if (kind !== 'prd') redirect(workPath(kind, id));
  return read;
}

/** What only one decision reads: Approve the plan's slices, Review the plan the plan itself. */
async function extrasOf(db: Db, read: DossierRead, decision: ReviewKind) {
  const [slices, planMarkdown] = await Promise.all([
    decision === 'approve' ? readPlanSlices(db, read.versions) : null,
    decision === 'tech' ? planMarkdownOf(db, read) : null,
  ]);
  return { plan: planLine(read.versions, slices), planMarkdown };
}

type Facts = Awaited<ReturnType<typeof approvalOf>>;

/** The screen of `decision` on the PRD `read`, as the member `me` reads it. */
async function screenOf(db: Db, read: DossierRead, at: { decision: ReviewKind; facts: Facts; me: string; ready: ReadyView | null }) {
  const { decision, facts, me, ready } = at;
  const { dossier } = read;
  return (
    <ReviewPage
      kind={decision}
      dossier={{ id: dossier.id, title: dossier.title, label: prdLabel(dossier.prd ?? facts.approvalFacts?.productPrd) }}
      me={nameOf(read, me)}
      approval={approvalView({ ...read, ...facts }, me)}
      ready={ready}
      pinned={pinnedOf(read.versions)}
      {...await extrasOf(db, read, decision)}
    />
  );
}

/** The review screen of dossier `id`, or where its viewer is sent instead. */
export async function reviewRoute({ params, searchParams }: ReviewRouteProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const mode = serverEnv().mode;
  if (mode === 'demo') return <ReviewPage {...demoReview(Date.now())} />;
  const gate = gated(await dossierSession(mode), id, query);
  if ('page' in gate) return gate.page;
  const read = await prdOf(gate.member, id);
  if ('page' in read) return read.page;
  const { db, user } = gate.member;
  const [facts, ready] = await Promise.all([approvalOf(db, read, user.id), readyOf(db, read)]);
  const decision = reviewKindOf(approvalView({ ...read, ...facts }, user.id), ready);
  if (decision === null) redirect(dossierPath(id));
  return screenOf(db, read, { decision, facts, me: user.id, ready });
}
