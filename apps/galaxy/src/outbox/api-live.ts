import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { OutboxDeps } from './api';

// The outbox route's real dependencies: the secret the omni-loop App signs with (OMNI_OUTBOX_SECRET),
// and a Supabase client acting as the service role (SUPABASE_SERVICE_ROLE_KEY), which may call
// dossier_outbox_put() and nothing else of the outboxes. Both are server-only: neither is ever
// prefixed NEXT_PUBLIC_, and this route is the only code that uses the key. Without either, the route
// answers 503.
export function outboxDeps(): OutboxDeps {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    secret: process.env.OMNI_OUTBOX_SECRET || null,
    connect: url && key
      ? () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
      : null,
  };
}
