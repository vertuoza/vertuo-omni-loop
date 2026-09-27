import { OutboxTab } from '../../outbox/OutboxTab';
import type { DossierKind } from '../store';
import type { RenderedMarkdown } from '../markdown';
import { CopyLink } from './CopyLink';
import { DeleteDraft } from './DeleteDraft';
import { QuestionsPane } from './QuestionsPane';
import { FRAME_SANDBOX } from './sandbox';
import { VersionPicker } from './VersionPicker';
import { dossierPath, TAB_LABELS, type DossierView } from './view';

// /prd/<id>, the page to share (PRD 216's spec, "The pages"): the header — PRD #n or DRAFT, the title,
// the repository chips, who opened it and when, Copy link, and Delete draft for its opener — then a tab
// per artifact and the Questions tab. Before/after frames the version shown on its sandboxed route;
// Spec and Plan show it rendered from markdown, raw HTML off, the front matter as a line above. Each
// artifact tab with a version has its version picker; one with none says so. Questions lists the rounds
// that shaped it, and its label counts those answered out of those asked. Rendered on the server: the
// tabs and the picker are links and a GET form, so it all works before any script runs.
// The Outbox tab (PRD 251) is src/outbox/OutboxTab.tsx: its questions, and the context rail beside them.

type Props = {
  view: DossierView;
  /** The shown version of the Spec or Plan, rendered — on the Outbox tab, the latest spec when its rail
   * shows Spec; null on Before/after, or when it could not be read. */
  markdown: RenderedMarkdown | null;
  /** Why the Outbox tab's Send is off, or null when it may send. */
  sendOff?: string | null;
  /** Where the browser deletes a draft from; null when this deployment has no database (the demo). */
  supabase: { url: string; key: string } | null;
};

const EMPTY: Record<DossierKind, string> = {
  'before-after': 'The before/after page has no version yet.',
  spec: 'The spec has no version yet.',
  plan: 'The plan has no version yet.',
};

function Pane({ view, markdown, sendOff = null }: Pick<Props, 'view' | 'markdown' | 'sendOff'>) {
  const { shown, tab } = view;
  if (tab === 'questions') return <QuestionsPane questions={view.questions} />;
  if (tab === 'outbox') return view.outbox ? <OutboxTab id={view.id} pane={view.outbox} spec={markdown} sendOff={sendOff} /> : null;
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

export function DossierPage({ view, markdown, supabase, sendOff }: Props) {
  return (
    <div className="dossier">
      <header className="dossier-head">
        <h1 className="dossier-title">
          {view.draft ? <span className="dossier-draft">DRAFT</span> : <span className="dossier-number">{view.heading}</span>}{' '}
          <span>{view.title}</span>
        </h1>
        <div className="dossier-meta">
          <ul className="dossier-repos" aria-label="Repositories">
            {view.repos.map((repo) => <li key={repo} className="dossier-repo">{repo}</li>)}
          </ul>
          <span className="ask-hint">{view.opened}</span>
          <span className="dossier-actions">
            <CopyLink path={view.link} />
            {view.canDelete && supabase && <DeleteDraft supabase={supabase} id={view.id} />}
          </span>
        </div>
      </header>
      <nav className="dossier-tabs" aria-label="Artifacts">
        {view.tabs.map((t) => (
          <a key={t.kind} className="dossier-tab" href={t.href} aria-current={t.current ? 'page' : undefined}>
            {t.label}
            {t.badge !== null && <small>{t.badge}</small>}
          </a>
        ))}
      </nav>
      <section className="dossier-pane" aria-label={TAB_LABELS[view.tab]}>
        <Pane view={view} markdown={markdown} sendOff={sendOff} />
      </section>
    </div>
  );
}
