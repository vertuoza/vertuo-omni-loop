import {
  approversOf, GONE, NOT_MEMBER, NOT_OWNER, type Approvers, type ApproverState, type Member,
} from '../products/approvers';
import type { Link, LinkWrite, RepositoriesTab, TabRefusal } from './repositories-tab.contract';
import {
  repositoriesTabRepository, type Refused, type RepositoriesTabDb, type RepositoriesTabRepository, type StoredTabLink,
} from './repositories-tab.repository';

// The product home's Repositories & approvers tab, its rules (PRD 1364 s11; ADR-0095).
//
// - tab: what the tab shows, for a product of the reader's workspace: its links (each repository with
//   its role, knowledge, read-at, read-only, consumes and who added it), the workspace's repositories not
//   in the product yet (what Add a repository offers), whether the reader owns the workspace (only then
//   are the controls drawn: the database refuses anyone else), and its Approvers list (PRD 1322), moved
//   here from Settings › Products. A role that cannot be read reads as a member's; an Approvers list that
//   cannot be read is null, and the links still show. A product the reader does not read, or one of
//   another workspace, is none.
// - saveLink, removeLink: an owner adds a repository, sets every field of its link, or takes it out,
//   through product_repository_link() and product_repository_unlink(); a refusal keeps the database's
//   words (a field it refuses names itself first: `Role: …`, `Consumes: …`).
// - setApprover, removeApprover: an owner lists a member as asked or skipped, or takes them off; a
//   refusal says it as the Approvers section always has (src/products/approvers.ts).

export type { RepositoriesTab };

export type Outcome<T> = { ok: true; value: T } | { ok: false; kind: TabRefusal; error: string };

const why = (err: unknown) => (err instanceof Error ? err.message : String(err));
const byName = (a: string, b: string) => a.localeCompare(b);

const linkOf = (row: StoredTabLink): Link => ({
  repo: row.repository,
  role: row.role,
  knowledge: row.knowledge,
  readAt: row.read_at,
  readOnly: row.read_only,
  consumes: row.consumes,
  addedBy: row.added_by,
});

/** A link refusal by its kind, in the database's words. */
function linkRefusal(refused: Refused): { ok: false; kind: TabRefusal; error: string } {
  if (refused.code === '42501') return { ok: false, kind: 'not-owner', error: refused.message };
  if (refused.code === '22023' || refused.code === 'P0002') return { ok: false, kind: 'refused', error: refused.message };
  return { ok: false, kind: 'database', error: refused.message };
}

/** An approver refusal by its kind, as the Approvers section says it. */
function approverRefusal(refused: Refused): { ok: false; kind: TabRefusal; error: string } {
  if (refused.code === '42501') return { ok: false, kind: 'not-owner', error: NOT_OWNER };
  if (refused.code === '22023') return { ok: false, kind: 'refused', error: NOT_MEMBER };
  if (refused.code === 'P0002') return { ok: false, kind: 'missing', error: GONE };
  return { ok: false, kind: 'database', error: refused.message };
}

const blankToNull = (text: string | null): string | null => (text === null || text.trim() === '' ? null : text.trim());

export function repositoriesTabService(store: RepositoriesTabRepository) {
  /** The Approvers list, or null (logged) when it cannot be read. */
  async function approversOfProduct(workspace: string, product: string, owner: boolean): Promise<Approvers | null> {
    try {
      const [roster, stored] = await Promise.all([store.roster(workspace), store.approvers(product)]);
      const members: Member[] = roster.map((r) => ({ id: r.user_id, name: r.name, login: r.github_login }));
      return { owner, members, listed: approversOf(members, stored) };
    } catch (err) {
      console.error(`product repositories: the approvers of ${product} could not be read (${why(err)})`);
      return null;
    }
  }

  return {
    /** What the tab shows, or null when the workspace holds no such product. Throws when the links cannot be read. */
    async tab(workspace: string, id: string): Promise<RepositoriesTab | null> {
      const product = await store.product(id);
      if (product?.workspace_id !== workspace) return null;
      const owner = await store.owner(workspace).catch((err: unknown) => {
        console.error(`product repositories: your role could not be read (${why(err)})`);
        return false;
      });
      const [links, repositories, approvers] = await Promise.all([
        store.links(product.id), store.repositories(workspace), approversOfProduct(workspace, product.id, owner),
      ]);
      const linked = new Set(links.map((l) => l.repository));
      return {
        product: { id: product.id, name: product.name },
        owner,
        links: links.map(linkOf),
        addable: [...new Set(repositories)].filter((r) => !linked.has(r)).sort(byName),
        approvers,
      };
    },

    /** Adds a repository to the product, or sets every field of its link. */
    async saveLink(product: string, write: LinkWrite): Promise<Outcome<{ link: Link }>> {
      const saved = await store.link(product, {
        repository: write.repo.trim().toLowerCase(),
        role: blankToNull(write.role),
        knowledge: write.knowledge,
        read_at: blankToNull(write.readAt),
        read_only: write.readOnly,
        consumes: write.consumes.map((c) => c.trim().toLowerCase()),
      });
      return saved.ok ? { ok: true, value: { link: linkOf(saved.link) } } : linkRefusal(saved);
    },

    /** Takes a repository out of the product. */
    async removeLink(product: string, repo: string): Promise<Outcome<{ repo: string; removed: boolean }>> {
      const slug = repo.trim().toLowerCase();
      const done = await store.unlink(product, slug);
      return done.ok ? { ok: true, value: { repo: slug, removed: done.removed } } : linkRefusal(done);
    },

    /** Lists a member as asked or skipped, or changes their state. */
    async setApprover(product: string, member: string, state: ApproverState): Promise<Outcome<{ member: string; state: ApproverState }>> {
      const done = await store.setApprover(product, member, state);
      return done.ok ? { ok: true, value: { member, state: done.state } } : approverRefusal(done);
    },

    /** Takes a member off the list. */
    async removeApprover(product: string, member: string): Promise<Outcome<{ member: string; removed: boolean }>> {
      const done = await store.removeApprover(product, member);
      return done.ok ? { ok: true, value: { member, removed: done.removed } } : approverRefusal(done);
    },
  };
}

export type RepositoriesTabService = ReturnType<typeof repositoriesTabService>;

/** The tab's reads and writes on `db`, the client the controller was handed: the signed-in person's. */
export const repositoriesTabReads = (db: RepositoriesTabDb): RepositoriesTabService => repositoriesTabService(repositoriesTabRepository(db));
