import type { SupabaseClient } from '@supabase/supabase-js';
import type { StoredClaim } from '../model';
import type { SourcesStore, WebPage } from './api';
import type { MergeOutcome } from './merge';
import { DraftStoreError, type DraftRow, type DraftStore } from './run';

// The draft's store (PRD 774, s2) over a Supabase client: the signed-in person's own session for a
// draft (row-level security decides what is read, the functions of
// supabase/migrations/20261021090000_business_evidence.sql who may write), the service role's for the
// weekly recheck (s4). Reads go through the tables a member may read; every write is one of the
// migration's functions. Each failure throws a DraftStoreError with the database's code.

type Db = Pick<SupabaseClient, 'from' | 'rpc'>;

const DRAFT_COLUMNS = 'id, kind, state, started_at, finished_at, counts, scanned, reason';
const OUTCOMES: readonly MergeOutcome[] = ['added', 'seen', 'rejected', 'replacing'];

type Answer = { data: unknown; error: { code?: string; message: string } | null };

function answered<T>(what: string, { data, error }: Answer): T {
  if (error) throw new DraftStoreError(what, error.code, error.message);
  return data as T;
}

function rowOf<T>(what: string, answer: Answer): T {
  const data = answered<T | null>(what, answer);
  if (!data) throw new DraftStoreError(what, undefined, 'no row');
  return data;
}

export function draftStore(db: Db): DraftStore & SourcesStore {
  const call = async (fn: string, args: Record<string, unknown>) => (await db.rpc(fn, args)) as Answer;
  return {
    async running(workspace) {
      const answer = await db.from('business_drafts').select(DRAFT_COLUMNS).eq('workspace_id', workspace).eq('state', 'running').maybeSingle();
      return answered<DraftRow | null>('read the running draft', answer as Answer);
    },
    async start(workspace, kind) {
      return rowOf<DraftRow>('start a draft', await call('business_draft_start', { p_workspace: workspace, p_kind: kind }));
    },
    async progress(workspace, draft, counts, scanned) {
      answered('record the draft\'s progress', await call('business_draft_progress', { p_workspace: workspace, p_draft: draft, p_counts: counts, p_scanned: scanned }));
    },
    async finish(workspace, draft, state, counts, scanned, reason) {
      answered('finish the draft', await call('business_draft_finish', {
        p_workspace: workspace, p_draft: draft, p_state: state, p_counts: counts, p_scanned: scanned, p_reason: reason ?? null,
      }));
    },
    async repositories(workspace) {
      const answer = await db.from('repositories').select('full_name, product_id').eq('workspace_id', workspace).eq('tracked', true).order('full_name');
      return answered<Array<{ full_name: string; product_id: string | null }> | null>('read the repositories', answer as Answer) ?? [];
    },
    async webPages(workspace) {
      const answer = await db.from('business_sources').select('url').eq('workspace_id', workspace).order('added_at');
      return (answered<Array<{ url: string }> | null>('read the web pages', answer as Answer) ?? []).map((r) => r.url);
    },
    async firstProduct(workspace) {
      const answer = await db.from('products').select('id').eq('workspace_id', workspace).order('ordinal').limit(1);
      return (answered<Array<{ id: string }> | null>('read the products', answer as Answer) ?? [])[0]?.id ?? null;
    },
    async claims(workspace) {
      const answer = await db.from('claims').select('id, seq, kind, value, source, state, product_id').eq('workspace_id', workspace);
      return answered<StoredClaim[] | null>('read the claims', answer as Answer) ?? [];
    },
    async propose(workspace, product, kind, value, receipts) {
      const made = rowOf<{ outcome?: unknown }>('propose a claim', await call('claim_propose_evidence', {
        p_workspace: workspace, p_product: product, p_kind: kind, p_value: value, p_receipts: receipts,
      }));
      const outcome = OUTCOMES.find((o) => o === made.outcome);
      if (!outcome) throw new DraftStoreError('propose a claim', undefined, `unknown outcome ${String(made.outcome)}`);
      return outcome;
    },
    async add(workspace, url) {
      return rowOf<WebPage>('add a web page', await call('business_source_add', { p_workspace: workspace, p_url: url }));
    },
    async remove(workspace, source) {
      answered('remove a web page', await call('business_source_remove', { p_workspace: workspace, p_source: source }));
    },
  };
}
