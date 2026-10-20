import Link from 'next/link';
import type { ReactNode } from 'react';
import { SortableList } from '../../nav/SortableList';
import type { Query } from '../../nav/query';
import { tradeLabel } from '../../business/personas';
import { Cell, Section } from '../KnowledgeLists';
import { backHref, dayOf, excerpt, itemHref, sectionHref, whoOf } from '../knowledge-sections';
import { PERSONA_LIST_COLUMNS, personaSortOf, type PersonaRow } from './personas-section';

// The Personas section of the Knowledge home, drawn on the server (PRD 2240 s4): /knowledge/personas is a
// SortableList of the product's personas, the first cell of a row opening the persona's page, the add
// button under it; /knowledge/personas/<id> is one persona whole, with its edit drawer and delete. Only
// the controls are client components (PersonasClient.tsx).

const NO_PERSONAS_YET = 'No personas yet — agents carry on';
export const LEDE = 'Who agents picture when they design. Describe a kind of customer, never a real one by name.';

/** The list: its sortable table and what draws under it (the add button). */
export function PersonasTable({ product, rows, query, add }: { product: string; rows: readonly PersonaRow[]; query: Query; add: ReactNode }) {
  const path = sectionHref(product, 'personas');
  return (
    <Section id="personas-title" title="Personas" lede={LEDE}>
      {rows.length === 0 ? <p className="products-empty">{NO_PERSONAS_YET}</p> : (
        <div className="kn-scroll">
          <SortableList
            classes="kn" columns={PERSONA_LIST_COLUMNS} rows={rows} sort={personaSortOf(query)} path={path} query={query} rowKey={(r: PersonaRow) => r.persona.id}
            row={(r: PersonaRow) => (
              <tr data-persona={r.persona.id}>
                <th scope="row"><Link href={backHref(itemHref(product, 'personas', r.persona.id), query)}>{r.persona.name}</Link></th>
                <td>{r.persona.stance}</td>
                <Cell full={tradeLabel(r.persona.trade)}>{excerpt(tradeLabel(r.persona.trade), 30)}</Cell>
                <td>{whoOf(r.by)}</td>
                <td>{dayOf(r.createdAt)}</td>
              </tr>
            )}
          />
        </div>
      )}
      {add}
    </Section>
  );
}


/** One persona, read whole: who made it and when, then `controls` (its card, edit drawer and delete). */
export function PersonaView({ row, back, controls }: { row: PersonaRow; back: string; controls: ReactNode }) {
  return (
    <section className="ask-card products-section" aria-labelledby="persona-title">
      <p><Link className="products-back" href={back}>← Personas</Link></p>
      <h2 id="persona-title">{row.persona.name}</h2>
      <dl className="kn-fields">
        <dt>Created by</dt><dd>{whoOf(row.by)}</dd>
        <dt>Created</dt><dd>{dayOf(row.createdAt)}</dd>
      </dl>
      {controls}
    </section>
  );
}

