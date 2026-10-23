import { Suspense, type ReactNode } from 'react';
import type { GithubSummary } from '../../github/summary';
import type { GithubAt } from '../../snapshot/snapshot';
import type { RenderedMarkdown } from '../../markdown';
import { SendToTerminalScope } from '../../../runners/send/SendToTerminal';
import type { SendSetup } from '../../../runners/send/targets';
import type { StageRow } from '../../../stages/stage';
import type { MainWatchRead } from '../../../main-watch/store';
import type { FindingView } from '../../../rewind/rewind.contract';
import type { MilestoneRow } from '../../../timeline/store';
import { DossierPage } from '../DossierPage';
import { dossierView, type DossierPick, type DossierRead } from '../view';
import type { VoiceView } from '../voice';
import { pendingView } from './pending';

// A PRD's page, streamed (PRD 657 s4): its GitHub summary is read beside the page, never before it.
// The server sends the page as soon as the database has answered (the header, the stored stage, the
// tabs, the shown version), with the parts only GitHub knows saying they are being read (./pending.ts):
// the stage's button and GitHub links, the Outbox and the Retro. When the summary arrives, the whole
// page is sent again in its place, complete. A summary that could not be read reads null, as before:
// the page then says so where it did.
// Bug #782: the change check (LiveRefresh), which carries the play dock (PRD 757) and the page's live
// poll, sits beside the page, never inside what waits for GitHub: it starts from the database's read as
// soon as its own reads answer, and stays mounted when the complete page takes the pending one's place.
// Its signature keeps only new work (../live-refresh-watch.ts), so it needs no GitHub part.
// PRD 1830 s4: both the pending page and the complete one give Send to terminal the viewer's runners.

/** The reads of a numbered PRD's page, each started by the route and never awaited there. */
export interface DossierReads {
  /** The GitHub summary: null when GitHub could not be read. */
  github: Promise<GithubSummary | null>;
  /** When it was read, and when GitHub resumes (PRD 902, s2): null when not known; left out, none. */
  githubAt?: Promise<GithubAt | null>;
  /** The plan's slice count: null when not known. */
  slices: Promise<number | null>;
  /** The stored stages: null when they could not be read. */
  stages: Promise<readonly StageRow[] | null>;
  /** The stored milestones (PRD 2370, s5): null when they could not be read; left out, not asked for. */
  milestones?: Promise<readonly MilestoneRow[] | null>;
  /** The PRD's watch on main (PRD 2410, s3): null when it could not be read; left out, not asked for. */
  mainWatch?: Promise<MainWatchRead | null>;
  /** What the rewind found (PRD 2410, s5): null when it could not be read; left out, not asked for. */
  rewind?: Promise<readonly FindingView[] | null>;
}

export interface DossierStreamProps {
  read: DossierRead;
  me: string;
  pick: DossierPick;
  reads: DossierReads;
  /** The shown Spec or Plan, rendered: it does not wait for GitHub. */
  markdown: Promise<RenderedMarkdown | null>;
  /** The shown User voice version, read (PRD 822): it does not wait for GitHub; left out, none. */
  voice?: Promise<VoiceView | null>;
  supabase: { url: string; key: string };
  /** The change check, from the page as the database read it (and, PRD 757, its play dock's player). */
  live: (read: DossierRead) => ReactNode | Promise<ReactNode>;
  /** Where the viewer may send a line a runner runs (PRD 1830 s4): left out or null, Send to terminal shows nowhere. */
  send?: SendSetup | null;
}

type Props = Omit<DossierStreamProps, 'live'>;

/** The page as the database has it, before GitHub answers. */
async function Pending({ read, me, pick, reads, markdown, voice, supabase, send = null }: Props) {
  const [slices, stages, milestones, mainWatch, rewindFindings, shown, heard] = await Promise.all([reads.slices, reads.stages, reads.milestones, reads.mainWatch, reads.rewind, markdown, voice ?? null]);
  const view = pendingView(dossierView({ ...read, slices, stages, milestones, mainWatch, rewindFindings }, me, pick));
  return <SendToTerminalScope setup={send}><DossierPage view={view} markdown={shown} voice={heard} supabase={supabase} /></SendToTerminalScope>;
}

/** The whole page, with its GitHub summary: what the page ends as. */
export async function completePage({ read, me, pick, reads, markdown, voice, supabase, send = null }: Props) {
  const [github, githubAt, slices, stages, milestones, mainWatch, rewindFindings, shown, heard] = await Promise.all([reads.github, reads.githubAt ?? null, reads.slices, reads.stages, reads.milestones, reads.mainWatch, reads.rewind, markdown, voice ?? null]);
  const withGithub: DossierRead = { ...read, github, githubAt, slices, stages, milestones, mainWatch, rewindFindings };
  return <SendToTerminalScope setup={send}><DossierPage view={dossierView(withGithub, me, pick)} markdown={shown} voice={heard} supabase={supabase} /></SendToTerminalScope>;
}

async function Complete(props: Props) {
  return completePage(props);
}

/** The change check, from the database's read: it never waits for GitHub (bug #782). */
async function Live({ read, live }: Pick<DossierStreamProps, 'read' | 'live'>) {
  return <>{await live(read)}</>;
}

export function DossierStream({ live, ...props }: DossierStreamProps) {
  return (
    <>
      <Suspense fallback={null}>
        <Live read={props.read} live={live} />
      </Suspense>
      <Suspense fallback={<Pending {...props} />}>
        <Complete {...props} />
      </Suspense>
    </>
  );
}
