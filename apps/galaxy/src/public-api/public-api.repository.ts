// The public API's storage (PRD 2022 s2; ADR-0095), on the client it is given: the service role's, since
// a program's key is no person's session. The key itself is checked by api_key_of()
// (supabase/migrations/20261210090000_api_keys.sql), which answers only a live `api` key whose maker is
// still a member of its workspace. Every other read is filtered here by the workspace and allow-list the
// service hands in, so a read never reaches past them; which workspace and which repositories is the
// service's rule. Every answer is parsed where it comes in; a refusal of the database, or an answer out of
// shape, throws, naming the call: the controller answers 500 and logs it.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { PrdNumberSchema, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { orThrow, parseRow } from '../data/parse-rows';
import { PRD_STAGES } from './public-api.contract';

/** What the reads need: the tables, and api_key_of(). */
export type PublicApiDb = Pick<SupabaseClient, 'from' | 'rpc'>;

const KeyRow = z.object({
  key_id: z.string(),
  workspace_id: z.string(),
  repos: z.array(z.string()),
  made_by: z.string(),
  name: z.string(),
});
/** A live key, as api_key_of() answers it. */
export type KeyRow = z.infer<typeof KeyRow>;

const DossierRow = z.object({
  id: z.string(),
  prd: PrdNumberSchema.nullable(),
  product_seq: z.number().int().positive().nullable(),
  product_id: z.string().nullable(),
  title: z.string(),
  home_repo: z.string().nullable(),
  created_at: z.string(),
});
/** A numbered dossier, as the lists read it. */
export type DossierRow = z.infer<typeof DossierRow>;

// A key's GitHub App (PRD 2433 s6), as a send reads it: whether the key holds one comes from `key_id`, the
// one column the service role may select of api_key_github_apps, and its sealed private key comes only from
// the function that opens it for the service role (supabase/migrations/20261228090000_api_key_github_apps.sql
// opens it by job, api_key_github_app_of_job(); a send has no job yet, so it asks by key).
const HeldRow = z.array(z.object({ key_id: z.string() }));
const OpenedApp = z.object({
  app: z.object({
    app_id: z.number().int().positive(),
    slug: z.string().min(1),
    ciphertext: z.string().min(1),
    iv: z.string().min(1),
  }).nullable(),
}).nullable();

/** The App a key holds: its id and slug, and its private key sealed by the secret box (never in the clear here). */
export type KeyGithubApp = { appId: number; slug: string; ciphertext: string; iv: string };

const ProductRow = z.object({ id: z.string(), key: z.string().nullable(), name: z.string() });
export type ProductRow = z.infer<typeof ProductRow>;

const StageRow = z.object({ repository: z.string(), prd: PrdNumberSchema, stage: z.enum(PRD_STAGES) });
export type StageRow = z.infer<typeof StageRow>;

/** The kinds of dossier the lists read. */
export type ListedKind = 'prd' | 'bug';

/** One page of a workspace's dossiers of `kind`, newest first. */
export type DossierPage = {
  workspace: string;
  kind: ListedKind;
  /** Only these home repositories; empty: every one, and the dossiers with none. */
  repos: readonly string[];
  /** Only the rows after this one, in the list's order: `(created_at, id) < (createdAt, id)`. */
  after: { createdAt: string; id: string } | null;
  /** How many rows at most. */
  take: number;
};

const DOSSIER_COLUMNS = 'id, prd, product_seq, product_id, title, home_repo, created_at';

const WHERE = 'public-api/public-api.repository';

type Raw = { data: unknown; error: { message: string } | null };

/** The call's answer as `schema` reads it; throws, naming the call, on a refusal or an answer out of shape. */
async function settled<T>(call: PromiseLike<Raw>, schema: z.ZodType<T>, what: string): Promise<T> {
  const answer = await call;
  if (answer.error) throw new Error(`${what}: ${answer.error.message}`);
  return orThrow(parseRow(schema, answer.data, `${WHERE}: ${what}`));
}

/** The keyset `(created_at, id) < (createdAt, id)` as a PostgREST filter. The cursor module lets only a
 * time and a uuid through; each is quoted all the same. */
const before = ({ createdAt, id }: { createdAt: string; id: string }) =>
  `created_at.lt."${createdAt}",and(created_at.eq."${createdAt}",id.lt."${id}")`;

export function publicApiRepository(db: PublicApiDb) {
  return {
    /** The live key whose secret hashes to `hash`, or null. */
    keyOf(hash: string): Promise<KeyRow | null> {
      return settled(db.rpc('api_key_of', { p_hash: hash }), KeyRow.nullable(), 'api_key_of');
    },

    /** One page of the workspace's numbered dossiers of a kind, newest first; a draft has no number and is
     * never listed. */
    dossiers(page: DossierPage): Promise<DossierRow[]> {
      let query = db.from('dossiers').select(DOSSIER_COLUMNS)
        .eq('workspace_id', page.workspace)
        .eq('kind', page.kind)
        .not('numbered_at', 'is', null);
      if (page.repos.length > 0) query = query.in('home_repo', [...page.repos]);
      if (page.after) query = query.or(before(page.after));
      return settled(
        query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(page.take),
        z.array(DossierRow), 'dossiers',
      );
    },

    /** The workspace's products among `ids`. */
    products(workspace: string, ids: readonly string[]): Promise<ProductRow[]> {
      if (ids.length === 0) return Promise.resolve([]);
      return settled(
        db.from('products').select('id, key, name').eq('workspace_id', workspace).in('id', [...ids]),
        z.array(ProductRow), 'products',
      );
    },

    /** The stored stages of the workspace's PRDs `prds` of `repository`. */
    stages(workspace: string, repository: string, prds: readonly PrdNumber[]): Promise<StageRow[]> {
      if (prds.length === 0) return Promise.resolve([]);
      return settled(
        db.from('prd_stages').select('repository, prd, stage').eq('workspace_id', workspace).eq('repository', repository).in('prd', [...prds]),
        z.array(StageRow), 'prd_stages',
      );
    },

    /** Whether a product of the workspace names `repository` (owner/name, in lower case, as
     * product_plan_repository_set() keeps it) as its plan repository (PRD 2011). */
    async isPlanRepository(workspace: string, repository: string): Promise<boolean> {
      const named = await settled(
        db.from('products').select('id').eq('workspace_id', workspace).eq('plan_repository', repository).limit(1),
        z.array(z.object({ id: z.string() })), 'products.plan_repository',
      );
      return named.length > 0;
    },

    /** The GitHub App the key holds, or null when it holds none (PRD 2433). A key with none is told by `key_id`
     * alone and never reaches the function that opens the sealed key. */
    async githubAppOf(key: string): Promise<KeyGithubApp | null> {
      const held = await settled(db.from('api_key_github_apps').select('key_id').eq('key_id', key).limit(1), HeldRow, 'api_key_github_apps');
      if (held.length === 0) return null;
      const opened = await settled(db.rpc('api_key_github_app_of_key', { p_key: key }), OpenedApp, 'api_key_github_app_of_key');
      const app = opened?.app;
      return app ? { appId: app.app_id, slug: app.slug, ciphertext: app.ciphertext, iv: app.iv } : null;
    },
  };
}

export type PublicApiRepository = ReturnType<typeof publicApiRepository>;
