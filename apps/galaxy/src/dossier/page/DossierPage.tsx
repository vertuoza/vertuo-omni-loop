import type { ReactNode } from 'react';
import { PersonChip } from '../../people/PersonChip';
import { FixStatePill, TimelinePane } from '../../fixes/TimelinePane';
import type { ArtifactKind } from '../store';
import type { RenderedMarkdown } from '../markdown';
import type { ApprovalView, ApproveScreen } from './approval';
import { ApproveButton } from './ApproveButton';
import { CarePane } from './CarePane';
import { CopyLink } from './CopyLink';
import { DeleteDraft } from './DeleteDraft';
import { MarkSeen } from './MarkSeen';
import { OutboxPane } from './OutboxPane';
import { QuestionsPane } from './QuestionsPane';
import { RetroPane } from './RetroPane';
import { seenSignature } from './seen';
import { FRAME_SANDBOX } from './sandbox';
import { PinnedHead } from './PinnedHead';
import { PitchPane } from './PitchPane';
import { ProofPane } from './ProofPane';
import { DossierTitle, StageAction, StageLinks, StageTrack } from './StageHeader';
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
};

const EMPTY: Record<ArtifactKind, string> = {
  'before-after': 'The before/after page has no version yet.',
  spec: 'The spec has no version yet.',
  plan: 'The plan has no version yet.',
  variations: 'No round of variations yet.',
  'bug-record': 'The bug record has no version yet.',
  voice: VOICE_EMPTY,
};

type PaneProps = Pick<Props, 'view' | 'markdown' | 'supabase' | 'voice'>;
type Shown = NonNullable<DossierView['shown']>;

/** The User voice tab (PRD 822): its picker and the shown version drawn, or the spec's empty line. */
function VoiceTab({ view, voice = null }: PaneProps) {
  const { shown } = view;
  if (!shown) return <p className="dossier-empty">{VOICE_EMPTY}.</p>;
  return (
    <>
      <VersionPicker action={view.link} tab="voice" versions={view.versions} shown={shown.number} noun="Version" />
      <VoicePane view={voice} rework={view.rework} />
    </>
  );
}

/** The tabs drawn by a pane of their own, not as an artifact's versions. */
const OWN_PANES: Partial<Record<DossierView['tab'], (props: PaneProps) => ReactNode>> = {
  questions: ({ view, supabase }) => <QuestionsPane questions={view.questions} supabase={supabase} />,
  outbox: ({ view, markdown }) => <OutboxPane dossierId={view.id} outbox={view.outbox} spec={markdown} />,
  care: ({ view }) => <CarePane care={view.care} />,
  retro: ({ view }) => <RetroPane retro={view.retro} />,
  timeline: ({ view }) => <TimelinePane fix={view.fix} />,
  proof: ({ view }) => <ProofPane proof={view.proof} action={view.link} />,
  pitch: ({ view }) => <PitchPane pitch={view.pitch} action={view.link} />,
  voice: VoiceTab,
};

function Pane(props: PaneProps) {
  const { view, markdown } = props;
  const { shown, tab } = view;
  const own = OWN_PANES[tab];
  if (own) return own(props);
  if (!isArtifactTab(tab)) return null;
  if (!shown) {
    return (
      <p className="dossier-empty">
        {EMPTY[tab]} It shows here once it is pushed, or once the page reads it from the repository.
      </p>
    );
  }
  return <ArtifactPane view={view} tab={tab} shown={shown} markdown={markdown} />;
}

/** The shown version of an artifact tab under its picker: framed, or rendered from markdown. */
function ArtifactPane({ view, tab, shown, markdown }: { view: DossierView; tab: ArtifactKind; shown: Shown; markdown: RenderedMarkdown | null }) {
  const round = tab === 'variations';
  const picker = <VersionPicker action={view.link} tab={tab} versions={view.versions} shown={shown.number} noun={round ? 'Round' : 'Version'} />;
  if (shown.frame) {
    return (
      <>
        {picker}
        <figure className="dossier-frame">
          <figcaption className="ask-hint">
            sandboxed · no cookies · no network ·{' '}
            <a href={shown.frame} target="_blank" rel="noopener noreferrer">open on its own</a>
          </figcaption>
          <iframe src={shown.frame} sandbox={FRAME_SANDBOX} title={`${TAB_LABELS[tab]}, ${round ? `Round ${shown.number}` : `v${shown.number}`}`} />
        </figure>
      </>
    );
  }
  return (
    <>
      {picker}
      <MarkdownVersion markdown={markdown} />
    </>
  );
}

function MarkdownVersion({ markdown }: { markdown: RenderedMarkdown | null }) {
  if (!markdown) return <p className="ask-problem" role="alert">This version could not be read. Reload the page in a moment.</p>;
  return (
    <>
      {markdown.front && <p className="dossier-front">{markdown.front}</p>}
      <article className="dossier-md" dangerouslySetInnerHTML={{ __html: markdown.html }} />
    </>
  );
}

/** A ◆ PRD's Approval cell (PRD 1299 s3): its state, then who approved it and when, or what changed since. */
function ApprovalFact({ approval }: { approval: ApprovalView }) {
  return (
    <div className={`dossier-fact dossier-approval dossier-approval-${approval.state}`}>
      <dt>Approval</dt>
      <dd>
        {approval.state === 'unread' ? <p className="ask-problem" role="alert">{approval.words}</p> : <strong>{approval.words}</strong>}
        {approval.detail && <p className="ask-hint">{approval.detail}</p>}
      </dd>
    </div>
  );
}

const DIFF_CLASS = { '+': 'dossier-diff-add', '-': 'dossier-diff-del', ' ': 'dossier-diff-same', '…': 'dossier-diff-gap' } as const;

/** One changed file's diff since it was approved (PRD 1322 s7). */
function ChangedFile({ diff }: { diff: ApproveScreen['diffs'][number] }) {
  return (
    <div className="dossier-approve-diff">
      <h3>{diff.path}</h3>
      {diff.rows === null
        ? <p className="ask-problem" role="alert">This file’s change could not be read. Reload the page in a moment.</p>
        : (
          <pre className="dossier-diff" aria-label={`Changes to ${diff.path}`}>
            {diff.rows.map((row, at) => (
              <span key={at} className={DIFF_CLASS[row.sign]}>{row.sign === '…' ? '…' : `${row.sign} ${row.text}`}{'\n'}</span>
            ))}
          </pre>
        )}
    </div>
  );
}

/** The approve screen of a ◆ PRD (PRD 1322 s7), for a viewer who may approve it: after a void or a drift,
 * the diff of each changed file first; then the spec's Problem and Solution; then Approve. */
function ApproveScreenSection({ approval }: { approval: ApprovalView }) {
  const { screen } = approval;
  return (
    <section className="dossier-approve-screen" aria-label="Approve">
      {screen && screen.diffs.length > 0 && (
        <div className="dossier-approve-changed">
          <h2>What changed since it was approved</h2>
          {screen.diffs.map((diff) => <ChangedFile key={diff.path} diff={diff} />)}
        </div>
      )}
      {screen?.sections.map((section) => (
        <div key={section.name} className="dossier-approve-section">
          <h2>{section.name}</h2>
          <article className="dossier-md" dangerouslySetInnerHTML={{ __html: section.html }} />
        </div>
      ))}
      {screen?.spec === 'unread' && <p className="ask-problem" role="alert">The spec could not be read. Reload the page in a moment.</p>}
      <ApproveButton dossier={approval.dossier} />
    </section>
  );
}

export function DossierPage({ view, markdown, supabase, live, voice }: Props) {
  const { stage, fix, approval } = view;
  return (
    <div className="dossier">
      <PinnedHead>
        <div className="dossier-head-top">
          <DossierTitle heading={view.heading} draft={view.draft} title={view.title} issueUrl={view.issueUrl} badge={view.badge} />
          <div className="dossier-actions">
            <StageAction stage={stage} demo={view.demo ?? false} />
            <CopyLink path={view.link} />
            {view.canDelete && supabase && <DeleteDraft supabase={supabase} id={view.id} />}
          </div>
        </div>
        <dl className="dossier-facts">
          {stage && (
            <div className="dossier-fact dossier-fact-stage">
              <dt>Stage</dt>
              <dd><StageTrack stage={stage} /></dd>
            </div>
          )}
          {approval && <ApprovalFact approval={approval} />}
          <div className="dossier-fact">
            <dt>{view.repos.length > 1 ? 'Repos' : 'Repo'}</dt>
            <dd>
              <ul className="dossier-repos" aria-label="Repositories">
                {view.repos.map((repo) => <li key={repo} className="dossier-repo">{repo}</li>)}
              </ul>
            </dd>
          </div>
          {fix && (
            <div className="dossier-fact">
              <dt>State</dt>
              <dd><FixStatePill fix={fix} /></dd>
            </div>
          )}
          {fix && fix.links.length > 0 && (
            <div className="dossier-fact">
              <dt>On GitHub</dt>
              <dd><StageLinks links={fix.links} /></dd>
            </div>
          )}
          {stage && (stage.links.length > 0 || view.githubAsOf) && (
            <div className="dossier-fact">
              <dt>On GitHub</dt>
              <dd>
                {stage.links.length > 0 && <StageLinks links={stage.links} />}
                {view.githubAsOf && (
                  <p className="ask-hint github-as-of">
                    {view.githubAsOf}{view.githubResumes && <> · <strong>{view.githubResumes}</strong></>}
                  </p>
                )}
              </dd>
            </div>
          )}
          <div className="dossier-fact">
            <dt>Opened</dt>
            <dd className="ask-hint">
              {view.openedBy ? <>opened by <PersonChip person={view.openedBy} size="inline" /> · {view.openedAt}</> : view.opened}
            </dd>
          </div>
        </dl>
        <nav className="dossier-tabs" aria-label="Artifacts">
          {view.tabs.map((t) => (
            <a key={t.kind} className={t.empty ? 'dossier-tab dossier-tab-empty' : 'dossier-tab'} href={t.href} aria-current={t.current ? 'page' : undefined}>
              {t.label}
              {t.badge !== null && <small>{t.badge}</small>}
              {t.alert !== null && <span className="dossier-left">{t.alert}</span>}
            </a>
          ))}
        </nav>
      </PinnedHead>
      {approval?.canApprove && <ApproveScreenSection approval={approval} />}
      <MarkSeen id={view.id} signature={seenSignature(view.tabs)} />
      {live}
      <section className="dossier-pane" aria-label={TAB_LABELS[view.tab]}>
        <Pane view={view} markdown={markdown} supabase={supabase} voice={voice} />
      </section>
    </div>
  );
}
