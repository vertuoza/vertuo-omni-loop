import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { orThrow, parseRows } from '../data/parse-rows';
import { PrdNumberSchema, PrNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';

// The product home's storage (PRD 1364 s9; ADR-0095): the reads behind /app/products/<id>, as the
// signed-in person, so row-level security has the last word. The product (public.products, of the
// workspace), its numbered PRDs (dossiers of kind `prd` whose product_id it is, PRD 1364 s2), their stages
// (prd_stages) and topics (prd_topics), their outbox questions waiting on a person (prd_outbox.waiting),
// their approvals and the voids of those (PRD 1299, PRD 1322), the approval requests waiting on the caller
// (approval_requests_waiting()), and the workspace's open pull requests on a feature branch
// (pull_requests). Since s10, its other tabs': the product's ideas still on a board (ideas.product_id),
// its roadmaps (roadmaps.product_id), and its bug and visual fixes (dossiers of kind `bug` or `visual`).
// Since PRD 1548 s9, its Questions tab's: the product's key (products.key), its product PRDs (dossiers of
// kind `prd` keyed by the product's counter, `mobile-12`), their outbox items with whether each is settled
// (outbox_items, outbox_settlements), and the GitHub logins of the PRDs' authors (players). A failed read throws, and an answer out of shape too. No rule lives here: which lane a
// PRD is on is product-home.service.ts's.

/** What the product home's reads need: the tables and the database's functions. */
export type ProductHomeDb = Pick<SupabaseClient, 'from' | 'rpc'>;
type From = Pick<SupabaseClient, 'from'>;

const PRODUCT_COLUMNS = 'id, name, key';
export const StoredProduct = z.object({ id: z.string(), name: z.string(), key: z.string().nullable() });
type Product = z.infer<typeof StoredProduct>;

const PRODUCT_PRD_COLUMNS = 'id, product_seq, title, opened_by, created_at';
/** A product PRD of the product: keyed by the product's counter, with no home repository (PRD 1548). */
export const StoredProductPrd = z.object({
  id: z.string(),
  product_seq: z.number().int().positive(),
  title: z.string(),
  opened_by: z.string().nullable(),
  created_at: z.string(),
});
export type StoredProductPrd = z.infer<typeof StoredProductPrd>;

const ITEM_COLUMNS = 'dossier_id, item, rank, repository, body, raised_at, outbox_settlements(id)';
/** An outbox item of a product PRD, with its settlements (none while it is open). */
export const StoredItem = z.object({
  dossier_id: z.string(),
  item: z.string(),
  rank: z.enum(['medium', 'high', 'human-action']),
  repository: z.string().nullable(),
  body: z.string(),
  raised_at: z.string(),
  outbox_settlements: z.array(z.object({ id: z.string() })),
});
export type StoredItem = z.infer<typeof StoredItem>;

const PLAYER_COLUMNS = 'user_id, github_login';
/** A member's GitHub login, as their workspace's player. */
export const StoredPlayer = z.object({ user_id: z.string(), github_login: z.string().nullable() });
export type StoredPlayer = z.infer<typeof StoredPlayer>;

const PRD_COLUMNS = 'id, home_repo, prd, title, birthplace, opened_by, created_at';
/** A numbered PRD of the product. */
export const StoredHomePrd = z.object({
  id: z.string(),
  home_repo: z.string(),
  prd: PrdNumberSchema,
  title: z.string(),
  birthplace: z.string().nullable(),
  opened_by: z.string().nullable(),
  created_at: z.string(),
});
export type StoredHomePrd = z.infer<typeof StoredHomePrd>;

const STAGE_COLUMNS = 'repository, prd, stage';
export const StoredStageRow = z.object({
  repository: z.string(),
  prd: PrdNumberSchema,
  stage: z.enum(['prd', 'inbox', 'building', 'outbox', 'shipped', 'retro']),
});
export type StoredStageRow = z.infer<typeof StoredStageRow>;

const OUTBOX_COLUMNS = 'repository, prd, waiting';
const WaitingQuestion = z.object({ id: z.string(), rank: z.string(), question: z.string() });
export const StoredOutbox = z.object({ repository: z.string(), prd: PrdNumberSchema, waiting: z.array(WaitingQuestion) });
export type StoredOutbox = z.infer<typeof StoredOutbox>;

const TOPIC_COLUMNS = 'repository, prd, topic';
export const StoredTopic = z.object({ repository: z.string(), prd: PrdNumberSchema, topic: z.string() });
export type StoredTopic = z.infer<typeof StoredTopic>;

const APPROVAL_COLUMNS = 'id, dossier_id, approved_at';
export const StoredApproval = z.object({ id: z.string(), dossier_id: z.string(), approved_at: z.string() });
export type StoredApproval = z.infer<typeof StoredApproval>;

const VOID_COLUMNS = 'approval_id, dossier_id';
export const StoredVoid = z.object({ approval_id: z.string(), dossier_id: z.string() });
export type StoredVoid = z.infer<typeof StoredVoid>;

const PULL_COLUMNS = 'repo, number, head';
export const StoredPull = z.object({ repo: z.string(), number: PrNumberSchema, head: z.string() });
export type StoredPull = z.infer<typeof StoredPull>;

const LINK_COLUMNS = 'repository, role, consumes';
/** A repository linked to the product (PRD 2129): its role and the repositories of the product it consumes. */
const StoredLink = z.object({ repository: z.string(), role: z.string().nullable(), consumes: z.array(z.string()) });
export type StoredLink = z.infer<typeof StoredLink>;

const OTHER_LINK_COLUMNS = 'repository, products(name)';
/** A link of another product to one of this product's repositories, with that product's name. */
const StoredOtherLink = z.object({ repository: z.string(), products: z.object({ name: z.string() }) });
export type StoredOtherLink = z.infer<typeof StoredOtherLink>;

const PHASE0_COLUMNS = 'full_name, phase0';
/** Where a repository's phase 0 is approved: `pr` (docs-only pull request) or `server` (the PRD page). */
const StoredPhase0 = z.object({ full_name: z.string(), phase0: z.enum(['pr', 'server']) });
export type StoredPhase0 = z.infer<typeof StoredPhase0>;

const IDEA_COLUMNS = 'id, repo, title, pitch, lane, prd, created_at';
/** An idea of the product still on its board (PRD 1364 s10). */
export const StoredIdea = z.object({
  id: z.string(),
  repo: z.string(),
  title: z.string(),
  pitch: z.string(),
  lane: z.string(),
  prd: PrdNumberSchema.nullable(),
  created_at: z.string(),
});
export type StoredIdea = z.infer<typeof StoredIdea>;

const ROADMAP_COLUMNS = 'id, number, repo, title, milestone, target_date, created_at';
/** A roadmap of the product (PRD 1364 s10). */
export const StoredRoadmap = z.object({
  id: z.string(),
  number: z.number().int(),
  repo: z.string(),
  title: z.string(),
  milestone: z.string(),
  target_date: z.string().nullable(),
  created_at: z.string(),
});
export type StoredRoadmap = z.infer<typeof StoredRoadmap>;

/** The dossier kinds a fix is: a bug fix's and a visual fix's (PRD 627). */
const FIX_KINDS = ['bug', 'visual'] as const;
const FIX_COLUMNS = 'id, kind, home_repo, title, created_at';
/** A bug or visual fix of the product (PRD 1364 s10). */
export const StoredFix = z.object({
  id: z.string(),
  kind: z.enum(FIX_KINDS),
  home_repo: z.string(),
  title: z.string(),
  created_at: z.string(),
});
export type StoredFix = z.infer<typeof StoredFix>;

/** One request waiting on the caller, as approval_requests_waiting() lists it: only its dossier is read. */
const WaitingRequest = z.object({ dossier: z.string() });

/** The products of a workspace, or every one. */
export const productOf = (db: From, workspace?: string) => {
  const read = db.from('products').select(PRODUCT_COLUMNS);
  return workspace === undefined ? read : read.eq('workspace_id', workspace);
};

/** The numbered PRDs of every product, or of the workspace's product given, newest first. */
export const productPrdsOf = (db: From, scope?: { workspace: string; product: string }) => {
  const read = db.from('dossiers').select(PRD_COLUMNS).eq('kind', 'prd').not('prd', 'is', null).not('product_id', 'is', null);
  return (scope === undefined ? read : read.eq('workspace_id', scope.workspace).eq('product_id', scope.product))
    .order('created_at', { ascending: false });
};

type ProductScope = { workspace: string; product: string };

/** The product PRDs of every product, or of the workspace's product given, newest first. */
export const productServerPrdsOf = (db: From, scope?: ProductScope) => {
  const read = db.from('dossiers').select(PRODUCT_PRD_COLUMNS).eq('kind', 'prd').not('product_seq', 'is', null);
  return (scope === undefined ? read : read.eq('workspace_id', scope.workspace).eq('product_id', scope.product))
    .order('created_at', { ascending: false });
};

/** The outbox items of every product PRD, or of `dossiers`, oldest first, each with its settlements. */
export const productItemsOf = (db: From, dossiers?: readonly string[]) => {
  const read = db.from('outbox_items').select(ITEM_COLUMNS);
  return (dossiers === undefined ? read : read.in('dossier_id', [...dossiers])).order('raised_at');
};

/** The players of every workspace, or of the workspace's members given. */
export const playersOf = (db: From, scope?: { workspace: string; users: readonly string[] }) => {
  const read = db.from('players').select(PLAYER_COLUMNS);
  return scope === undefined ? read : read.eq('workspace_id', scope.workspace).in('user_id', [...scope.users]);
};

/** The ideas on a board of every product, or of the workspace's product given, newest first. */
export const productIdeasOf = (db: From, scope?: ProductScope) => {
  const read = db.from('ideas').select(IDEA_COLUMNS).eq('archived', false).not('product_id', 'is', null);
  return (scope === undefined ? read : read.eq('workspace_id', scope.workspace).eq('product_id', scope.product))
    .order('created_at', { ascending: false });
};

/** The roadmaps of every product, or of the workspace's product given, newest first. */
export const productRoadmapsOf = (db: From, scope?: ProductScope) => {
  const read = db.from('roadmaps').select(ROADMAP_COLUMNS).not('product_id', 'is', null);
  return (scope === undefined ? read : read.eq('workspace_id', scope.workspace).eq('product_id', scope.product))
    .order('created_at', { ascending: false });
};

/** The bug and visual fixes of every product, or of the workspace's product given, newest first. */
export const productFixesOf = (db: From, scope?: ProductScope) => {
  const read = db.from('dossiers').select(FIX_COLUMNS).in('kind', [...FIX_KINDS]).not('product_id', 'is', null);
  return (scope === undefined ? read : read.eq('workspace_id', scope.workspace).eq('product_id', scope.product))
    .order('created_at', { ascending: false });
};

/** The stages of every PRD, or of the workspace's in `repos`. */
export const stagesOf = (db: From, scope?: { workspace: string; repos: readonly string[] }) => {
  const read = db.from('prd_stages').select(STAGE_COLUMNS);
  return scope === undefined ? read : read.eq('workspace_id', scope.workspace).in('repository', [...scope.repos]);
};

/** The outboxes of every PRD, or of the workspace's in `repos`. */
export const outboxOf = (db: From, scope?: { workspace: string; repos: readonly string[] }) => {
  const read = db.from('prd_outbox').select(OUTBOX_COLUMNS);
  return scope === undefined ? read : read.eq('workspace_id', scope.workspace).in('repository', [...scope.repos]);
};

/** The topics of every PRD, or of the workspace's in `repos`. */
export const topicsOf = (db: From, scope?: { workspace: string; repos: readonly string[] }) => {
  const read = db.from('prd_topics').select(TOPIC_COLUMNS);
  return scope === undefined ? read : read.eq('workspace_id', scope.workspace).in('repository', [...scope.repos]);
};

/** The approvals of every dossier, or of `dossiers`. */
export const approvalsOf = (db: From, dossiers?: readonly string[]) => {
  const read = db.from('approvals').select(APPROVAL_COLUMNS);
  return dossiers === undefined ? read : read.in('dossier_id', [...dossiers]);
};

/** The voids of every dossier's approvals, or of `dossiers`'. */
export const voidsOf = (db: From, dossiers?: readonly string[]) => {
  const read = db.from('approval_voids').select(VOID_COLUMNS);
  return dossiers === undefined ? read : read.in('dossier_id', [...dossiers]);
};

/** The open pull requests on a feature branch, of every workspace or of one. */
export const featurePullsOf = (db: From, workspace?: string) => {
  const read = db.from('pull_requests').select(PULL_COLUMNS).is('closed_at', null).is('merged_at', null).like('head', 'feat/%');
  return workspace === undefined ? read : read.eq('workspace_id', workspace);
};

/** The links of the workspace's product to its repositories, by name. */
const linksOf = (db: From, scope: ProductScope) =>
  db.from('product_repositories').select(LINK_COLUMNS).eq('workspace_id', scope.workspace).eq('product_id', scope.product).order('repository');

/** The links of the workspace's other products to `repos`, each with its product's name. */
const otherLinksOf = (db: From, scope: ProductScope, repos: readonly string[]) =>
  db.from('product_repositories').select(OTHER_LINK_COLUMNS).eq('workspace_id', scope.workspace).neq('product_id', scope.product).in('repository', [...repos]);

/** The phase 0 flag of the workspace's repositories `repos`. */
const phase0Of = (db: From, workspace: string, repos: readonly string[]) =>
  db.from('repositories').select(PHASE0_COLUMNS).eq('workspace_id', workspace).in('full_name', [...repos]);

const why = (error: { message: string }) => error.message;
const WHERE = 'product-home/product-home.repository';

/** What a function call answers: its body, unparsed, or its error. */
type RpcAnswer = { data: unknown; error: { message: string } | null };

export function productHomeRepository(db: ProductHomeDb) {
  return {
    /** The workspace's product `id`, with its key; null when it holds none such. */
    async product(workspace: string, id: string): Promise<Product | null> {
      const { data, error } = await productOf(db, workspace).eq('id', id);
      if (error) throw new Error(`Supabase: could not read the product (${why(error)})`);
      return orThrow(parseRows(StoredProduct, data, `${WHERE}: products`))[0] ?? null;
    },

    /** The product's numbered PRDs, newest first. */
    async prds(workspace: string, product: string): Promise<StoredHomePrd[]> {
      const { data, error } = await productPrdsOf(db, { workspace, product });
      if (error) throw new Error(`Supabase: could not read the product's PRDs (${why(error)})`);
      return orThrow(parseRows(StoredHomePrd, data, `${WHERE}: dossiers`));
    },

    /** The product's product PRDs, newest first. */
    async productPrds(workspace: string, product: string): Promise<StoredProductPrd[]> {
      const { data, error } = await productServerPrdsOf(db, { workspace, product });
      if (error) throw new Error(`Supabase: could not read the product's PRDs on the server (${why(error)})`);
      return orThrow(parseRows(StoredProductPrd, data, `${WHERE}: product dossiers`));
    },

    /** The outbox items of the product PRDs `dossiers`, oldest first, each with its settlements. */
    async items(dossiers: readonly string[]): Promise<StoredItem[]> {
      if (dossiers.length === 0) return [];
      const { data, error } = await productItemsOf(db, dossiers);
      if (error) throw new Error(`Supabase: could not read the PRDs' outbox items (${why(error)})`);
      return orThrow(parseRows(StoredItem, data, `${WHERE}: outbox_items`));
    },

    /** The players of the workspace's members `users`: their GitHub logins. */
    async players(workspace: string, users: readonly string[]): Promise<StoredPlayer[]> {
      if (users.length === 0) return [];
      const { data, error } = await playersOf(db, { workspace, users });
      if (error) throw new Error(`Supabase: could not read the PRDs' authors (${why(error)})`);
      return orThrow(parseRows(StoredPlayer, data, `${WHERE}: players`));
    },

    /** The product's ideas still on a board, newest first. */
    async ideas(workspace: string, product: string): Promise<StoredIdea[]> {
      const { data, error } = await productIdeasOf(db, { workspace, product });
      if (error) throw new Error(`Supabase: could not read the product's ideas (${why(error)})`);
      return orThrow(parseRows(StoredIdea, data, `${WHERE}: ideas`));
    },

    /** The product's roadmaps, newest first. */
    async roadmaps(workspace: string, product: string): Promise<StoredRoadmap[]> {
      const { data, error } = await productRoadmapsOf(db, { workspace, product });
      if (error) throw new Error(`Supabase: could not read the product's roadmaps (${why(error)})`);
      return orThrow(parseRows(StoredRoadmap, data, `${WHERE}: roadmaps`));
    },

    /** The product's bug and visual fixes, newest first. */
    async fixes(workspace: string, product: string): Promise<StoredFix[]> {
      const { data, error } = await productFixesOf(db, { workspace, product });
      if (error) throw new Error(`Supabase: could not read the product's fixes (${why(error)})`);
      return orThrow(parseRows(StoredFix, data, `${WHERE}: fix dossiers`));
    },

    /** The product's linked repositories, by name: role and declared `consumes`. */
    async links(workspace: string, product: string): Promise<StoredLink[]> {
      const { data, error } = await linksOf(db, { workspace, product });
      if (error) throw new Error(`Supabase: could not read the product's repositories (${why(error)})`);
      return orThrow(parseRows(StoredLink, data, `${WHERE}: product_repositories`));
    },

    /** The other products' links to `repos`, each with its product's name. */
    async otherLinks(workspace: string, product: string, repos: readonly string[]): Promise<StoredOtherLink[]> {
      if (repos.length === 0) return [];
      const { data, error } = await otherLinksOf(db, { workspace, product }, repos);
      if (error) throw new Error(`Supabase: could not read the repositories' other products (${why(error)})`);
      return orThrow(parseRows(StoredOtherLink, data, `${WHERE}: product_repositories of other products`));
    },

    /** The phase 0 flag of `repos`. */
    async phase0(workspace: string, repos: readonly string[]): Promise<StoredPhase0[]> {
      if (repos.length === 0) return [];
      const { data, error } = await phase0Of(db, workspace, repos);
      if (error) throw new Error(`Supabase: could not read the repositories' phase 0 (${why(error)})`);
      return orThrow(parseRows(StoredPhase0, data, `${WHERE}: repositories`));
    },

    /** The stages of the workspace's PRDs in `repos`. */
    async stages(workspace: string, repos: readonly string[]): Promise<StoredStageRow[]> {
      if (repos.length === 0) return [];
      const { data, error } = await stagesOf(db, { workspace, repos });
      if (error) throw new Error(`Supabase: could not read the PRDs' stages (${why(error)})`);
      return orThrow(parseRows(StoredStageRow, data, `${WHERE}: prd_stages`));
    },

    /** The outboxes of the workspace's PRDs in `repos`. */
    async outbox(workspace: string, repos: readonly string[]): Promise<StoredOutbox[]> {
      if (repos.length === 0) return [];
      const { data, error } = await outboxOf(db, { workspace, repos });
      if (error) throw new Error(`Supabase: could not read the PRDs' outboxes (${why(error)})`);
      return orThrow(parseRows(StoredOutbox, data, `${WHERE}: prd_outbox`));
    },

    /** The topics of the workspace's PRDs in `repos`. */
    async topics(workspace: string, repos: readonly string[]): Promise<StoredTopic[]> {
      if (repos.length === 0) return [];
      const { data, error } = await topicsOf(db, { workspace, repos });
      if (error) throw new Error(`Supabase: could not read the PRDs' topics (${why(error)})`);
      return orThrow(parseRows(StoredTopic, data, `${WHERE}: prd_topics`));
    },

    /** The approvals of `dossiers`. */
    async approvals(dossiers: readonly string[]): Promise<StoredApproval[]> {
      if (dossiers.length === 0) return [];
      const { data, error } = await approvalsOf(db, dossiers);
      if (error) throw new Error(`Supabase: could not read the PRDs' approvals (${why(error)})`);
      return orThrow(parseRows(StoredApproval, data, `${WHERE}: approvals`));
    },

    /** The voids of `dossiers`' approvals. */
    async voids(dossiers: readonly string[]): Promise<StoredVoid[]> {
      if (dossiers.length === 0) return [];
      const { data, error } = await voidsOf(db, dossiers);
      if (error) throw new Error(`Supabase: could not read the approvals' voids (${why(error)})`);
      return orThrow(parseRows(StoredVoid, data, `${WHERE}: approval_voids`));
    },

    /** The dossiers whose latest approval request asks the caller, with no approval since. */
    async waitingOnMe(): Promise<string[]> {
      const answered: RpcAnswer = await db.rpc('approval_requests_waiting');
      const { data, error } = answered;
      if (error) throw new Error(`Supabase: could not read the approvals waiting on you (${why(error)})`);
      return orThrow(parseRows(WaitingRequest, data, `${WHERE}: approval_requests_waiting`)).map((r) => r.dossier);
    },

    /** The workspace's open pull requests on a feature branch. */
    async featurePulls(workspace: string): Promise<StoredPull[]> {
      const { data, error } = await featurePullsOf(db, workspace);
      if (error) throw new Error(`Supabase: could not read the pull requests (${why(error)})`);
      return orThrow(parseRows(StoredPull, data, `${WHERE}: pull_requests`));
    },
  };
}

export type ProductHomeRepository = ReturnType<typeof productHomeRepository>;
