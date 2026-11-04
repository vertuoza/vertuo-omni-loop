import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Query } from '../nav/query';
import {
  NONE, SECTIONS, activeDomains, backHref, dayOf, domainOf, itemHref, legalEntryOf, retiredAmong, sectionHref, termOf, termsNaming, whoOf, type ListSection, type SectionKey,
} from './knowledge-sections';
import { DomainLaws } from './BusinessLawsSection';
import type { LawsRead } from './business-laws-section';
import { DomainItemControls, LegalItemControls, TermItemControls, type TabSource } from './KnowledgeTabPage';
import type { DomainEntry, GlossaryEntry, KnowledgeTab, LegalEntry, Person } from './product-knowledge.contract';

// One Legal entry, one term or one domain, read whole (PRD 2240 s3, PRD 2583 s1): /knowledge/legal/<code>,
// /knowledge/glossary/<entry> and /knowledge/domains/<key>. `← Legal` returns to the list with its sort kept; the controls (Edit,
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

const Authored = ({ entry }: { entry: LegalEntry | GlossaryEntry | DomainEntry }) => (
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
      controls={removed ? null : <TermItemControls product={tab.product.id} source={source} entry={entry} decides={tab.glossary.decides} domains={activeDomains(tab)} retired={retiredAmong(tab, entry.domains)} />}
      history={<>{added(entry.createdBy, entry.createdAt)}{changed(entry.createdAt, entry.updatedAt)}{removed && <li className="links-row ask-muted">{`Removed ${dayOf(entry.removedAt)}`}</li>}</>}
    >
      <Field term="Meaning">{entry.meaning}</Field>
      <Field term="Avoid">{entry.avoid.length === 0 ? NONE : entry.avoid.join(', ')}</Field>
      <Field term="Domains">
        {entry.domains.length === 0 ? 'None: a cross-domain term' : entry.domains.map((key, i) => (
          <span key={key}>
            {i > 0 && ', '}
            <Link href={itemHref(tab.product.id, 'domains', key)}>{key}</Link>
            {retiredAmong(tab, [key]).length > 0 && <span className="ask-muted"> (retired)</span>}
          </span>
        ))}
      </Field>
      <Authored entry={entry} />
    </Frame>
  );
}

/** A domain read whole (PRD 2583 s1): /knowledge/domains/<key>. Its key heads the page and never changes; a retired one reads as text. */
export function DomainItem({ tab, source, entry, query, laws }: ItemProps<DomainEntry> & { laws?: LawsRead }) {
  const retired = entry.retiredAt !== null;
  const terms = termsNaming(tab, entry.key);
  return (
    <Frame
      tab={tab} section="domains" query={query} title={entry.key} status={retired ? `retired ${dayOf(entry.retiredAt)}` : null}
      controls={retired ? null : <DomainItemControls product={tab.product.id} source={source} entry={entry} decides={tab.domains.decides} />}
      history={<>{added(entry.createdBy, entry.createdAt)}{changed(entry.createdAt, entry.updatedAt)}{retired && <li className="links-row ask-muted">{`Retired ${dayOf(entry.retiredAt)}`}</li>}</>}
    >
      <Field term="Name">{entry.name}</Field>
      <Field term="Meaning">{entry.meaning}</Field>
      <Field term="Terms">
        {terms.length === 0 ? NONE : terms.map((t, i) => (
          <span key={t.entry}>
            {i > 0 && ', '}
            <Link href={itemHref(tab.product.id, 'glossary', t.entry)}>{t.term}</Link>
          </span>
        ))}
      </Field>
      {laws !== undefined && <Field term="Business laws"><DomainLaws product={tab.product.id} domain={entry.key} read={laws} /></Field>}
      <Authored entry={entry} />
    </Frame>
  );
}

/** The page of a section's entry, by its code, id or key; a domain's page lists its business laws when they were read (PRD 2632 s6). */
export function KnowledgeEntry({ section, item, tab, source, query, laws }: { section: ListSection; item: string; tab: KnowledgeTab; source: TabSource; query: Query; laws?: LawsRead }) {
  if (section === 'legal') {
    const legal = legalEntryOf(tab, item);
    return legal ? <LegalItem tab={tab} source={source} entry={legal} query={query} /> : null;
  }
  if (section === 'domains') {
    const domain = domainOf(tab, item);
    return domain ? <DomainItem tab={tab} source={source} entry={domain} query={query} {...(laws === undefined ? {} : { laws })} /> : null;
  }
  const term = termOf(tab, item);
  return term ? <TermItem tab={tab} source={source} entry={term} query={query} /> : null;
}

const FINDERS: Readonly<Record<ListSection, (tab: KnowledgeTab, item: string) => unknown>> = { legal: legalEntryOf, glossary: termOf, domains: domainOf };

/** Whether the product holds the entry the address names. */
export const entryExists = (tab: KnowledgeTab, section: ListSection, item: string): boolean => FINDERS[section](tab, item) !== null;
