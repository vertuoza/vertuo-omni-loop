import type { SupabaseClient } from '@supabase/supabase-js';
import type { StoredClaim } from './model';
import { SuggestStoreError, type SuggestStore } from './suggest-api';
import { rowsOr, type RpcAnswer } from './answer';

// The rival suggestions' store (./suggest-api.ts, PRD 748 s3) over a Supabase client acting as the
// signed-in person: row-level security decides which claims are read, claim_pick() who may store a
// suggestion. ./suggest-live.ts hands it the person's own session.

type Db = Pick<SupabaseClient, 'from' | 'rpc'>;

export function suggestStore(db: Db): SuggestStore {
  return {
    async claims(workspace) {
      const { data, error } = await db.from('claims').select('id, seq, kind, value, source, state, product_id').eq('workspace_id', workspace);
      if (error) throw new SuggestStoreError('read the claims', error.code, error.message);
      return rowsOr<StoredClaim>(data);
    },
    async propose(workspace, product, name) {
      const answer: RpcAnswer = await db.rpc('claim_pick', {
        p_workspace: workspace, p_product: product, p_kind: 'rival', p_value: name, p_source: 'suggestion',
      });
      const { data, error } = answer;
      if (error || !data) throw new SuggestStoreError('store a suggestion', error?.code, error?.message ?? 'no row');
      return data as StoredClaim; // ts-allow: claim_pick answers the public.claims row it wrote
    },
  };
}
