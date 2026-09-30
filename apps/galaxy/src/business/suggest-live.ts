import 'server-only';
import { supabaseEnv, supabaseServer } from '../data/supabase-server';
import { suggesterFromEnv } from './suggest';
import type { SuggestDeps } from './suggest-api';
import { suggestStore } from './suggest-store';

// The rival suggestions' real dependencies (./suggest-api.ts, PRD 748 s3): the signed-in person's own
// Supabase session, so row-level security decides which claims are read and claim_pick() who may
// store a suggestion (./suggest-store.ts); and the small model through OpenRouter, only when
// OPENROUTER_API_KEY is set. Without a database, nobody is signed in.

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
