import type { ReactNode } from 'react';
import { FixStatePill, TimelinePane } from '../../fixes/TimelinePane';
import type { ArtifactKind } from '../store';
import type { RenderedMarkdown } from '../markdown';
import { CopyLink } from './CopyLink';
import { DeleteDraft } from './DeleteDraft';
import { MarkSeen } from './MarkSeen';
import { OutboxPane } from './OutboxPane';
import { QuestionsPane } from './QuestionsPane';
import { RetroPane } from './RetroPane';
import { seenSignature } from './seen';
import { FRAME_SANDBOX } from './sandbox';
import { PinnedHead } from './PinnedHead';
import { DossierTitle, StageAction, StageLinks, StageTrack } from './StageHeader';
import { VersionPicker } from './VersionPicker';
import { TAB_LABELS, type DossierView } from './view';

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
// (RetroPane.tsx) renders the retro once written; empty, each reads muted.
// PRD 579: opening the page marks its PRD seen in this browser (MarkSeen.tsx), and so does each new
// version it renders while open, so the bell's New documents group drops it.
// PRD 627: a fix's page is this page on its own route, `#n ↗` with its Visual or Bug badge, no stage,
// and its kind's tabs: Variations frames the round picked, chosen as Round k; Bug record is markdown.
// PRD 627, s5: a fix's page opens on its Timeline (fixes/Timeline.tsx), and its facts strip carries its
// State pill (Asked, In review, Merged, or `—`) and, On GitHub, its issue and its fix PR.

type Props = {
  view: DossierView;
  /** The shown version of the Spec or Plan, rendered; null on Before/after, or when it could not be read. */
  markdown: RenderedMarkdown | null;
  /** Where the browser deletes a draft from; null when this deployment has no database (the demo). */
  supabase: { url: string; key: string } | null;
  /** The change check (PRD 384), shown below the tabs; none in the demo. */
  live?: ReactNode;
};

const EMPTY: Record<ArtifactKind, string> = {
  'before-after': 'The before/after page has no version yet.',
  spec: 'The spec has no version yet.',
  plan: 'The plan has no version yet.',
  variations: 'No round of variations yet.',
  'bug-record': 'The bug record has no version yet.',
};

type PaneProps = Pick<Props, 'view' | 'markdown' | 'supabase'>;
type Shown = NonNullable<DossierView['shown']>;

function Pane({ view, markdown, supabase }: PaneProps) {
  const { shown, tab } = view;
  if (tab === 'questions') return <QuestionsPane questions={view.questions} supabase={supabase} />;
  if (tab === 'outbox') return <OutboxPane dossierId={view.id} outbox={view.outbox} spec={markdown} />;
  if (tab === 'retro') return <RetroPane retro={view.retro} />;
  if (tab === 'timeline') return <TimelinePane fix={view.fix} />;
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

export function DossierPage({ view, markdown, supabase, live }: Props) {
  const { stage, fix } = view;
  return (
    <div className="dossier">
      <PinnedHead>
        <div className="dossier-head-top">
          <DossierTitle heading={view.heading} draft={view.draft} title={view.title} issueUrl={view.issueUrl} badge={view.badge} />
          <div className="dossier-actions">
            <StageAction stage={stage} />
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
          {stage && stage.links.length > 0 && (
            <div className="dossier-fact">
              <dt>On GitHub</dt>
              <dd><StageLinks links={stage.links} /></dd>
            </div>
          )}
          <div className="dossier-fact">
            <dt>Opened</dt>
            <dd className="ask-hint">{view.opened}</dd>
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
      <MarkSeen id={view.id} signature={seenSignature(view.tabs)} />
      {live}
      <section className="dossier-pane" aria-label={TAB_LABELS[view.tab]}>
        <Pane view={view} markdown={markdown} supabase={supabase} />
      </section>
    </div>
  );
}
