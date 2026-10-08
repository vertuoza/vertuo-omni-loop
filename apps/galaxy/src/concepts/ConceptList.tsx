import { Notice } from '../ask/page/Notice';
import { WORK_NAMES, WORK_PATHS } from '../dossier/page/work';
import { ListSkeleton } from '../skeleton/Skeleton';
import type { ConceptCard, ConceptListState } from './list';
import { ConceptStateChip } from './state-chip';

// /concepts (PRD 1272, s2), laid out as the other Work lists: the heading, then one card per concept,
// newest first, each a link to its page. A card shows #n, the title, its kind and scale, its state chip
// (s4: in review, in the inbox or state unknown), how many of its areas have a PRD and the date it was
// recorded. Every title is text: React escapes it. With no
// concept, the page says how to start one.

const THINK_BIG = "/omni:think-big '<your idea>'";

const areasLine = ({ withPrd, total }: { withPrd: number; total: number }) =>
  `${withPrd} of ${total} ${total === 1 ? 'area has' : 'areas have'} a PRD`;

function Card({ card }: { card: ConceptCard }) {
  return (
    <li>
      <a className="dossier-history-row" href={card.href}>
        <span className="dossier-history-title">
          {card.number !== null && <><span className="dossier-number">#{card.number}</span>{' '}</>}
          <span>{card.title}</span>
        </span>
        <span className="dossier-history-facts">
          {card.kind && card.scale && <span className="dossier-history-artifact">{card.kind} · {card.scale}</span>}
          <ConceptStateChip state={card.state} />
          <span className="ask-hint">{card.areas ? areasLine(card.areas) : 'record not readable'}</span>
          <time className="ask-hint" dateTime={card.recordedAt}>recorded {card.recorded}</time>
        </span>
      </a>
    </li>
  );
}

export function ConceptList({ cards }: { cards: readonly ConceptCard[] }) {
  return (
    <div className="dossier dossier-history">
      <h1 className="dossier-title">{WORK_NAMES.concept.many}</h1>
      {cards.length === 0 ? (
        <section className="ask-card">
          <h2>No concept yet</h2>
          <p className="ask-muted">
            A concept shows here once /omni:think-big records it. Start one in Claude Code: <code>{THINK_BIG}</code>
          </p>
        </section>
      ) : (
        <ol className="dossier-history-list" aria-label="Concepts, newest first">
          {cards.map((card) => <Card key={card.id} card={card} />)}
        </ol>
      )}
    </div>
  );
}

/** /concepts in each of its states. Signed out, it points to the PRDs list, whose sign-in brings the
 * person back to the app. */
export function ConceptListScreen({ state }: { state: ConceptListState }) {
  if (state.kind === 'listed') return <ConceptList cards={state.cards} />;
  if (state.kind === 'closed') {
    return (
      <Notice title="Concepts are not open here">
        <p className="ask-muted">This deployment has no database, so it keeps no dossier.</p>
      </Notice>
    );
  }
  if (state.kind === 'signed-out') {
    return (
      <Notice title="Sign in to see your workspace's concepts">
        <p className="ask-muted">
          This page lists every concept of your workspaces. <a href={WORK_PATHS.prd}>Sign in from the PRDs page</a>, then come back here.
        </p>
      </Notice>
    );
  }
  return (
    <Notice title="The dossier database could not answer" tone="error">
      <p className="ask-muted">Reload the page in a moment.</p>
    </Notice>
  );
}

/** What /concepts draws while its page starts: the heading, drawn as the page draws it, then the rows. */
export function ConceptListLoading() {
  return (
    <div className="dossier dossier-history">
      <h1 className="dossier-title">{WORK_NAMES.concept.many}</h1>
      <ListSkeleton what="the concepts" />
    </div>
  );
}
