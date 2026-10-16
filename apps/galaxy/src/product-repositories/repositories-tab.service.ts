import {
  approversOf, GONE, NOT_MEMBER, NOT_OWNER, type Approvers, type ApproverState, type Member,
} from '../products/approvers';
import { holdSentence, type Hold, type Link, type LinkWrite, type PlanArchive, type RepositoriesTab, type TabRefusal } from './repositories-tab.contract';
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
// - archive: an owner archives the product's plan repository, or undoes it (PRD 2011 s17). Refused, naming
//   each hold, while a repository of the product is below step 5 of the rollout ladder or a roadmap, bug
//   record or PRD born in the plan repository is still open; the database refuses the ladder again
//   (product_plan_archive()), this adds the records born in git. It records the decision only: the App
//   makes the repository read-only on GitHub (apps/omni-app/src/plan-archive/), so no key is here.
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
  ladderStep: row.ladder_step,
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

/** The database's refusal of an archive by its kind, in its words. */
function archiveRefusal(refused: Refused): { ok: false; kind: TabRefusal; error: string } {
  const kinds: Record<string, TabRefusal> = { '42501': 'not-owner', P0002: 'missing', '22023': 'refused', '55000': 'refused' };
  return { ok: false, kind: kinds[refused.code ?? ''] ?? 'database', error: refused.message };
}

const RECORD_NAMES = { prd: 'PRD', bug: 'bug', roadmap: 'roadmap' } as const;
/** The record's number as people read it: a roadmap's is four digits (`0412`). */
const numberOf = (kind: keyof typeof RECORD_NAMES, number: number) => (kind === 'roadmap' ? String(number).padStart(4, '0') : String(number));
const UNREAD: Hold = { name: 'Open records', why: 'could not be read just now' };

/** The repositories of the product below step 5, but the plan repository itself, by name. */
const ladderHolds = (links: readonly Link[], plan: string): Hold[] =>
  links.filter((l) => l.ladderStep < 5 && l.repo !== plan).map((l) => ({ name: l.repo.split('/').at(-1) ?? l.repo, why: `step ${String(l.ladderStep)}` }));

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

  /** What still holds the plan repository: its ladder holds, then the records born there and still open. Unreadable: one hold saying so. */
  async function holdsOf(workspace: string, plan: string, links: readonly Link[]): Promise<Hold[]> {
    const ladder = ladderHolds(links, plan);
    try {
      const open = await store.openBornInGit(workspace, plan);
      return [...ladder, ...open.map((r) => ({ name: `${RECORD_NAMES[r.kind]} ${numberOf(r.kind, r.number)}`, why: 'in git' }))];
    } catch (err) {
      console.error(`product repositories: what is open in ${plan} could not be read (${why(err)})`);
      return [...ladder, UNREAD];
    }
  }

  async function planOf(workspace: string, product: { plan_repository: string | null; plan_archived_at: string | null }, links: readonly Link[]): Promise<PlanArchive | null> {
    if (product.plan_repository === null) return null;
    return {
      repository: product.plan_repository,
      archivedAt: product.plan_archived_at,
      holds: product.plan_archived_at === null ? await holdsOf(workspace, product.plan_repository, links) : [],
    };
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
      const shown = links.map(linkOf);
      return {
        product: { id: product.id, name: product.name },
        owner,
        links: shown,
        addable: [...new Set(repositories)].filter((r) => !linked.has(r)).sort(byName),
        approvers,
        plan: await planOf(workspace, product, shown),
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

    /**
     * Archives the product's plan repository (true), or undoes it (false). An owner only; the holds refuse an
     * archive in the database's words for the ladder, and in `X · Y` for the records born in git.
     */
    async archive(product: string, archived: boolean): Promise<Outcome<{ archivedAt: string | null }>> {
      const row = await store.product(product);
      if (!row) return { ok: false, kind: 'missing', error: 'No such product.' };
      if (!(await store.owner(row.workspace_id))) return { ok: false, kind: 'not-owner', error: 'Only a workspace owner archives the plan repository.' };
      if (archived && row.plan_repository !== null && row.plan_archived_at === null) {
        const holds = await holdsOf(row.workspace_id, row.plan_repository, (await store.links(row.id)).map(linkOf));
        if (holds.length > 0) return { ok: false, kind: 'refused', error: `Archive: still held by ${holds.map(holdSentence).join(' · ')}.` };
      }
      const done = await store.archive(product, archived);
      return done.ok ? { ok: true, value: { archivedAt: done.archivedAt } } : archiveRefusal(done);
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
