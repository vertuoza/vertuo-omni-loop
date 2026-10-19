import type { ProductNeighbourhood } from 'vertuo-omni-plan/kit/lib/knowledge/product-graph.ts';
import type { LinkGraphBundle, LinkGraphRepository } from './link.repository';
import type { ProductGraphRepository } from './product-graph.repository';
import { productGraphService } from './product-graph.service';

// The agent link's neighbourhood (PRD 1798 s4; ADR-0095), for the MCP link's get_knowledge_graph: the
// rows the link reads of its product (./link.repository.ts, the token checked by the database) handed to
// s3's own reader (./product-graph.service.ts) as the repository it reads, so the very join (./join.ts)
// and walk (./walk.ts) the read route answers with answer the link too, and the two cannot differ.

/** A neighbourhood: its body; no node `id` in the product (named by its key, or its name before it has one); or the database's refusal. */
type LinkNeighbourhood =
  | { kind: 'ok'; body: ProductNeighbourhood }
  | { kind: 'no-node'; product: string }
  | { kind: 'refused'; code: string | undefined; reason: string };

/** s3's repository, answering from the rows the link read: the one product, its links, knowledge and graphs. */
function readFrom({ product, links, legal, glossary, never, graphs }: LinkGraphBundle): ProductGraphRepository {
  return {
    productByKey: (key) => Promise.resolve(key === product.key ? product : null),
    productById: (id) => Promise.resolve(id === product.id ? product : null),
    links: () => Promise.resolve(links),
    legal: () => Promise.resolve(legal),
    glossary: () => Promise.resolve(glossary),
    never: () => Promise.resolve(never),
    latestGraph: (repository) => {
      const latest = graphs.find((graph) => graph.repository === repository);
      return Promise.resolve(latest === undefined ? null : { sha: latest.sha, graph: latest.graph, pushed_at: latest.pushed_at, pushed_by_login: latest.pushed_by_login });
    },
  };
}

export function linkGraphService(repository: LinkGraphRepository) {
  return {
    /** The neighbourhood of `id`, `depth` hops out, in the product the link whose token hashes to `hash` reads for `repo`. */
    async neighbourhood(hash: string, { repo, id, depth }: { repo: string | null; id: string; depth: number }): Promise<LinkNeighbourhood> {
      const read = await repository.read(hash, repo);
      if (!read.ok) return { kind: 'refused', code: read.code, reason: read.reason };
      const { product } = read.bundle;
      const answer = await productGraphService(readFrom(read.bundle)).neighbourhood({ id: product.id }, { id, depth });
      return answer.kind === 'ok' ? answer : { kind: 'no-node', product: product.key ?? product.name };
    },
  };
}
