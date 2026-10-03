import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { StoredClaim } from '../model';
import type { SourcesStore } from './api';
import type { MergeOutcome } from './merge';
import { DraftRow, DraftStoreError, type DraftStore } from './run';
import { parseRow, parseRows, type Parsed } from '../../data/parse-rows';

// The draft's store (PRD 774, s2) over a Supabase client: the signed-in person's own session for a
// draft (row-level security decides what is read, the functions of
// supabase/migrations/20261021090000_business_evidence.sql who may write), the service role's for the
// weekly recheck (s4). Reads go through the tables a member may read; every write is one of the
// migration's functions. Each failure throws a DraftStoreError with the database's code; an answer its
// schema does not parse (PRD 1030) throws one too.

type Db = Pick<SupabaseClient, 'from' | 'rpc'>;

export const RUN_DRAFT_COLUMNS = 'id, kind, state, started_at, finished_at, counts, scanned, reason';
export const DRAFT_CLAIM_COLUMNS = 'id, seq, kind, value, source, state, product_id';
const OUTCOMES: readonly MergeOutcome[] = ['added', 'seen', 'rejected', 'replacing'];

export const REPOSITORY_COLUMNS = 'full_name, product_id';

/** A tracked repository, as the draft reads it. */
export const TrackedRepository = z.object({ full_name: z.string(), product_id: z.string().nullable() });
/** A pasted web page's address. */
export const PastedPage = z.object({ url: z.string() });
/** A product's id. */
export const ProductId = z.object({ id: z.string() });
/** What claim_propose_evidence() answers: decision 9's outcome, among the row's other fields. */
const Proposed = z.object({ outcome: z.enum(OUTCOMES) });
/** What business_source_add() answers: the public.business_sources row it added. */
export const AddedSource = z.object({ id: z.string(), url: z.string(), added_at: z.string() });

/** A workspaces row, as the draft's installation lookup reads it (./live.ts): the id as PostgREST
 * answers a bigint, a number or its text. */
export const WorkspaceRow = z.object({ github_org: z.string().nullable(), github_installation_id: z.union([z.number(), z.string()]).nullable() });
export type WorkspaceRow = z.infer<typeof WorkspaceRow>;
export const WORKSPACE_COLUMNS = 'github_org, github_installation_id';

// What the client answers: its data unparsed until a schema reads it (PRD 1030).
type Answer = { data: unknown; error: { code?: string; message: string } | null };

function answered(what: string, { data, error }: Answer): unknown {
  if (error) throw new DraftStoreError(what, error.code, error.message);
  return data;
}

/** The answer parsed with `parse`; one that does not parse throws, as a refusal does. */
function parsed<T>(what: string, result: Parsed<T>): T {
  if (!result.ok) throw new DraftStoreError(what, undefined, result.error);
  return result.value;
}

const rowsOf = <T>(what: string, table: string, schema: z.ZodType<T>, answer: Answer): T[] =>
  parsed(what, parseRows(schema, answered(what, answer), `business/draft/store: ${table}`));

function rowOf<T>(what: string, fn: string, schema: z.ZodType<T>, answer: Answer): T {
  const data = answered(what, answer);
  if (!data) throw new DraftStoreError(what, undefined, 'no row');
  return parsed(what, parseRow(schema, data, `business/draft/store: ${fn}`));
}

export function draftStore(db: Db): DraftStore & SourcesStore {
  return {
    async running(workspace) {
      const answer = await db.from('business_drafts').select(RUN_DRAFT_COLUMNS).eq('workspace_id', workspace).eq('state', 'running').maybeSingle();
      const data = answered('read the running draft', answer);
      return data === null ? null : parsed('read the running draft', parseRow(DraftRow, data, 'business/draft/store: business_drafts'));
    },
    async start(workspace, kind) {
      return rowOf('start a draft', 'business_draft_start', DraftRow, await db.rpc('business_draft_start', { p_workspace: workspace, p_kind: kind }));
    },
    async progress(workspace, draft, counts, scanned) {
      answered('record the draft\'s progress', await db.rpc('business_draft_progress', { p_workspace: workspace, p_draft: draft, p_counts: counts, p_scanned: scanned }));
    },
    async finish(workspace, draft, state, counts, scanned, reason) {
      answered('finish the draft', await db.rpc('business_draft_finish', {
        p_workspace: workspace, p_draft: draft, p_state: state, p_counts: counts, p_scanned: scanned, p_reason: reason ?? null,
      }));
    },
    async repositories(workspace) {
      const answer = await db.from('repositories').select(REPOSITORY_COLUMNS).eq('workspace_id', workspace).eq('tracked', true).order('full_name');
      return rowsOf('read the repositories', 'repositories', TrackedRepository, answer);
    },
    async webPages(workspace) {
      const answer = await db.from('business_sources').select('url').eq('workspace_id', workspace).order('added_at');
      return rowsOf('read the web pages', 'business_sources', PastedPage, answer).map((r) => r.url);
    },
    async firstProduct(workspace) {
      const answer = await db.from('products').select('id').eq('workspace_id', workspace).order('ordinal').limit(1);
      return rowsOf('read the products', 'products', ProductId, answer)[0]?.id ?? null;
    },
    async claims(workspace) {
      const answer = await db.from('claims').select(DRAFT_CLAIM_COLUMNS).eq('workspace_id', workspace);
      return rowsOf('read the claims', 'claims', StoredClaim, answer);
    },
    async propose(workspace, product, kind, value, receipts) {
      const made = await db.rpc('claim_propose_evidence', {
        p_workspace: workspace, p_product: product, p_kind: kind, p_value: value, p_receipts: receipts,
      });
      return rowOf('propose a claim', 'claim_propose_evidence', Proposed, made).outcome;
    },
    async add(workspace, url) {
      return rowOf('add a web page', 'business_source_add', AddedSource, await db.rpc('business_source_add', { p_workspace: workspace, p_url: url }));
    },
    async remove(workspace, source) {
      answered('remove a web page', await db.rpc('business_source_remove', { p_workspace: workspace, p_source: source }));
    },
  };
}
