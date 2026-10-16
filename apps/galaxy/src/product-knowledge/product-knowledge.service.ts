import type { Done, KnowledgeMember, KnowledgeRefusal, KnowledgeTab, KnowledgeWrite } from './product-knowledge.contract';
import { knowledgeRepository, type KnowledgeDb, type KnowledgeRepository, type Refused } from './product-knowledge.repository';

// The product home's Knowledge tab, its rules (PRD 1795 s2).
//
// - tab: what the tab shows, for a product of the reader's workspace: both kinds with their owner and
//   delegate, entries and open proposals (product_knowledge_of()), and, for a workspace owner only, the
//   members they may name. A product the reader does not read, or one of another workspace, or a reader
//   who is no member, is none.
// - change: the kind's owner or delegate (or, while it names neither, a workspace owner: `decides`, as the
//   database says it) changes an entry directly; any other member's change is a proposal. The service asks
//   the database who the caller is and picks the verb; the database still checks.
// - decide, name: the kind's owner or delegate approves or rejects an open proposal; a workspace owner
//   names an owner or a delegate. The database refuses anyone else (42501).

export type { KnowledgeTab };

type Outcome = { ok: true; value: { done: Done } } | { ok: false; kind: KnowledgeRefusal; error: string };

const NOT_ALLOWED = 'You can’t do that on this product’s knowledge.';
const GONE = 'That product, entry or proposal no longer exists. Reload the page.';

/** A refusal by its kind, in the database's words. */
function refusal(refused: Refused): Outcome & { ok: false } {
  if (refused.code === '42501') return { ok: false, kind: 'not-allowed', error: refused.message || NOT_ALLOWED };
  if (refused.code === 'P0002') return { ok: false, kind: 'missing', error: refused.message || GONE };
  if (refused.code === '22023') return { ok: false, kind: 'refused', error: refused.message };
  return { ok: false, kind: 'database', error: refused.message };
}

/** What a write answers: the word for what was done, or the database's refusal. */
const settled = (written: { ok: true } | Refused, done: Done): Outcome => (written.ok ? { ok: true, value: { done } } : refusal(written));

const loginOf = (login: string | null, name: string | null, id: string) => login ?? name ?? id;

export function knowledgeService(store: KnowledgeRepository) {
  return {
    /** What the tab shows, or null when the workspace holds no such product or the reader is no member. */
    async tab(workspace: string, id: string): Promise<KnowledgeTab | null> {
      const product = await store.product(id);
      if (product?.workspace_id !== workspace) return null;
      const read = await store.read(workspace, product.id);
      if (!read.ok) {
        if (read.code === '42501' || read.code === 'P0002') return null;
        throw new Error(`Supabase: could not read the product’s knowledge (${read.message})`);
      }
      const members: KnowledgeMember[] = read.read.canName
        ? (await store.roster(workspace)).map((m) => ({ id: m.user_id, login: loginOf(m.github_login, m.name, m.user_id) }))
        : [];
      return { ...read.read, members };
    },

    /** Applies a change as the signed-in person. */
    async change(product: string, write: KnowledgeWrite): Promise<Outcome> {
      const found = await store.product(product);
      if (!found) return { ok: false, kind: 'missing', error: GONE };
      const workspace = found.workspace_id;

      if (write.op === 'name') return settled(await store.name(workspace, found.id, write.kind, write.role, write.user), 'named');
      if (write.op === 'decide') {
        return settled(await store.decide(workspace, write.proposal, write.verdict), write.verdict === 'approve' ? 'approved' : 'rejected');
      }

      const read = await store.read(workspace, found.id);
      if (!read.ok) return refusal(read);
      return read.read[write.kind].decides
        ? settled(await store.apply(workspace, found.id, write), 'applied')
        : settled(await store.propose(workspace, found.id, write), 'proposed');
    },
  };
}

export type KnowledgeService = ReturnType<typeof knowledgeService>;

/** The tab's reads and writes on `db`, the client the controller was handed: the signed-in person's. */
export const knowledgeReads = (db: KnowledgeDb): KnowledgeService => knowledgeService(knowledgeRepository(db));
