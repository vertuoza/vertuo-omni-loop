import type { SupabaseClient } from '@supabase/supabase-js';
import { StoredClaim } from './model';
import { SuggestStoreError, type SuggestStore } from './suggest-api';
import { parseRow, parseRows, type Parsed } from '../data/parse-rows';
import type { RpcAnswer } from './answer';

// The rival suggestions' store (./suggest-api.ts, PRD 748 s3) over a Supabase client acting as the
// signed-in person: row-level security decides which claims are read, claim_pick() who may store a
// suggestion. ./suggest-live.ts hands it the person's own session. Each answer is parsed with
// StoredClaim (PRD 1030); one that does not parse throws, as a refusal does.

type Db = Pick<SupabaseClient, 'from' | 'rpc'>;

export const SUGGEST_CLAIM_COLUMNS = 'id, seq, kind, value, source, state, product_id';

/** The parsed value, or the store's error. */
function parsedOr<T>(what: string, parsed: Parsed<T>): T {
  if (!parsed.ok) throw new SuggestStoreError(what, undefined, parsed.error);
  return parsed.value;
}

export function suggestStore(db: Db): SuggestStore {
  return {
    async claims(workspace) {
      const { data, error } = await db.from('claims').select(SUGGEST_CLAIM_COLUMNS).eq('workspace_id', workspace);
      if (error) throw new SuggestStoreError('read the claims', error.code, error.message);
      return parsedOr('read the claims', parseRows(StoredClaim, data, 'business/suggest-store: claims'));
    },
    async propose(workspace, product, name) {
      const answer: RpcAnswer = await db.rpc('claim_pick', {
        p_workspace: workspace, p_product: product, p_kind: 'rival', p_value: name, p_source: 'suggestion',
      });
      const { data, error } = answer;
      if (error || !data) throw new SuggestStoreError('store a suggestion', error?.code, error?.message ?? 'no row');
      return parsedOr('store a suggestion', parseRow(StoredClaim, data, 'business/suggest-store: claim_pick'));
    },
  };
}
