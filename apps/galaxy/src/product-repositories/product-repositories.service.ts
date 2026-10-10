// A product's targets, as the kit reads them (PRD 1364, s4; ADR-0095): the links of the product named
// `product` in the workspace that lists the plan repository `repo`, each read as a `plan.targets`
// entry with whole `owner/name` slugs (the kit shortens `consumes`). The name is matched without case,
// as the database keeps product names unique (products_name_idx). A link with no role is sent as it
// is: the kit refuses it by name, so the person learns which link to fix.
import type { ProductTargetsReply } from './product-repositories.contract';
import type { ProductRepositoriesRepository, StoredLinkRow } from './product-repositories.repository';

/** What the read finds: the reply, or why there is none. */
type ProductTargetsFound =
  | { kind: 'ok'; reply: ProductTargetsReply }
  | { kind: 'unlisted' }
  | { kind: 'no-product' }
  | { kind: 'ambiguous'; count: number };

function targetOf(link: StoredLinkRow): ProductTargetsReply['targets'][number] {
  return {
    repo: link.repository,
    role: link.role,
    knowledge: link.knowledge,
    readAt: link.read_at,
    readOnly: link.read_only,
    consumes: link.consumes,
  };
}

export function productRepositoriesService(store: Pick<ProductRepositoriesRepository, 'workspacesListing' | 'products' | 'links'>) {
  return {
    /** The targets of `product` for the plan repository `repo` (owner/name). */
    async targets(repo: string, product: string): Promise<ProductTargetsFound> {
      const workspaces = await store.workspacesListing(repo.toLowerCase());
      if (workspaces.length === 0) return { kind: 'unlisted' };
      const wanted = product.trim().toLowerCase();
      const named = (await store.products(workspaces)).filter((p) => p.name.toLowerCase() === wanted);
      const [only] = named;
      if (only === undefined) return { kind: 'no-product' };
      if (named.length > 1) return { kind: 'ambiguous', count: named.length };
      const links = await store.links(only.id);
      return { kind: 'ok', reply: { product: { name: only.name }, targets: links.map(targetOf) } };
    },
  };
}

export type ProductRepositoriesService = ReturnType<typeof productRepositoriesService>;
