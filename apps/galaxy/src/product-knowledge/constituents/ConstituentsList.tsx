import Link from 'next/link';
import type { ReactNode } from 'react';
import { SortableList } from '../../nav/SortableList';
import type { Query } from '../../nav/query';
import { backHref, dayOf, excerpt, itemHref, sectionHref, showOf, whoOf } from '../knowledge-sections';
import { CONSTITUENT_COLUMNS, constituentSortOf, shownRows, type ConstituentRow } from './constituents-section';
import { Cell, Filters, Section } from '../KnowledgeLists';

// The Constituents section of the Knowledge home, drawn on the server (PRD 2240 s4): /knowledge/constituents
// is a SortableList of the product's Statement and Never lines, the first cell of a row opening the line's
// page, the `Active · n` and `Retired · n` filters above it and the add form under it; and
// /knowledge/constituents/<statement | never-n> is one line whole, with the panel's edit, remove and
// history. Only the controls are client components (ConstituentsClient.tsx).

const NO_CONSTITUENTS = 'No Statement or Never line yet.';
export const LEDE = 'What this product is, and what it must never become. Every agent reads them first, above any priority.';

/** The list: its filters, its sortable table and what draws under it (the add form). */
export function ConstituentsTable({ product, rows: all, query, add }: { product: string; rows: readonly ConstituentRow[]; query: Query; add: ReactNode }) {
  const path = sectionHref(product, 'constituents');
  const show = showOf(query);
  const rows = shownRows(all, show);
  return (
    <Section id="constituents-title" title="Constituents" lede={LEDE}>
      <Filters path={path} query={query} active={shownRows(all, 'active').length} retired={shownRows(all, 'retired').length} />
      {rows.length === 0 ? <p className="products-empty">{show === 'retired' ? 'No removed line.' : NO_CONSTITUENTS}</p> : (
        <div className="kn-scroll">
          <SortableList
            classes="kn" columns={CONSTITUENT_COLUMNS} rows={rows} sort={constituentSortOf(query)} path={path} query={query} rowKey={(r: ConstituentRow) => r.id}
            row={(r: ConstituentRow) => (
              <tr data-constituent={r.key}>
                <th scope="row"><Link href={backHref(itemHref(product, 'constituents', r.key), query)}>{r.kind}</Link></th>
                <Cell full={r.text}>{excerpt(r.text)}</Cell>
                <td>{whoOf(r.by)}</td>
                <td>{dayOf(r.createdAt)}</td>
                <td>{dayOf(r.updatedAt)}</td>
              </tr>
            )}
          />
        </div>
      )}
      {add}
    </Section>
  );
}


/** One line, read whole: who made it and when, then `controls` (the panel's edit, remove and history). */
export function ConstituentView({ row, back, controls }: { row: ConstituentRow; back: string; controls: ReactNode }) {
  return (
    <section className="ask-card products-section" aria-labelledby="constituent-title">
      <p><Link className="products-back" href={back}>← Constituents</Link></p>
      <h2 id="constituent-title">{row.kind === 'Statement' ? 'Statement' : `Never · ${row.key}`}{row.removed && <span className="ask-muted kn-status"> · removed {dayOf(row.removedAt)}</span>}</h2>
      <dl className="kn-fields">
        <dt>Created by</dt><dd>{whoOf(row.by)}</dd>
        <dt>Created</dt><dd>{dayOf(row.createdAt)}</dd>
        <dt>Updated</dt><dd>{dayOf(row.updatedAt)}</dd>
      </dl>
      {controls}
    </section>
  );
}

