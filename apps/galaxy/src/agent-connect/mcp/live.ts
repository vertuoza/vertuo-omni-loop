import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { after } from 'next/server';
import type { Database } from '../../../../../supabase/database.types.ts';
import { serviceDb } from '../../data/sign-in-live';
import { supabaseEnv } from '../../data/supabase-server';
import { serverEnv, type ArcadeEnv } from '../../env';
import { jevDecideDeps } from '../../jev/resolve-live';
import { judgeQuestion, questionJudge } from '../questions/jev';
import type { McpDeps } from './server';

// The MCP link's real dependencies (./server.ts, PRD 855 s2): a Supabase client acting as nobody (the
// public anon key, no session), because the token is the credential and business_for_token() checks it
// in the database. The token is never checked with a service key (ADR-0051). Without Supabase configured
// (the demo galaxy, a closed build) every tool says the business is not available here.
//
// Jev's Unknown worth asking (PRD 855 s4) runs after the answer (Next's after()), and only when the link's
// workspace has its Jev key set up on Settings › Jev and the decision is not Off (../questions/jev.ts): the
// link names its workspace through the anon client, the service role reads only Jev's settings and key, and
// without a key (or Off) nothing else runs and the question stays open for a person. Without
// SUPABASE_SERVICE_ROLE_KEY no Jev decision runs at all, as for every Jev decision.
export function mcpDeps(env: Pick<ArcadeEnv, 'supabase' | 'serviceRole' | 'secretsMasterKey'> = serverEnv()): McpDeps {
  const supabase = supabaseEnv();
  if (!supabase) return { connect: null };
  const connect = () => createClient<Database>(supabase.url, supabase.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const jev = jevDecideDeps(env);
  return {
    connect,
    ...(jev ? {
      reported: (question: string, link: string) => { after(() => judgeQuestion(questionJudge(serviceDb(), connect(), jev), { question, link })); },
    } : {}),
  };
}
