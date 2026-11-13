import { Section } from '../../KnowledgeLists';
import { Unreadable } from '../../constituents/Unreadable';
import type { Query } from '../../../nav/query';
import type { KnowledgeTab } from '../../product-knowledge.contract';
import { loadEval } from './eval-load';
import { EVAL_LEDE, EVAL_TITLE, EvalView, SearchViews } from './EvalView';

// The Search section's Eval page (PRD omni-loop-8 s5), read as the signed-in person (eval-load.ts) and drawn by
// EvalView.tsx; data that cannot be read says so, and the page still opens.

export async function EvalSection({ tab, query }: { tab: KnowledgeTab; query: Query }) {
  const product = tab.product.id;
  const data = await loadEval(product, Date.now());
  return (
    <>
      <SearchViews product={product} shown="eval" />
      {data === null
        ? <Section id="search-eval-title" title={EVAL_TITLE} lede={EVAL_LEDE}><Unreadable what="eval set" /></Section>
        : <EvalView product={product} runs={data.runs} questions={data.questions} answers={data.answers} query={query} domains={tab.domains.entries} />}
    </>
  );
}
