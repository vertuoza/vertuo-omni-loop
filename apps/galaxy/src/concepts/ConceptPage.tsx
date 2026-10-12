import { Notice } from '../ask/page/Notice';
import { CopyLink } from '../dossier/page/CopyLink';
import { DossierSignIn } from '../dossier/page/DossierSignIn';
import { PinnedHead } from '../dossier/page/PinnedHead';
import { FRAME_SANDBOX } from '../dossier/page/sandbox';
import { dossierCallbackPath } from '../dossier/page/sign-in';
import { DossierTitle } from '../dossier/page/StageHeader';
import { StageHeaderCopy } from '../dossier/page/StageHeaderCopy';
import type { AreaView } from './areas';
import type { ConceptPageState } from './ConceptPage.read';
import { CONCEPT_TAB_LABELS, NOT_SENT, type ConceptPageView, type ConceptPane } from './ConceptPage.view';
import { ConceptStateChip } from './state-chip';

// /concepts/<id> (PRD 1272, s3), laid out as a dossier's page: the header box — the Concept badge, `#n ↗`
// linking to its issue, the title, Copy link, its state chip (s4), and On GitHub, its issue and its concept PR — then the
// tabs, Overview, Areas, Vision tour, Boards and Debate (./ConceptPage.view.ts). Overview and Debate are
// Markdown rendered with raw HTML off; Areas lists the areas, the wedge marked, each PRD a link, and the
// first area without a PRD its brainstorm line with a Copy button. Vision tour and Boards frame their page
// from its sandboxed route, never inline: scripts run in an anonymous origin with no cookies and no
// network. A tab whose file was not sent reads "not sent: too large". Rendered on the server: the tabs and
// the round picker are links, so it all works before any script runs.

function AreaRow({ area }: { area: AreaView }) {
  return (
    <li className={area.wedge ? 'concept-area concept-wedge' : 'concept-area'}>
      <p>
        <strong>{area.area}</strong>{' '}
        <code className="ask-hint">{area.id}</code>
        {area.wedge && <>{' '}<span className="dossier-kind">wedge</span></>}
      </p>
      <p className="ask-muted">{area.brief}</p>
      {area.prd && (
        <p>
          <a href={area.prd.href} {...(area.prd.to === 'issue' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            PRD #{area.prd.number}{area.prd.to === 'issue' ? ' ↗' : ''}
          </a>
        </p>
      )}
      {area.next && <StageHeaderCopy label="Copy" command={area.next} />}
    </li>
  );
}

function Pane({ pane }: { pane: ConceptPane }) {
  switch (pane.kind) {
    case 'not-sent':
      return <p className="dossier-empty">{pane.words}</p>;
    case 'unread':
      return <p className="ask-problem" role="alert">{pane.words}</p>;
    case 'overview':
      return (
        <article className="dossier-md">
          {pane.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              <div dangerouslySetInnerHTML={{ __html: section.html }} />
            </section>
          ))}
        </article>
      );
    case 'areas':
      return <ol className="concept-areas" aria-label="Areas, in build order">{pane.areas.map((area) => <AreaRow key={area.id} area={area} />)}</ol>;
    case 'frame':
      return (
        <>
          {pane.rounds && (
            <nav className="dossier-tabs" aria-label="Rounds">
              {pane.rounds.map((round) => (
                <a key={round.number} className="dossier-tab" href={round.href} aria-current={round.current ? 'page' : undefined}>{round.label}</a>
              ))}
            </nav>
          )}
          <figure className="dossier-frame">
            <figcaption className="ask-hint">
              sandboxed · no cookies · no network ·{' '}
              <a href={pane.src} target="_blank" rel="noopener noreferrer">open on its own</a>
            </figcaption>
            <iframe src={pane.src} sandbox={FRAME_SANDBOX} title={pane.title} />
          </figure>
        </>
      );
    case 'markdown':
      return <article className="dossier-md" dangerouslySetInnerHTML={{ __html: pane.html }} />;
  }
}

export function ConceptPage({ view }: { view: ConceptPageView }) {
  return (
    <div className="dossier">
      <PinnedHead>
        <div className="dossier-head-top">
          <DossierTitle heading={view.heading ?? ''} draft={false} title={view.title} issueUrl={view.issueUrl} badge={view.badge} />
          <div className="dossier-actions">
            <CopyLink path={view.link} />
          </div>
        </div>
        <dl className="dossier-facts">
          <div className="dossier-fact">
            <dt>State</dt>
            <dd><ConceptStateChip state={view.state} /></dd>
          </div>
          {view.links.length > 0 && (
            <div className="dossier-fact">
              <dt>On GitHub</dt>
              <dd>
                <ul className="stage-links" aria-label="On GitHub">
                  {view.links.map((link) => (
                    <li key={link.label}><a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a></li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>
        <nav className="dossier-tabs" aria-label="Concept">
          {view.tabs.map((t) => (
            <a key={t.kind} className={t.notSent ? 'dossier-tab dossier-tab-empty' : 'dossier-tab'} href={t.href} aria-current={t.current ? 'page' : undefined}>
              {t.label}
              {t.notSent && <small>{NOT_SENT}</small>}
            </a>
          ))}
        </nav>
      </PinnedHead>
      <section className="dossier-pane" aria-label={CONCEPT_TAB_LABELS[view.tab]}>
        <Pane pane={view.pane} />
      </section>
    </div>
  );
}

/** /concepts/<id> in each of its states but not found, which the route answers with its not-found page.
 * Signed out, the dossier's sign-in comes back through /prd/<id>/callback, whose page sends a concept on
 * to /concepts/<id>. */
export function ConceptPageScreen({ state, id, supabase, error = null }: {
  state: Exclude<ConceptPageState, { kind: 'not-found' }>; id: string; supabase: { url: string; key: string } | null; error?: string | null;
}) {
  if (state.kind === 'page') return <ConceptPage view={state.view} />;
  if (state.kind === 'signed-out' && supabase) return <DossierSignIn supabase={supabase} returnPath={dossierCallbackPath(id)} error={error} />;
  if (state.kind === 'down') {
    return (
      <Notice title="The dossier database could not answer" tone="error">
        <p className="ask-muted">Reload the page in a moment.</p>
      </Notice>
    );
  }
  return (
    <Notice title="Concepts are not open here">
      <p className="ask-muted">This deployment has no database, so it keeps no dossier.</p>
    </Notice>
  );
}

