import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button, EmptyState, Tabs, type TabItem } from '@omni/ui';
import { TrailItem } from '../../nav/AppBarItem';
import { TimelinePane } from '../../fixes/TimelinePane';
import { PrdTimelinePane } from '../../timeline/TimelineView';
import type { RenderedMarkdown } from '../markdown';
import { reviewPath } from '../review/review';
import type { AttestationView } from './Attestation.service';
import { CopyLink } from './CopyLink';
import { FeatureTab } from './FeatureTab';
import { MarkSeen } from './MarkSeen';
import { OutboxPane } from './OutboxPane';
import { OutboxPaneProduct } from './OutboxPaneProduct';
import type { ProductOutboxView } from './outbox-product';
import { QuestionsPane } from './QuestionsPane';
import type { ReadyView } from './ready';
import { RetroTab } from './RetroTab';
import { seenSignature } from './seen';
import { PinnedHead } from './PinnedHead';
import { AboutPrd } from './AboutPrd';
import { actionsOf, eyebrowOf, fixTrack, metaOf, nextStep, prdTrack, type NextStep } from './next-step';
import { ArtifactPane, NoVersion, SpecificationsTab } from './SpecificationsTab';
import { SpecificationsTabAnchors } from './SpecificationsTabAnchors';
import { HeadTrack, StageAction } from './StageHeader';
import { DossierHead } from './StageHeaderHead';
import { VersionPicker } from './VersionPicker';
import { isArtifactTab, TAB_LABELS, type DossierView } from './view';
import { VOICE_EMPTY, type VoiceView } from './voice';
import { VoicePane } from './VoicePane';

// /prd/<id>, the page to share (PRD 216's spec, "The pages"): the header — PRD #n or DRAFT, the title,
// the repository chips, who opened it and when, Copy link, and Delete draft for its opener — then a tab
// per artifact and the Questions tab. Before/after frames the version shown on its sandboxed route;
// Spec and Plan show it rendered from markdown, raw HTML off, the front matter as a line above. Each
// artifact tab with a version has its version picker; one with none says so. Questions lists the rounds
// that shaped it, and its label counts the questions answered out of those asked, with a yellow
// `N to answer` badge while any is open (PRD 498). Rendered on the server: the
// tabs and the picker are links and a GET form, so it all works before any script runs.
// PRD 426 put the stage on top: "PRD #n ↗" linking to its issue, the track, the one button and the
// links (StageHeader.tsx). PRD 476 gathers the header into one box in three rows: the title with its
// actions (the stage's button, Copy link, Delete draft for a draft's opener), the facts strip (Stage,
// Repo or Repos, On GitHub, Opened; a cell with nothing to show is left out), then the tabs. From
// 900 × 700 px the box is pinned while the page scrolls (PinnedHead.tsx measures it).
// Its Outbox tab (OutboxPane.tsx) is where the decisions taken while it was built are answered, beside
// the spec, the before/after page or the brainstorm (PRD 251, s9), and its Retro tab
// (RetroPane.tsx) renders the retro once written; empty, each reads muted. Between them, while the PRD has
// a feature PR, its PR care tab (CarePane.tsx, PRD 790) shows that PR's health and who watches it.
// PRD 579: opening the page marks its PRD seen in this browser (MarkSeen.tsx), and so does each new
// version it renders while open, so the bell's New documents group drops it.
// PRD 627: a fix's page is this page on its own route, `#n ↗` with its Visual or Bug badge, no stage,
// and its kind's tabs: Variations frames the round picked, chosen as Round k; Bug record is markdown.
// PRD 627, s5: a fix's page opens on its Timeline (fixes/Timeline.tsx), and its facts strip carries its
// State pill (Asked, In review, Merged, or `—`) and, On GitHub, its issue and its fix PR.
// PRD 798, s4: a PRD with a proof run has a Proof tab (ProofPane.tsx): the run, then a row per criterion.
// PRD 859, s3: a PRD with a pitch has a Pitch tab after it (PitchPane.tsx): the latest pitch per audience.
// PRD 652: "opened by" draws the opener's face (PersonChip) before their name; the words are unchanged.
// PRD 822: a PRD's User voice tab, after Plan, draws the shown version of its voice.json (VoicePane.tsx)
// under its version picker; with none, it says so in the spec's words.
// PRD 902, s2: a PRD's On GitHub cell says when GitHub was last read (`GitHub as of 09:15 UTC`), and
// while the installation's budget is paused, when GitHub resumes.
// PRD 1299, s3: a PRD born on the server has an Approval cell after Stage (waiting for approval, approved
// by whom and when, or drifted · approve again with the files changed), and, for a member while it waits
// or drifted, the Approve button first among its actions. A PRD born in the repository is unchanged.
// PRD 1322 s7: Approve moves out of the actions into the approve screen, under the head, shown only to a
// viewer allowed to approve: after a void (voided · approve again) or a drift, each changed file's diff
// first, then the spec's Problem and Solution, then the button.
// PRD 1364 s7: a PRD has a Product cell after Approval, its picker (ProductPicker.tsx): the workspace's
// products and No product, changed by any member until an approval is in force, then locked, shown once the page
// has read it. None in the demo, nor on a fix.
// PRD 1548 s4: a product PRD's approval in force has its attestation under the head (Attestation.tsx), at
// #attestation, where omni/approved's Details opens; Ask again there opens the approve screen, at #approve.
// omni-loop-20 s6: the head moves onto the page anatomy (@omni/ui's PageHeader and StageTrack): the eyebrow,
// the title, a subtitle naming who acts next and what (next-step.ts), at most five facts, Copy link, the one
// primary for the person who acts (the signed decisions linking to /prd/<id>/review), the Actions menu
// (Request a Tech Approval, Delete draft), then the stage said once. The facts strip is gone: what the head
// has no room for is About this PRD (AboutPrd.tsx), under the tab bar. Only the tab row pins. A fix's page
// gets the same head, its track Asked · Picked · Approved · Merged · Released. The page spans the full width.
// omni-loop-20 s7: a PRD's page has seven tabs, always, in order — Brainstorm, Specifications, User voice,
// Outbox, Feature, Retro, Timeline — each count a pill, yellow only when the tab waits on the viewer, an empty
// tab dimmed with its reason. Specifications (SpecificationsTab.tsx) holds Before/after · Spec · Plan ·
// Approval record on a segmented control, then About this PRD; Feature (FeatureTab.tsx) the Ready checks, then
// PR care, Proof and After merge; Retro (RetroTab.tsx) the retro, then Pitch. No panel floats above any tab:
// the approve screen and the Ready panel are gone from above the pane, the signed decisions are taken on the
// review screen. The page opens on the tab that waits on the reader (view.ts). A fix's page keeps its tabs,
// with About this fix under the tab bar.

type Props = {
  view: DossierView;
  /** The shown version of the Spec or Plan, rendered; null on Before/after, or when it could not be read. */
  markdown: RenderedMarkdown | null;
  /** Where the browser deletes a draft from; null when this deployment has no database (the demo). */
  supabase: { url: string; key: string } | null;
  /** The change check (PRD 384), shown below the tabs; none in the demo. */
  live?: ReactNode;
  /** The shown version of the User voice, read (PRD 822); null off that tab, or when it could not be read. */
  voice?: VoiceView | null | undefined;
  /** A product PRD's attestation (PRD 1548 s4); null or left out when nobody approved it, or for any other dossier. */
  attestation?: AttestationView | null | undefined;
  /** A product PRD's outbox from the server's rows (PRD 2011 s15); null or left out for any other dossier, whose Outbox tab reads GitHub. */
  productOutbox?: ProductOutboxView | null | undefined;
  /** The latest verdict the Omni App saved for the PRD's feature PR (PRD 2898 s9); null or left out with none, and then no record. */
  ready?: ReadyView | null | undefined;
};

type PaneProps = Pick<Props, 'view' | 'markdown' | 'supabase' | 'voice' | 'productOutbox' | 'attestation' | 'ready'>;

/** The User voice tab (PRD 822): its picker and the shown version drawn, or the spec's empty line. */
function VoiceTab({ view, voice = null }: PaneProps) {
  const { shown } = view;
  if (!shown) return <EmptyState size="inline" title={`${VOICE_EMPTY}.`} />;
  return (
    <>
      <VersionPicker action={view.link} tab="voice" versions={view.versions} shown={shown.number} noun="Version" button />
      <VoicePane view={voice} rework={view.rework} />
    </>
  );
}

/** The questions that shaped it: a PRD's Brainstorm, a fix's Questions. */
const Questions = ({ view, supabase }: PaneProps) => <QuestionsPane questions={view.questions} supabase={supabase} />;

/** The tabs drawn by a pane of their own, not as an artifact's versions. */
const OWN_PANES: Partial<Record<DossierView['tab'], (props: PaneProps) => ReactNode>> = {
  brainstorm: Questions,
  questions: Questions,
  specifications: ({ view, markdown, attestation = null, supabase }) => <SpecificationsTab view={view} markdown={markdown} attestation={attestation} supabase={supabase} />,
  outbox: ({ view, markdown, productOutbox }) => productOutbox
    ? <OutboxPaneProduct outbox={productOutbox} />
    : <OutboxPane dossierId={view.id} outbox={view.outbox} spec={markdown} />,
  feature: ({ view, ready = null }) => <FeatureTab view={view} ready={ready} />,
  retro: ({ view }) => <RetroTab view={view} />,
  timeline: ({ view }) => (view.kind === 'prd' ? <PrdTimelinePane timeline={view.timeline} /> : <TimelinePane fix={view.fix} />),
  voice: VoiceTab,
};

function Pane(props: PaneProps) {
  const { view, markdown } = props;
  const { shown, tab } = view;
  const own = OWN_PANES[tab];
  if (own) return own(props);
  if (!isArtifactTab(tab)) return null;
  if (!shown) return <NoVersion kind={tab} />;
  return <ArtifactPane view={view} kind={tab} shown={shown} markdown={markdown} />;
}

/** The one primary, for the person who acts: a signed decision or the outbox's answers as a link, else the
 * stage's own button (a command to copy, a GitHub link, Pitch). */
function Primary({ view, primary }: { view: DossierView; primary: NonNullable<NextStep['primary']> }) {
  if (primary.kind === 'link') return <Button variant="primary" href={primary.href}>{primary.label}</Button>;
  return <StageAction stage={view.stage} demo={view.demo ?? false} />;
}

/** The name the app bar's trail gives the item (omni-loop-20 s6): `PRD #216`, `Draft`, or a fix's `Visual #548`. */
const trailName = (view: DossierView) => (view.kind !== 'prd' ? `${view.badge ?? 'Fix'} ${view.heading}` : view.draft ? 'Draft' : view.heading);

/** The head on the page anatomy (omni-loop-20 s6): eyebrow, title, who acts next, at most five facts, Copy
 * link, the one primary for the person who acts, the Actions menu, then the stage said once. It scrolls
 * away; only the tab row under it pins. */
function Head({ view, supabase, ready = null }: Pick<Props, 'view' | 'supabase' | 'ready'>) {
  const step = nextStep(view, ready);
  const track = view.kind === 'prd' ? prdTrack(view) : fixTrack(view);
  const draft = view.canDelete && supabase ? { supabase, id: view.id } : null;
  return (
    <div className="dossier-top">
      <TrailItem name={trailName(view)} />
      <DossierHead
        title={view.title}
        eyebrow={eyebrowOf(view)}
        lede={step.lede}
        meta={metaOf(view)}
        {...(step.primary ? { action: <Primary view={view} primary={step.primary} /> } : {})}
        secondary={<CopyLink path={view.link} />}
        actions={actionsOf(view, draft !== null)}
        draft={draft}
        dossier={view.approval?.dossier ?? view.id}
      />
      {track && <HeadTrack track={track} />}
    </div>
  );
}

/** The tab row, on @omni/ui's Tabs: each count a mono pill, yellow only when the tab waits on the viewer, an
 * empty tab dimmed with its reason. Each is a next/link, so a tab switches in the app, prefetched, never a
 * full page load (PRD 2401). */
function HeadTabs({ view }: { view: DossierView }) {
  const items = view.tabs.map((t): TabItem => ({
    id: t.kind,
    href: t.href,
    label: t.label,
    ...(t.badge === null ? {} : { count: t.badge, attention: t.attention }),
    ...(t.why === null ? {} : { empty: t.why }),
  }));
  return (
    <Tabs label="Artifacts" current={view.tab} items={items} link={Link} />
  );
}

/** Where the page's old anchors lead (`#approve`, `#approval`, `#attestation`): the review screen while a
 * decision waits on the viewer, else the Specifications tab's Approval record. A PRD's page only. */
function OldAnchors({ view }: { view: DossierView }) {
  if (view.kind !== 'prd') return null;
  const waits = view.approval !== null && (view.approval.canApprove || view.approval.tech?.canGive === true);
  const record = view.tabs.find((t) => t.kind === 'specifications')?.href ?? view.link;
  const at = new URL(record, 'https://page.invalid');
  at.searchParams.set('segment', 'approval');
  return <SpecificationsTabAnchors review={waits ? reviewPath(view.id) : null} record={`${at.pathname}${at.search}`} />;
}

export function DossierPage({ view, markdown, supabase, live, voice, attestation, productOutbox, ready }: Props) {
  return (
    <div className="dossier">
      <Head view={view} supabase={supabase} ready={ready} />
      <PinnedHead bar>
        <HeadTabs view={view} />
      </PinnedHead>
      {view.kind !== 'prd' && <AboutPrd view={view} supabase={supabase} />}
      <OldAnchors view={view} />
      <MarkSeen id={view.id} signature={seenSignature(view.latest)} />
      {live}
      <section className="dossier-pane" aria-label={TAB_LABELS[view.tab]}>
        <Pane view={view} markdown={markdown} supabase={supabase} voice={voice} productOutbox={productOutbox} attestation={attestation} ready={ready} />
      </section>
    </div>
  );
}
