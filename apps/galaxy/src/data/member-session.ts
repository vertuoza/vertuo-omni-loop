import type { User } from '@supabase/supabase-js';
import { arcadeMode } from './mode';
import { supabaseEnv, supabaseServer } from './supabase-server';

// Who a per-request app page (PRD 612) is drawn for, decided once: the demo in development (or
// OMNI_LOOP_DEMO=1); with no database, closed; signed out, the sign-in card; signed in, the database
// as that person, so row-level security decides what each read returns.

export type MemberSession =
  | { kind: 'demo' }
  | { kind: 'closed' }
  | { kind: 'sign-in' }
  | { kind: 'signed-in'; db: Awaited<ReturnType<typeof supabaseServer>>; user: User; env: { url: string; key: string } };

export async function memberSession(): Promise<MemberSession> {
  const mode = arcadeMode(process.env);
  if (mode === 'demo') return { kind: 'demo' };
  const env = supabaseEnv();
  if (mode === 'closed' || !env) return { kind: 'closed' };
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  return user ? { kind: 'signed-in', db, user, env } : { kind: 'sign-in' };
}

/** A query parameter's first value, or null. */
export const firstParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;
