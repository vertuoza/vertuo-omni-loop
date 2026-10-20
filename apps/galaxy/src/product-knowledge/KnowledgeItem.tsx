import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Query } from '../nav/query';
import { NONE, SECTIONS, backHref, dayOf, legalEntryOf, sectionHref, termOf, whoOf, type SectionKey } from './knowledge-sections';
import { LegalItemControls, TermItemControls, type TabSource } from './KnowledgeTabPage';
import type { GlossaryEntry, KnowledgeTab, LegalEntry, Person } from './product-knowledge.contract';

// One Legal entry or one term, read whole (PRD 2240 s3): /knowledge/legal/<code> and
// /knowledge/glossary/<entry>. `← Legal` returns to the list with its sort kept; the controls (Edit,
// Retire or Remove, or the proposals) are the ones the reader's role allows and sit beside the id; a
// retired or removed entry reads as text, marked with when it left. Its history is what the database
// keeps of it: who added it and when, and when it last changed.

export interface ItemProps<E> {
  tab: KnowledgeTab;
  source: TabSource;
  entry: E;
  query: Query;
}

function Frame({ tab, section, query, title, status, controls, children, history }: {
  tab: KnowledgeTab; section: SectionKey; query: Query; title: string; status: string | null; controls: ReactNode; children: ReactNode; history: ReactNode;
}) {
  return (
    <section className="ask-card products-section" aria-labelledby="item-title">
      <p><Link className="products-back" href={backHref(sectionHref(tab.product.id, section), query)}>← {SECTIONS[section].label}</Link></p>
      <h2 id="item-title">{title}{status && <span className="ask-muted kn-status"> · {status}</span>}</h2>
      {controls}
      <dl className="kn-fields">{children}</dl>
      <h3>History</h3>
      <ul className="links-list" data-history>{history}</ul>
    </section>
  );
}

const Field = ({ term, children }: { term: string; children: ReactNode }) => (
  <>
    <dt>{term}</dt>
    <dd>{children}</dd>
  </>
);

const Authored = ({ entry }: { entry: LegalEntry | GlossaryEntry }) => (
  <>
    <Field term="Created by">{whoOf(entry.createdBy)}</Field>
    <Field term="Created">{dayOf(entry.createdAt)}</Field>
    <Field term="Updated">{dayOf(entry.updatedAt)}</Field>
  </>
);

const added = (by: Person, at: string) => <li className="links-row ask-muted">{`Added ${dayOf(at)} by ${by ? whoOf(by) : NONE}`}</li>;
const changed = (created: string, updated: string) => (created === updated ? null : <li className="links-row ask-muted">{`Last changed ${dayOf(updated)}`}</li>);

export function LegalItem({ tab, source, entry, query }: ItemProps<LegalEntry>) {
  const retired = entry.retiredAt !== null;
  return (
    <Frame
      tab={tab} section="legal" query={query} title={entry.id} status={retired ? `retired ${dayOf(entry.retiredAt)}` : null}
      controls={retired ? null : <LegalItemControls product={tab.product.id} source={source} entry={entry} decides={tab.legal.decides} />}
      history={<>{added(entry.createdBy, entry.createdAt)}{changed(entry.createdAt, entry.updatedAt)}{retired && <li className="links-row ask-muted">{`Retired ${dayOf(entry.retiredAt)}`}</li>}</>}
    >
      <Field term="Statement">{entry.statement}</Field>
      <Field term="Source law">{entry.source}</Field>
      <Field term="Owner">{whoOf(entry.owner)}</Field>
      <Authored entry={entry} />
    </Frame>
  );
}

export function TermItem({ tab, source, entry, query }: ItemProps<GlossaryEntry>) {
  const removed = entry.removedAt !== null;
  return (
    <Frame
      tab={tab} section="glossary" query={query} title={entry.term} status={removed ? `removed ${dayOf(entry.removedAt)}` : null}
      controls={removed ? null : <TermItemControls product={tab.product.id} source={source} entry={entry} decides={tab.glossary.decides} />}
      history={<>{added(entry.createdBy, entry.createdAt)}{changed(entry.createdAt, entry.updatedAt)}{removed && <li className="links-row ask-muted">{`Removed ${dayOf(entry.removedAt)}`}</li>}</>}
    >
      <Field term="Meaning">{entry.meaning}</Field>
      <Field term="Avoid">{entry.avoid.length === 0 ? NONE : entry.avoid.join(', ')}</Field>
      <Authored entry={entry} />
    </Frame>
  );
}

/** The page of a section's entry, by its code or id. */
export function KnowledgeEntry({ section, item, tab, source, query }: { section: 'legal' | 'glossary'; item: string; tab: KnowledgeTab; source: TabSource; query: Query }) {
  const legal = section === 'legal' ? legalEntryOf(tab, item) : null;
  const term = section === 'glossary' ? termOf(tab, item) : null;
  if (legal) return <LegalItem tab={tab} source={source} entry={legal} query={query} />;
  return term ? <TermItem tab={tab} source={source} entry={term} query={query} /> : null;
}

/** Whether the product holds the entry the address names. */
export const entryExists = (tab: KnowledgeTab, section: 'legal' | 'glossary', item: string): boolean =>
  (section === 'legal' ? legalEntryOf(tab, item) : termOf(tab, item)) !== null;
