import Link from 'next/link';
import type { ReactNode } from 'react';
import { SortableList } from '../nav/SortableList';
import type { Query } from '../nav/query';
import {
  DOMAIN_COLUMNS, GLOSSARY_COLUMNS, LEGAL_COLUMNS, NO_DOMAINS, NO_LEGAL, NO_TERMS, NONE, activeDomains, backHref, dayOf, domainFilterOf, domainHref, domainSortOf, excerpt,
  glossarySortOf, itemHref, legalSortOf, sectionHref, showHref, showOf, shownEntries, termsOfDomain, whoOf, type ListSection, type Show,
} from './knowledge-sections';
import { AddEntry, SectionTop, type TabSource } from './KnowledgeTabPage';
import type { DomainEntry, GlossaryEntry, KnowledgeTab, LegalEntry } from './product-knowledge.contract';

// The Legal, Glossary and Domains lists of the Knowledge home, drawn on the server (PRD 2240 s3, PRD 2583 s1): a SortableList
// whose every header sorts through the address, the first cell of a row opening the entry's page, the
// `Active · n` and `Retired · n` filters above it, who answers for the kind and the open proposals above
// that, the add form under it. Only the controls are client components (KnowledgeTabPage.tsx).

export interface ListProps {
  tab: KnowledgeTab;
  source: TabSource;
  query: Query;
}

export function Filters({ path, query, active, retired }: { path: string; query: Query; active: number; retired: number }) {
  const show = showOf(query);
  const link = (to: Show, label: string, n: number) => (
    <Link href={showHref(path, query, to)} aria-current={show === to ? 'true' : undefined}>{label} · {n}</Link>
  );
  return (
    <nav className="kn-filters" aria-label="Show">
      {link('active', 'Active', active)}
      {link('retired', 'Retired', retired)}
    </nav>
  );
}

export const Cell = ({ children, full }: { children: string; full?: string }) => <td className="kn-text" title={full ?? children}>{children}</td>;

export function Section({ id, title, lede, children }: { id: string; title: string; lede: string; children: ReactNode }) {
  return (
    <section className="ask-card products-section" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <p className="ask-muted">{lede}</p>
      {children}
    </section>
  );
}

export function LegalList({ tab, source, query }: ListProps) {
  const { legal, product } = tab;
  const path = sectionHref(product.id, 'legal');
  const show = showOf(query);
  const rows = shownEntries(legal.entries, show);
  return (
    <Section id="legal-title" title="Legal" lede="What the law requires of this product. Every repository of the product reads the same entries.">
      <SectionTop product={product.id} source={source} kind="legal" section={legal} members={tab.members} canName={tab.canName} />
      <Filters path={path} query={query} active={shownEntries(legal.entries, 'active').length} retired={shownEntries(legal.entries, 'retired').length} />
      {rows.length === 0 ? <p className="products-empty">{show === 'retired' ? 'No retired Legal entry.' : NO_LEGAL}</p> : (
        <div className="kn-scroll">
          <SortableList
            classes="kn" columns={LEGAL_COLUMNS} rows={rows} sort={legalSortOf(query)} path={path} query={query} rowKey={(e: LegalEntry) => e.entry}
            row={(e: LegalEntry) => (
              <tr data-entry={e.id}>
                <th scope="row"><Link href={backHref(itemHref(product.id, 'legal', e.id), query)}>{e.id}</Link></th>
                <Cell full={e.statement}>{excerpt(e.statement)}</Cell>
                <Cell full={e.source}>{excerpt(e.source, 50)}</Cell>
                <td>{whoOf(e.owner)}</td>
                <td>{whoOf(e.createdBy)}</td>
                <td>{dayOf(e.createdAt)}</td>
              </tr>
            )}
          />
        </div>
      )}
      <AddEntry product={product.id} source={source} kind="legal" decides={legal.decides} />
    </Section>
  );
}

const LISTS: Readonly<Record<ListSection, (props: ListProps) => ReactNode>> = { legal: LegalList, glossary: GlossaryList, domains: DomainList };

/** The list a section draws. */
export function KnowledgeList({ section, ...props }: ListProps & { section: ListSection }) {
  const List = LISTS[section];
  return <List {...props} />;
}

/** The product's one list of domains (PRD 2583 s1): each key opening its page; retired ones behind their filter, never deleted. */
export function DomainList({ tab, source, query }: ListProps) {
  const { domains, product } = tab;
  const path = sectionHref(product.id, 'domains');
  const show = showOf(query);
  const rows = shownEntries(domains.entries, show);
  return (
    <Section id="domains-title" title="Domains" lede="The parts the product is cut into. Every repository of the product names them with these keys.">
      <SectionTop product={product.id} source={source} kind="domains" section={domains} members={tab.members} canName={tab.canName} />
      <Filters path={path} query={query} active={shownEntries(domains.entries, 'active').length} retired={shownEntries(domains.entries, 'retired').length} />
      {rows.length === 0 ? <p className="products-empty">{show === 'retired' ? 'No retired domain.' : NO_DOMAINS}</p> : (
        <div className="kn-scroll">
          <SortableList
            classes="kn" columns={DOMAIN_COLUMNS} rows={rows} sort={domainSortOf(query)} path={path} query={query} rowKey={(e: DomainEntry) => e.entry}
            row={(e: DomainEntry) => (
              <tr data-entry={e.key}>
                <th scope="row"><Link href={backHref(itemHref(product.id, 'domains', e.key), query)}>{e.key}</Link></th>
                <Cell full={e.name}>{excerpt(e.name, 50)}</Cell>
                <Cell full={e.meaning}>{excerpt(e.meaning)}</Cell>
                <td>{whoOf(e.createdBy)}</td>
                <td>{dayOf(e.createdAt)}</td>
              </tr>
            )}
          />
        </div>
      )}
      <AddEntry product={product.id} source={source} kind="domains" decides={domains.decides} />
    </Section>
  );
}

/** A term's domains as links that filter the list by each; one left behind by a retired domain says so. */
function TermDomains({ entry, tab, path, query }: { entry: GlossaryEntry; tab: KnowledgeTab; path: string; query: Query }) {
  if (entry.domains.length === 0) return <td className="kn-text">{NONE}</td>;
  const retired = new Set(tab.domains.entries.filter((d) => d.retiredAt !== null).map((d) => d.key));
  return (
    <td className="kn-text" data-domains>
      {entry.domains.map((key, i) => (
        <span key={key}>
          {i > 0 && ', '}
          <Link href={domainHref(path, query, key)}>{key}</Link>
          {retired.has(key) && <span className="ask-muted"> (retired)</span>}
        </span>
      ))}
    </td>
  );
}

export function GlossaryList({ tab, source, query }: ListProps) {
  const { glossary, product } = tab;
  const path = sectionHref(product.id, 'glossary');
  const show = showOf(query);
  const domain = domainFilterOf(query);
  const named = termsOfDomain(glossary.entries, domain);
  const rows = shownEntries(named, show);
  return (
    <Section id="glossary-title" title="Glossary" lede="The product’s words, the domains they belong to, and the words to avoid in their place.">
      <SectionTop product={product.id} source={source} kind="glossary" section={glossary} members={tab.members} canName={tab.canName} />
      {domain !== null && (
        <p className="ask-muted" data-domain-filter={domain}>
          Terms naming {domain} · <Link href={domainHref(path, query, null)}>All domains</Link>
        </p>
      )}
      <Filters path={path} query={query} active={shownEntries(named, 'active').length} retired={shownEntries(named, 'retired').length} />
      {rows.length === 0 ? <p className="products-empty">{show === 'retired' ? 'No removed term.' : domain === null ? NO_TERMS : `No term names ${domain}.`}</p> : (
        <div className="kn-scroll">
          <SortableList
            classes="kn" columns={GLOSSARY_COLUMNS} rows={rows} sort={glossarySortOf(query)} path={path} query={query} rowKey={(e: GlossaryEntry) => e.entry}
            row={(e: GlossaryEntry) => (
              <tr data-entry={e.term}>
                <th scope="row"><Link href={backHref(itemHref(product.id, 'glossary', e.entry), query)}>{e.term}</Link></th>
                <Cell full={e.meaning}>{excerpt(e.meaning)}</Cell>
                <TermDomains entry={e} tab={tab} path={path} query={query} />
                <td>{whoOf(e.createdBy)}</td>
                <td>{dayOf(e.createdAt)}</td>
              </tr>
            )}
          />
        </div>
      )}
      <AddEntry product={product.id} source={source} kind="glossary" decides={glossary.decides} domains={activeDomains(tab)} />
    </Section>
  );
}
