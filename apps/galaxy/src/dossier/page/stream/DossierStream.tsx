import { Suspense, type ReactNode } from 'react';
import type { GithubSummary } from '../../github/summary';
import type { RenderedMarkdown } from '../../markdown';
import type { StageRow } from '../../../stages/stage';
import { DossierPage } from '../DossierPage';
import { dossierView, type DossierPick, type DossierRead } from '../view';
import { pendingView } from './pending';

// A PRD's page, streamed (PRD 657 s4): its GitHub summary is read beside the page, never before it.
// The server sends the page as soon as the database has answered (the header, the stored stage, the
// tabs, the shown version), with the parts only GitHub knows saying they are being read (./pending.ts):
// the stage's button and GitHub links, the Outbox and the Retro. When the summary arrives, the whole
// page is sent again in its place, complete, with the change check (LiveRefresh) started from what was
// read. A summary that could not be read reads null, as before: the page then says so where it did.

/** The reads of a numbered PRD's page, each started by the route and never awaited there. */
export interface DossierReads {
  /** The GitHub summary: null when GitHub could not be read. */
  github: Promise<GithubSummary | null>;
  /** The plan's slice count: null when not known. */
  slices: Promise<number | null>;
  /** The stored stages: null when they could not be read. */
  stages: Promise<readonly StageRow[] | null>;
}

export interface DossierStreamProps {
  read: DossierRead;
  me: string;
  pick: DossierPick;
  reads: DossierReads;
  /** The shown Spec or Plan, rendered: it does not wait for GitHub. */
  markdown: Promise<RenderedMarkdown | null>;
  supabase: { url: string; key: string };
  /** The change check, from the page as read with its summary (and, PRD 757, its play dock's player). */
  live: (read: DossierRead) => ReactNode | Promise<ReactNode>;
}

type Props = Omit<DossierStreamProps, 'live'>;

/** The page as the database has it, before GitHub answers. */
async function Pending({ read, me, pick, reads, markdown, supabase }: Props) {
  const [slices, stages, shown] = await Promise.all([reads.slices, reads.stages, markdown]);
  const view = pendingView(dossierView({ ...read, slices, stages }, me, pick));
  return <DossierPage view={view} markdown={shown} supabase={supabase} />;
}

/** The whole page, with its GitHub summary: what the page ends as. */
export async function completePage({ read, me, pick, reads, markdown, supabase, live }: DossierStreamProps) {
  const [github, slices, stages, shown] = await Promise.all([reads.github, reads.slices, reads.stages, markdown]);
  const withGithub: DossierRead = { ...read, github, slices, stages };
  return <DossierPage view={dossierView(withGithub, me, pick)} markdown={shown} supabase={supabase} live={await live(withGithub)} />;
}

async function Complete(props: DossierStreamProps) {
  return completePage(props);
}

export function DossierStream(props: DossierStreamProps) {
  return (
    <Suspense fallback={<Pending {...props} />}>
      <Complete {...props} />
    </Suspense>
  );
}
