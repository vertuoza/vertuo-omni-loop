import { notFound } from 'next/navigation';
import type { Query } from '../../nav/query';
import { Section } from '../KnowledgeLists';
import { Unreadable } from '../constituents/Unreadable';
import { sectionHref, showHref, showOf } from '../knowledge-sections';
import type { KnowledgeTab } from '../product-knowledge.contract';
import { LEDE, PersonaView, PersonasTable } from './PersonasList';
import { loadPersonasData } from './personas-load';
import { personaRowOf } from './personas-section';
import { AddPersona, PersonaPage } from './PersonasClient';

// The Personas section's two pages, read as the signed-in person (PRD 2240 s4): the list and a persona's
// page, each drawn by PersonasList.tsx from what personas-load.ts reads.

export async function PersonasList({ tab, query }: { tab: KnowledgeTab; query: Query }) {
  const product = tab.product.id;
  const data = await loadPersonasData(product);
  if (data === null) return <Section id="personas-title" title="Personas" lede={LEDE}><Unreadable what="personas" /></Section>;
  return (
    <PersonasTable
      product={product} rows={data.rows} query={query}
      add={<AddPersona source={data.source} product={product} personas={data.rows.map((r) => r.persona)} />}
    />
  );
}

/** One persona, read whole; the 404 page for one the product does not hold. */
export async function PersonaItem({ tab, item, query }: { tab: KnowledgeTab; item: string; query: Query }) {
  const product = tab.product.id;
  const data = await loadPersonasData(product);
  if (data === null) return <Section id="persona-title" title="Personas" lede={LEDE}><Unreadable what="personas" /></Section>;
  const row = personaRowOf(data.rows, item);
  if (row === null) notFound();
  const back = showHref(sectionHref(product, 'personas'), query, showOf(query));
  return <PersonaView row={row} back={back} controls={<PersonaPage source={data.source} product={product} persona={row.persona} backHref={back} />} />;
}
