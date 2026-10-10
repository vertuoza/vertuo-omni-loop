// A product's targets, as the kit reads and imports them (PRD 1364, s4 and s5; ADR-0095).
//
// - targets: the links of the product named `product` in the workspace that lists the plan repository
//   `repo`, each read as a `plan.targets` entry with whole `owner/name` slugs (the kit shortens
//   `consumes`). The name is matched without case, as the database keeps product names unique
//   (products_name_idx). A link with no role is sent as it is: the kit refuses it by name, so the
//   person learns which link to fix.
// - importTargets: `plan.targets` written into that product, once. A repository not linked yet is
//   added, a link whose fields differ is changed, a link that is the same is left alone, so a second
//   run writes nothing. The new links go in first with nothing consumed, then every link that still
//   differs is written whole: a link consumes only repositories already in the product.
// - productsOf: the products of the workspaces listing a repository that link it, by name.
import { isOneOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { ProductImportReply, ProductImportRequest, ProductsWhichReply, ProductTargetsReply } from './product-repositories.contract';
import type { LinkWritten, ProductRepositoriesRepository, StoredLinkRow, StoredProductRow } from './product-repositories.repository';

/** What the read finds: the reply, or why there is none. */
type ProductTargetsFound =
  | { kind: 'ok'; reply: ProductTargetsReply }
  | ProductMissed;

/** Why no one product answers a name. */
export type ProductMissed = { kind: 'unlisted' } | { kind: 'no-product' } | { kind: 'ambiguous'; count: number };

/** What an import does: the reply, why no product answers, or the database's refusal of a write. */
type ProductImported =
  | { kind: 'ok'; reply: ProductImportReply }
  | ProductMissed
  | { kind: 'refused'; code: string | null; message: string };

type ImportTarget = ProductImportRequest['targets'][number];

const KNOWLEDGE = ['own', 'imported', 'none'] as const;

/** A target as the link the database would keep: lower-case slugs and commit, consumes sorted once each. */
function linkOf(target: ImportTarget): StoredLinkRow {
  return {
    repository: target.repo.toLowerCase(),
    role: target.role.trim(),
    // The request's schema holds knowledge to the three words already; 'own' is the database's default.
    knowledge: isOneOf(KNOWLEDGE, target.knowledge) ? target.knowledge : 'own',
    read_at: target.readAt?.toLowerCase() ?? null,
    read_only: target.readOnly,
    consumes: [...new Set(target.consumes.map((slug) => slug.toLowerCase()))].sort(),
  };
}

/** Whether a stored link already says what `wanted` says. */
function same(stored: StoredLinkRow, wanted: StoredLinkRow): boolean {
  return (
    stored.role === wanted.role &&
    stored.knowledge === wanted.knowledge &&
    stored.read_at === wanted.read_at &&
    stored.read_only === wanted.read_only &&
    [...stored.consumes].sort().join(' ') === wanted.consumes.join(' ')
  );
}

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

export function productRepositoriesService(store: ProductRepositoriesRepository) {
  /** The one product named `product` in the workspaces that list `repo`, or why there is none. */
  async function productNamed(repo: string, product: string): Promise<{ kind: 'ok'; product: StoredProductRow } | ProductMissed> {
    const workspaces = await store.workspacesListing(repo.toLowerCase());
    if (workspaces.length === 0) return { kind: 'unlisted' };
    const wanted = product.trim().toLowerCase();
    const named = (await store.products(workspaces)).filter((p) => p.name.toLowerCase() === wanted);
    const [only] = named;
    if (only === undefined) return { kind: 'no-product' };
    if (named.length > 1) return { kind: 'ambiguous', count: named.length };
    return { kind: 'ok', product: only };
  }

  /** Writes `links` in order, stopping at the first refusal. */
  async function write(product: string, links: StoredLinkRow[]): Promise<LinkWritten> {
    for (const link of links) {
      const written = await store.link(product, link);
      if (!written.ok) return written;
    }
    return { ok: true };
  }

  return {
    /** The targets of `product` for the plan repository `repo` (owner/name). */
    async targets(repo: string, product: string): Promise<ProductTargetsFound> {
      const found = await productNamed(repo, product);
      if (found.kind !== 'ok') return found;
      const links = await store.links(found.product.id);
      return { kind: 'ok', reply: { product: { name: found.product.name }, targets: links.map(targetOf) } };
    },

    /** `request.targets` written into the product it names, for its plan repository. */
    async importTargets(request: ProductImportRequest): Promise<ProductImported> {
      const found = await productNamed(request.repo, request.product);
      if (found.kind !== 'ok') return found;
      const id = found.product.id;
      const stored = new Map((await store.links(id)).map((link) => [link.repository, link]));
      const wanted = request.targets.map(linkOf);
      const added = wanted.filter((link) => !stored.has(link.repository));
      const changed = wanted.filter((link) => { const was = stored.get(link.repository); return was !== undefined && !same(was, link); });
      const firstPass = await write(id, added.map((link) => ({ ...link, consumes: [] })));
      const written = firstPass.ok ? await write(id, [...added.filter((link) => link.consumes.length > 0), ...changed]) : firstPass;
      if (!written.ok) return { kind: 'refused', code: written.code, message: written.message };
      const names = (links: StoredLinkRow[]) => links.map((link) => link.repository);
      const touched = new Set([...names(added), ...names(changed)]);
      return {
        kind: 'ok',
        reply: {
          product: { name: found.product.name },
          added: names(added),
          changed: names(changed),
          unchanged: names(wanted.filter((link) => !touched.has(link.repository))),
        },
      };
    },

    /** The products `repo` (owner/name) is in, in the workspaces the caller reads, by name. */
    async productsOf(repo: string): Promise<ProductsWhichReply> {
      const slug = repo.toLowerCase();
      const workspaces = await store.workspacesListing(slug);
      if (workspaces.length === 0) return { products: [] };
      const linking = new Set(await store.productsLinking(slug, workspaces));
      if (linking.size === 0) return { products: [] };
      const names = (await store.products(workspaces)).filter((p) => linking.has(p.id)).map((p) => p.name);
      return { products: names.sort((a, b) => a.localeCompare(b)).map((name) => ({ name })) };
    },
  };
}

export type ProductRepositoriesService = ReturnType<typeof productRepositoriesService>;
