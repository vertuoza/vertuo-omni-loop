import { notFound } from 'next/navigation';
import type { Query } from '../../nav/query';
import { sectionHref, showHref, showOf } from '../knowledge-sections';
import type { KnowledgeTab } from '../product-knowledge.contract';
import { AddConstituent, ConstituentLine } from './ConstituentsClient';
import { ConstituentView, ConstituentsTable, LEDE } from './ConstituentsList';
import { loadConstituentsData, type ConstituentsData } from './constituents-load';
import { rowOf, type ConstituentRow } from './constituents-section';
import { Section } from '../KnowledgeLists';
import { Unreadable } from './Unreadable';

// The Constituents section's two pages, read as the signed-in person (PRD 2240 s4): the list and a line's
// page, each drawn by ConstituentsList.tsx from what constituents-load.ts reads.

export async function ConstituentsList({ tab, query }: { tab: KnowledgeTab; query: Query }) {
  const product = tab.product.id;
  const data = await loadConstituentsData(product);
  if (data === null) return <Section id="constituents-title" title="Constituents" lede={LEDE}><Unreadable what="constituents" /></Section>;
  const hasStatement = data.rows.some((r) => r.kind === 'Statement' && !r.removed);
  return (
    <ConstituentsTable
      product={product} rows={data.rows} query={query}
      add={<AddConstituent source={data.source} read={data.read} product={product} hasStatement={hasStatement} />}
    />
  );
}

/** What a line's page draws under its fields: its panel while it is live, its text once it is removed. */
function controlsOf(data: ConstituentsData, row: ConstituentRow, product: string, back: string) {
  const live = !row.removed && data.read.constituents?.some((c) => c.id === row.id);
  return live
    ? <ConstituentLine source={data.source} read={data.read} product={product} focus={row.id} backHref={back} />
    : <p className="constituents-text">{row.text}</p>;
}

/** One line of the product, read whole; the 404 page for one it does not hold. */
export async function ConstituentItem({ tab, item, query }: { tab: KnowledgeTab; item: string; query: Query }) {
  const product = tab.product.id;
  const data = await loadConstituentsData(product);
  const back = showHref(sectionHref(product, 'constituents'), query, showOf(query));
  if (data === null) return <Section id="constituent-title" title="Constituents" lede={LEDE}><Unreadable what="constituents" /></Section>;
  const row = rowOf(data.rows, item);
  if (row === null) notFound();
  return <ConstituentView row={row} back={back} controls={controlsOf(data, row, product, back)} />;
}
