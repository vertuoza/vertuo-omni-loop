import type { ReactNode } from 'react';
import type { DossierKind } from '../store';
import type { RenderedMarkdown } from '../markdown';
import { CopyLink } from './CopyLink';
import { DeleteDraft } from './DeleteDraft';
import { OutboxPane } from './OutboxPane';
import { QuestionsPane } from './QuestionsPane';
import { RetroPane } from './RetroPane';
import { FRAME_SANDBOX } from './sandbox';
import { PinnedHead } from './PinnedHead';
import { DossierTitle, StageAction, StageLinks, StageTrack } from './StageHeader';
import { VersionPicker } from './VersionPicker';
import { dossierPath, TAB_LABELS, type DossierView } from './view';

// /prd/<id>, the page to share (PRD 216's spec, "The pages"): the header — PRD #n or DRAFT, the title,
// the repository chips, who opened it and when, Copy link, and Delete draft for its opener — then a tab
// per artifact and the Questions tab. Before/after frames the version shown on its sandboxed route;
// Spec and Plan show it rendered from markdown, raw HTML off, the front matter as a line above. Each
// artifact tab with a version has its version picker; one with none says so. Questions lists the rounds
// that shaped it, and its label counts those answered out of those asked. Rendered on the server: the
// tabs and the picker are links and a GET form, so it all works before any script runs.
// PRD 426 put the stage on top: "PRD #n ↗" linking to its issue, the track, the one button and the
// links (StageHeader.tsx). PRD 476 gathers the header into one box in three rows: the title with its
// actions (the stage's button, Copy link, Delete draft for a draft's opener), the facts strip (Stage,
// Repo or Repos, On GitHub, Opened; a cell with nothing to show is left out), then the tabs. From
// 900 × 700 px the box is pinned while the page scrolls (PinnedHead.tsx measures it).
// Its Outbox tab (OutboxPane.tsx) is where the decisions taken while it was built are answered, beside
// the spec, the before/after page or the brainstorm (PRD 251, s9), and its Retro tab
// (RetroPane.tsx) renders the retro once written; empty, each reads muted.

type Props = {
  view: DossierView;
  /** The shown version of the Spec or Plan, rendered; null on Before/after, or when it could not be read. */
  markdown: RenderedMarkdown | null;
  /** Where the browser deletes a draft from; null when this deployment has no database (the demo). */
  supabase: { url: string; key: string } | null;
  /** The change check (PRD 384), shown below the tabs; none in the demo. */
  live?: ReactNode;
};

const EMPTY: Record<DossierKind, string> = {
  'before-after': 'The before/after page has no version yet.',
  spec: 'The spec has no version yet.',
  plan: 'The plan has no version yet.',
};

function Pane({ view, markdown, supabase }: Pick<Props, 'view' | 'markdown' | 'supabase'>) {
  const { shown, tab } = view;
  if (tab === 'questions') return <QuestionsPane questions={view.questions} supabase={supabase} />;
  if (tab === 'outbox') return <OutboxPane dossierId={view.id} outbox={view.outbox} spec={markdown} />;
  if (tab === 'retro') return <RetroPane retro={view.retro} />;
  if (!shown) {
    return (
      <p className="dossier-empty">
        {EMPTY[tab]} It shows here once it is pushed, or once the page reads it from the repository.
      </p>
    );
  }
  const picker = <VersionPicker action={dossierPath(view.id)} tab={tab} versions={view.versions} shown={shown.number} />;
  if (shown.frame) {
    return (
      <>
        {picker}
        <figure className="dossier-frame">
          <figcaption className="ask-hint">
            sandboxed · no cookies · no network ·{' '}
            <a href={shown.frame} target="_blank" rel="noopener noreferrer">open on its own</a>
          </figcaption>
          <iframe src={shown.frame} sandbox={FRAME_SANDBOX} title={`${TAB_LABELS[tab]}, v${shown.number}`} />
        </figure>
      </>
    );
  }
  return (
    <>
      {picker}
      {markdown ? (
        <>
          {markdown.front && <p className="dossier-front">{markdown.front}</p>}
          <article className="dossier-md" dangerouslySetInnerHTML={{ __html: markdown.html }} />
        </>
      ) : (
        <p className="ask-problem" role="alert">This version could not be read. Reload the page in a moment.</p>
      )}
    </>
  );
}

export function DossierPage({ view, markdown, supabase, live }: Props) {
  const { stage } = view;
  return (
    <div className="dossier">
      <PinnedHead>
        <div className="dossier-head-top">
          <DossierTitle heading={view.heading} draft={view.draft} title={view.title} issueUrl={view.issueUrl} />
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
            </a>
          ))}
        </nav>
      </PinnedHead>
      {live}
      <section className="dossier-pane" aria-label={TAB_LABELS[view.tab]}>
        <Pane view={view} markdown={markdown} supabase={supabase} />
      </section>
    </div>
  );
}
