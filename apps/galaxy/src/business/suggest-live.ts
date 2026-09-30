import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseEnv, supabaseServer } from '../data/supabase-server';
import type { StoredClaim } from './model';
import { suggesterFromEnv } from './suggest';
import { SuggestStoreError, type SuggestDeps, type SuggestStore } from './suggest-api';

// The rival suggestions' real dependencies (./suggest-api.ts, PRD 748 s3): the signed-in person's own
// Supabase session, so row-level security decides which claims are read and claim_pick() who may
// store a suggestion; and the small model through OpenRouter, only when OPENROUTER_API_KEY is set.
// Without a database, nobody is signed in.

type Db = Pick<SupabaseClient, 'from' | 'rpc'>;

export function suggestStore(db: Db): SuggestStore {
  return {
    async claims(workspace) {
      const { data, error } = await db.from('claims').select('id, seq, kind, value, source, state, product_id').eq('workspace_id', workspace);
      if (error) throw new SuggestStoreError('read the claims', error.code, error.message);
      return (data ?? []) as StoredClaim[];
    },
    async propose(workspace, product, name) {
      const { data, error } = await db.rpc('claim_pick', {
        p_workspace: workspace, p_product: product, p_kind: 'rival', p_value: name, p_source: 'suggestion',
      });
      if (error || !data) throw new SuggestStoreError('store a suggestion', error?.code, error?.message ?? 'no row');
      return data as StoredClaim;
    },
  };
}

export function suggestDeps(): SuggestDeps {
  return {
    async store() {
      if (!supabaseEnv()) return null;
      const db = await supabaseServer();
      const { data: { user } } = await db.auth.getUser();
      return user ? suggestStore(db) : null;
    },
    suggest: suggesterFromEnv(process.env),
  };
}
