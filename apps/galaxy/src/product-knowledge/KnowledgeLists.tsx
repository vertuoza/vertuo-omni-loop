import Link from 'next/link';
import type { ReactNode } from 'react';
import { SortableList } from '../nav/SortableList';
import type { Query } from '../nav/query';
import {
  GLOSSARY_COLUMNS, LEGAL_COLUMNS, NO_LEGAL, NO_TERMS, backHref, dayOf, excerpt, glossarySortOf, itemHref, legalSortOf, sectionHref, showHref, showOf,
  shownEntries, whoOf, type Show,
} from './knowledge-sections';
import { AddEntry, SectionTop, type TabSource } from './KnowledgeTabPage';
import type { GlossaryEntry, KnowledgeTab, LegalEntry } from './product-knowledge.contract';

// The Legal and Glossary lists of the Knowledge home, drawn on the server (PRD 2240 s3): a SortableList
// whose every header sorts through the address, the first cell of a row opening the entry's page, the
// `Active · n` and `Retired · n` filters above it, who answers for the kind and the open proposals above
// that, the add form under it. Only the controls are client components (KnowledgeTabPage.tsx).

export interface ListProps {
  tab: KnowledgeTab;
  source: TabSource;
  query: Query;
}

function Filters({ path, query, active, retired }: { path: string; query: Query; active: number; retired: number }) {
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

const Cell = ({ children, full }: { children: string; full?: string }) => <td className="kn-text" title={full ?? children}>{children}</td>;

function Section({ id, title, lede, children }: { id: string; title: string; lede: string; children: ReactNode }) {
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

/** The list a section draws. */
export function KnowledgeList({ section, ...props }: ListProps & { section: 'legal' | 'glossary' }) {
  return section === 'legal' ? <LegalList {...props} /> : <GlossaryList {...props} />;
}

export function GlossaryList({ tab, source, query }: ListProps) {
  const { glossary, product } = tab;
  const path = sectionHref(product.id, 'glossary');
  const show = showOf(query);
  const rows = shownEntries(glossary.entries, show);
  return (
    <Section id="glossary-title" title="Glossary" lede="The product’s words, and the words to avoid in their place.">
      <SectionTop product={product.id} source={source} kind="glossary" section={glossary} members={tab.members} canName={tab.canName} />
      <Filters path={path} query={query} active={shownEntries(glossary.entries, 'active').length} retired={shownEntries(glossary.entries, 'retired').length} />
      {rows.length === 0 ? <p className="products-empty">{show === 'retired' ? 'No removed term.' : NO_TERMS}</p> : (
        <div className="kn-scroll">
          <SortableList
            classes="kn" columns={GLOSSARY_COLUMNS} rows={rows} sort={glossarySortOf(query)} path={path} query={query} rowKey={(e: GlossaryEntry) => e.entry}
            row={(e: GlossaryEntry) => (
              <tr data-entry={e.term}>
                <th scope="row"><Link href={backHref(itemHref(product.id, 'glossary', e.entry), query)}>{e.term}</Link></th>
                <Cell full={e.meaning}>{excerpt(e.meaning)}</Cell>
                <td>{whoOf(e.createdBy)}</td>
                <td>{dayOf(e.createdAt)}</td>
              </tr>
            )}
          />
        </div>
      )}
      <AddEntry product={product.id} source={source} kind="glossary" decides={glossary.decides} />
    </Section>
  );
}
