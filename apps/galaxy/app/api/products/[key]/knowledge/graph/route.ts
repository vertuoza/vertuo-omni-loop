import { productGraphDeps } from '../../../../../../src/knowledge-graph/product-graph-live';
import { readProductGraph } from '../../../../../../src/knowledge-graph/product-graph.controller';

// GET /api/products/<key>/knowledge/graph?id=…&depth=… → 200 P5's neighbourhood at version 2: the
// neighbourhood of one node across every repository of the product, joined with its Legal entries,
// Glossary terms and Never lines (src/knowledge-graph/product-graph.controller.ts, PRD 1798). It sits
// beside the fixed segments `which`, `targets` and `import`, none of which holds a `knowledge` folder.
export const maxDuration = 30;

export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  return readProductGraph(request, (await params).key, productGraphDeps());
}
