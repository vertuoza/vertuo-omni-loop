import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { after } from 'next/server';
import { serviceDb } from '../../data/sign-in-live';
import { supabaseEnv } from '../../data/supabase-server';
import { jevDecideDeps } from '../../jev/resolve-live';
import { judgeQuestion, questionJudge } from '../questions/jev';
import type { McpDeps } from './server';

// The MCP link's real dependencies (./server.ts, PRD 855 s2): a Supabase client acting as nobody (the
// public anon key, no session), because the token is the credential and business_for_token() checks it
// in the database. The token is never checked with a service key (ADR-0051). Without Supabase configured
// (the demo galaxy, a closed build) every tool says the business is not available here.
//
// Jev's Unknown worth asking (PRD 855 s4) runs after the answer (Next's after()), as every Jev decision
// runs: the service role reads its settings and key, what Jev reads of the question, and sets the question
// aside on a counted "no" (../questions/jev.ts). Without SUPABASE_SERVICE_ROLE_KEY it never runs, and
// every question waits for a person, as with the decision Off.
export function mcpDeps(env: Record<string, string | undefined> = process.env): McpDeps {
  const supabase = supabaseEnv();
  if (!supabase) return { connect: null };
  const jev = jevDecideDeps(env);
  return {
    connect: () => createClient(supabase.url, supabase.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
    ...(jev ? { reported: (question: string) => after(() => judgeQuestion(questionJudge(serviceDb(), jev), question)) } : {}),
  };
}
