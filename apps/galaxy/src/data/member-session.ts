import type { User } from '@supabase/supabase-js';
import type { supabaseServer } from './supabase-server';
import { viewer } from './viewer';

// Who a per-request app page (PRD 612) is drawn for, decided once: the demo in development (or
// OMNI_LOOP_DEMO=1); with no database, closed; signed out, the sign-in card; signed in, the database
// as that person, so row-level security decides what each read returns. Read through viewer() (PRD
// 657): once per request, shared with the layout.

export type MemberSession =
  | { kind: 'demo' }
  | { kind: 'closed' }
  | { kind: 'sign-in' }
  | { kind: 'signed-in'; db: Awaited<ReturnType<typeof supabaseServer>>; user: User; env: { url: string; key: string } };

export async function memberSession(): Promise<MemberSession> {
  const seen = await viewer();
  if (seen.kind === 'signed-in') return { kind: 'signed-in', db: seen.db, user: seen.user, env: seen.env };
  return { kind: seen.kind };
}

/** A query parameter's first value, or null. */
export const firstParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;
