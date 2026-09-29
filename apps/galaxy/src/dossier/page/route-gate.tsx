// What every /prd route says before its own read (PRD 587): no dossier without a database, the
// database and the signed-in person when there is one, and the one notice for a read that failed.
import { Notice } from '../../ask/page/Notice';
import type { ArcadeMode } from '../../data/mode';
import { supabaseEnv, supabaseServer } from '../../data/supabase-server';

/** This deployment keeps no dossier: closed, or no database. */
export function DossiersClosed() {
  return (
    <Notice title="PRD dossiers are not open here">
      <p className="ask-muted">This deployment has no database, so it keeps no dossier.</p>
    </Notice>
  );
}

/** The dossier database did not answer a read. */
export function DossierDatabaseDown() {
  return (
    <Notice title="The dossier database could not answer" tone="error">
      <p className="ask-muted">Reload the page in a moment.</p>
    </Notice>
  );
}

/** The database, its public settings and the signed-in person (null when signed out); null when this
 * deployment keeps no dossier. */
export async function dossierSession(mode: ArcadeMode) {
  const env = supabaseEnv();
  if (mode === 'closed' || !env) return null;
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  return { env, db, user };
}
