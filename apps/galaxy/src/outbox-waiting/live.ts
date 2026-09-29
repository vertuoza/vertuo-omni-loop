import 'server-only';
import { supabaseServer } from '../data/supabase-server';
import { dossierGithub } from '../dossier/github/server';
import type { WaitingDeps } from './outbox';

// The outbox route's real deps: the signed-in person's own cookie session, and the server's one
// GitHub reader with its 60-second summary cache.
export function waitingDeps(): WaitingDeps {
  return { db: supabaseServer, reader: () => dossierGithub() };
}
