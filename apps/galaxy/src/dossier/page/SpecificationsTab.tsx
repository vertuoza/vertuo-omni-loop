import Link from 'next/link';
import { EmptyState, Notice, SegmentedControl } from '@omni/ui';
import type { ArtifactKind } from '../store';
import type { RenderedMarkdown } from '../markdown';
import { reviewPath } from '../review/review';
import { AboutPrd } from './AboutPrd';
import type { ApprovalView } from './approval';
import { Attestation } from './Attestation';
import type { AttestationView } from './Attestation.service';
import { BusinessLawsVerdict } from './BusinessLawsVerdict';
import { FRAME_SANDBOX } from './sandbox';
import { SealCard } from './SealCard';
import { VersionPicker } from './VersionPicker';
import { TAB_LABELS, type DossierView } from './view';
import { VOICE_EMPTY } from './voice';

// The Specifications tab of /prd/<id> (omni-loop-20 s7): Before/after · Spec · Plan · Approval record on one
// segmented control, the segment named in the address (`?segment=plan`). Before/after frames the version
// shown on its sandboxed route; Spec and Plan render it from markdown, raw HTML off, the front matter as a
// line above; each has its version picker, and one with no version says so. Approval record, for a ◆ PRD,
// holds the seals of the approval in force, its business laws' verdict and a product PRD's attestation, at
// #attestation. While a version waits for the viewer's approval or Tech Approval, the tab opens on one line
// linking to the review screen (/prd/<id>/review): no approve panel is drawn on the page. About this PRD
// sits beside the segment as side facts (s11); the version picker is one button, and the front matter a line beside it.

type Shown = NonNullable<DossierView['shown']>;

const EMPTY: Record<ArtifactKind, string> = {
  'before-after': 'The before/after page has no version yet.',
  spec: 'The spec has no version yet.',
  plan: 'The plan has no version yet.',
  variations: 'No round of variations yet.',
  'bug-record': 'The bug record has no version yet.',
  voice: VOICE_EMPTY,
};

/** An artifact with no version yet says so. */
export function NoVersion({ kind }: { kind: ArtifactKind }) {
  return <EmptyState size="inline" title={`${EMPTY[kind]} It shows here once it is pushed, or once the page reads it from the repository.`} />;
}

function MarkdownVersion({ markdown }: { markdown: RenderedMarkdown | null }) {
  if (!markdown) return <Notice tone="danger">This version could not be read. Reload the page in a moment.</Notice>;
  return (
    <article className="dossier-md" dangerouslySetInnerHTML={{ __html: markdown.html }} />
  );
}

/** The shown version of an artifact under its picker: framed, or rendered from markdown. */
export function ArtifactPane({ view, kind, shown, markdown }: { view: DossierView; kind: ArtifactKind; shown: Shown; markdown: RenderedMarkdown | null }) {
  const round = kind === 'variations';
  const picker = <VersionPicker action={view.link} tab={kind} versions={view.versions} shown={shown.number} noun={round ? 'Round' : 'Version'} button={view.kind === 'prd'} />;
  if (shown.frame) {
    return (
      <>
        {picker}
        <figure className="dossier-frame">
          <figcaption className="ask-hint">
            sandboxed · no cookies · no network ·{' '}
            <a href={shown.frame} target="_blank" rel="noopener noreferrer">open on its own</a>
          </figcaption>
          <iframe src={shown.frame} sandbox={FRAME_SANDBOX} title={`${TAB_LABELS[kind]}, ${round ? `Round ${shown.number}` : `v${shown.number}`}`} />
        </figure>
      </>
    );
  }
  return (
    <>
      <div className="dossier-version-row">
        {picker}
        {markdown?.front && <p className="dossier-front">{markdown.front}</p>}
      </div>
      <MarkdownVersion markdown={markdown} />
    </>
  );
}

/** The one line that sends the viewer to the review screen while a signed decision waits on them; nothing otherwise. */
function Waiting({ view }: { view: DossierView }) {
  const { approval } = view;
  if (approval?.tech?.canGive) {
    return <Notice tone="warning" title="The plan waits for your Tech Approval."><Link href={reviewPath(view.id)}>Review the plan</Link></Notice>;
  }
  if (!approval?.canApprove) return null;
  const title = approval.state === 'waiting' ? 'This version waits for your approval.' : 'It changed since it was approved: it waits for your approval again.';
  return <Notice tone="warning" title={title}><Link href={reviewPath(view.id)}>Review and approve</Link></Notice>;
}

/** The seals of an approval in force: the tech one first, then the product one. */
function Seals({ approval }: { approval: ApprovalView }) {
  const seals = [approval.tech?.seal ? { ...approval.tech.seal, name: `Tech approval · PRD ${approval.tech.seal.prd}` } : null, approval.seal ? { ...approval.seal, name: `PRD ${approval.seal.prd}` } : null];
  return <>{seals.map((seal) => seal && <SealCard key={seal.name} seal={{ ...seal, mark: String(seal.prd) }} dossier={approval.dossier} />)}</>;
}

/** The Approval record of a ◆ PRD: its seals, its business laws' verdict and a product PRD's attestation. */
function ApprovalRecord({ approval, attestation }: { approval: ApprovalView; attestation: AttestationView | null }) {
  const sealed = approval.seal !== null || approval.tech?.seal;
  return (
    <>
      {!sealed && !attestation && <EmptyState size="inline" title="No approval is in force yet. Its seals show here once it is approved." />}
      <Seals approval={approval} />
      <BusinessLawsVerdict laws={approval.laws} />
      {attestation && <Attestation attestation={attestation} />}
    </>
  );
}

/** The segment shown: an artifact's version, its empty line, or the Approval record. */
function SegmentPane({ view, markdown, attestation }: { view: DossierView; markdown: RenderedMarkdown | null; attestation: AttestationView | null }) {
  const { segment, shown } = view;
  if (segment === null) return null;
  if (segment === 'approval') return view.approval && <ApprovalRecord approval={view.approval} attestation={attestation} />;
  if (!shown) return <NoVersion kind={segment} />;
  return <ArtifactPane view={view} kind={segment} shown={shown} markdown={markdown} />;
}

type Props = {
  view: DossierView;
  markdown: RenderedMarkdown | null;
  attestation: AttestationView | null;
  supabase: { url: string; key: string } | null;
};

export function SpecificationsTab({ view, markdown, attestation, supabase }: Props) {
  return (
    <>
      <Waiting view={view} />
      <div className="dossier-specifications">
        <div className="dossier-specifications__main">
          <SegmentedControl
            label="Specifications"
            options={view.segments.map((s) => ({ id: s.id, label: s.label, href: s.href }))}
            value={view.segment ?? 'before-after'}
            link={Link}
          />
          <SegmentPane view={view} markdown={markdown} attestation={attestation} />
        </div>
        <AboutPrd view={view} supabase={supabase} />
      </div>
    </>
  );
}
