// What every /prd route says before its own read (PRD 587): no dossier without a database, the
// database and the signed-in person when there is one, and the one notice for a read that failed.
import { Notice } from '../../ask/page/Notice';
import type { ArcadeMode } from '../../data/mode';
import { viewer } from '../../data/viewer';

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
 * deployment keeps no dossier. Read through viewer() (PRD 657): once per request, shared with the
 * layout. The demo is each route's own, decided before. */
export async function dossierSession(mode: ArcadeMode) {
  if (mode !== 'supabase') return null;
  const seen = await viewer();
  if (seen.kind === 'signed-in') return { env: seen.env, db: seen.db, user: seen.user };
  if (seen.kind === 'sign-in') return { env: seen.env, db: seen.db, user: null };
  return null;
}
