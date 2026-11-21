import type { ReactNode } from 'react';
import { Badge, Button, ListRow, Notice, ReviewScreen, Stack, Text, type ReviewSection } from '@omni/ui';
import type { RenderedMarkdown } from '../markdown';
import type { ApprovalView, ApproveScreen } from '../page/approval';
import type { DiffLine } from '../page/approval-diff';
import { approveOff } from '../page/approval';
import { ApproveButton } from '../page/ApproveButton';
import { BusinessLawsVerdict } from '../page/BusinessLawsVerdict';
import { GiveTechApprovalButton } from '../page/GiveTechApprovalButton';
import type { ReadyView } from '../page/ready';
import { dossierPath } from '../page/view';
import { reviewWords, screenOf, type PinnedFile, type ReviewKind } from './review';
import './review.css';

// The review screen at /prd/<id>/review (PRD omni-loop-20 s5), on @omni/ui's ReviewScreen: one signed decision,
// its reading in order, then the decision bar. Review and approve reads what changed since it was approved,
// the business laws' verdict, then what the approval covers (the spec's Problem and Solution, the plan's line
// and the files Approve pins); Review the plan reads the plan first, then what changed since the viewer's last
// Tech Approval and the verdict; Review the feature reads the five Ready checks, then each criterion's proof.
// Back to the PRD sits beside the one decision. The screen is a region named by its title, inside the app's
// main landmark, and spans the width it is given; prose keeps the part's 900 px measure.

export type ReviewPageProps = {
  kind: ReviewKind;
  dossier: { id: string; title: string; label: string };
  /** The member reading it, as the page names them. */
  me: string;
  approval: ApprovalView | null;
  ready: ReadyView | null;
  /** The files Approve pins, each its latest version. */
  pinned: readonly PinnedFile[];
  /** `Plan v2 · 14 slices`; null with no plan. */
  plan: string | null;
  /** The latest plan, rendered, for Review the plan; null when it could not be read. */
  planMarkdown: RenderedMarkdown | null;
};

const DIFF_CLASS = { '+': 'dossier-diff-add', '-': 'dossier-diff-del', ' ': 'dossier-diff-same', '…': 'dossier-diff-gap' } as const;

/** One line of a diff: its sign, then its text; a gap reads `…`. */
function DiffRow({ row }: { row: DiffLine }) {
  const line = row.sign === '…' ? row.sign : `${row.sign} ${row.text}`;
  return <span className={DIFF_CLASS[row.sign]}>{`${line}\n`}</span>;
}

/** Each changed file's diff since it was last approved, or why there is none. */
function WhatChanged({ screen, first }: { screen: ApproveScreen | null; first: string }) {
  const diffs = screen?.diffs ?? [];
  if (diffs.length === 0) return <Text tone="secondary">{first}</Text>;
  return (
    <Stack gap="4">
      {diffs.map(({ path, rows }) => (
        <div key={path} className="dossier-approve-diff">
          <h3>{path}</h3>
          {rows === null
            ? <Notice tone="danger">This file’s change could not be read. Reload the page in a moment.</Notice>
            : <pre className="dossier-diff" aria-label={`Changes to ${path}`}>{rows.map((row, at) => <DiffRow key={at} row={row} />)}</pre>}
        </div>
      ))}
    </Stack>
  );
}

/** The business laws' verdict, or that there is none to show. */
function Laws({ approval, note }: { approval: ApprovalView | null; note?: string }) {
  const laws = approval?.laws;
  const shown = laws && laws.show !== 'nothing';
  return (
    <Stack gap="3">
      {shown ? <BusinessLawsVerdict laws={laws} /> : <Text tone="secondary">No business law judged.</Text>}
      {note === undefined ? null : <Text size="small" tone="secondary">{note}</Text>}
    </Stack>
  );
}

/** What the approval covers: the spec's Problem and Solution, the plan's line, then the files Approve pins. */
function WhatYouApprove({ screen, plan, pinned, id }: { screen: ApproveScreen | null; plan: string | null; pinned: readonly PinnedFile[]; id: string }) {
  return (
    <Stack gap="4">
      {screen?.sections.map((section) => (
        <div key={section.name} className="dossier-approve-section">
          <h3>{section.name}</h3>
          <article className="dossier-md" dangerouslySetInnerHTML={{ __html: section.html }} />
        </div>
      ))}
      {screen?.spec === 'unread' && <Notice tone="danger">The spec could not be read. Reload the page in a moment.</Notice>}
      {plan !== null && <Text>The plan: {plan} · <a href={`${dossierPath(id)}?tab=plan`}>Read the plan</a></Text>}
      {pinned.length > 0 && (
        <Text size="small" tone="secondary">Pins {pinned.map((file) => file.name).join(', ')}.</Text>
      )}
    </Stack>
  );
}

/** The latest plan, its front matter as a quiet line above it; or that it could not be read. */
function PlanSection({ markdown }: { markdown: RenderedMarkdown | null }) {
  if (markdown === null) return <Notice tone="danger">The plan could not be read. Reload the page in a moment.</Notice>;
  const { front, html } = markdown;
  return (
    <Stack gap="3">
      {front ? <Text size="small" tone="secondary">{front}</Text> : null}
      <article className="dossier-md" dangerouslySetInnerHTML={{ __html: html }} />
    </Stack>
  );
}

const TONE = { pass: 'success', fail: 'danger', wait: 'warning' } as const;

/** The five Ready checks, each with its state and its evidence. */
function ReadyChecks({ ready }: { ready: ReadyView }) {
  return (
    <ol className="dossier-review-list" aria-label="Ready checks">
      {ready.checks.map((check) => (
        <li key={check.name}>
          <ListRow
            title={check.name}
            {...(check.note === null ? {} : { detail: check.note })}
            trailing={(
              <Stack direction="row" gap="2" align="center">
                <Badge tone={TONE[check.tone]}>{check.state}</Badge>
                {check.evidence && <a href={check.evidence} target="_blank" rel="noopener noreferrer">Evidence</a>}
              </Stack>
            )}
          />
        </li>
      ))}
    </ol>
  );
}

/** Each acceptance criterion: its scenario, its state, and the proof that ran, or that none did yet. */
function Criteria({ ready }: { ready: ReadyView }) {
  const criteria = ready.checks.flatMap((check) => check.criteria);
  if (criteria.length === 0) return <Text tone="secondary">The spec states no acceptance criterion.</Text>;
  return (
    <ol className="dossier-review-list" aria-label="Acceptance criteria">
      {criteria.map((ac) => (
        <li key={ac.id}>
          <ListRow
            title={`${ac.id} · ${ac.kind}${ac.title ? ` · ${ac.title}` : ''}`}
            detail={ac.steps.map((step) => `${step.keyword} ${step.text}`).join(' ')}
            trailing={(
              <Stack direction="row" gap="2" align="center">
                <Badge tone={TONE[ac.tone]}>{ac.state}</Badge>
                {ac.proof ? <a href={ac.proof} target="_blank" rel="noopener noreferrer">{ac.kind === 'e2e' ? 'e2e report' : 'Test'} {ac.id}</a> : <Text as="span" size="small" tone="secondary">no proof yet</Text>}
              </Stack>
            )}
          />
        </li>
      ))}
    </ol>
  );
}

/** The sections of decision `kind`, in reading order. */
function sectionsOf({ kind, approval, ready, pinned, plan, planMarkdown, dossier }: ReviewPageProps): ReviewSection[] {
  if (kind === 'feature') {
    return ready ? [{ title: 'Ready checks', children: <><Text size="small" tone="secondary">Judged by {ready.sign}</Text><ReadyChecks ready={ready} /></> }, { title: 'Proof of each criterion', children: <Criteria ready={ready} /> }] : [];
  }
  const screen = screenOf(kind, approval);
  if (kind === 'tech') {
    return [
      { title: 'The plan', children: <PlanSection markdown={planMarkdown} /> },
      { title: 'What changed', children: <WhatChanged screen={screen} first="No Tech Approval given before." /> },
      { title: 'Business laws', children: <Laws approval={approval} note="A red verdict never holds this." /> },
    ];
  }
  return [
    { title: 'What changed', children: <WhatChanged screen={screen} first="Its first approval: nothing to compare." /> },
    { title: 'Business laws', children: <Laws approval={approval} /> },
    { title: 'What you approve', children: <WhatYouApprove screen={screen} plan={plan} pinned={pinned} id={dossier.id} /> },
  ];
}

/** The one decision of `kind`: Approve, Give Tech Approval, or Merge on GitHub. */
function decisionOf({ kind, approval, ready, dossier }: ReviewPageProps): ReactNode {
  const page = dossierPath(dossier.id);
  if (kind === 'feature') {
    const href = ready?.foot.action?.href;
    return href ? <Button variant="primary" href={href} external>Merge on GitHub</Button> : null;
  }
  if (kind === 'tech') return <GiveTechApprovalButton dossier={dossier.id} returnTo={page} look="review" />;
  return <ApproveButton dossier={dossier.id} off={approval ? approveOff(approval) : null} returnTo={page} look="review" />;
}

export function ReviewPage(props: ReviewPageProps) {
  const { kind, dossier, approval, ready, me } = props;
  const words = reviewWords(kind, { approval, ready, me });
  return (
    <section className="dossier-review" aria-label={words.title} data-screen="prd-review">
      <ReviewScreen
        eyebrow={`${dossier.label} · ${dossier.title}`}
        title={words.title}
        {...(words.lede === '' ? {} : { lede: words.lede })}
        sections={sectionsOf(props)}
        stepsLabel="Review steps"
        question={words.question}
        detail={words.detail}
        secondary={<Button variant="secondary" href={dossierPath(dossier.id)}>Back to the PRD</Button>}
        decision={decisionOf(props)}
      />
    </section>
  );
}
