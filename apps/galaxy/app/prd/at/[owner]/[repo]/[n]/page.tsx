import { notFound, redirect } from 'next/navigation';
import { Notice } from '../../../../../../src/ask/page/Notice';
import { arcadeMode } from '../../../../../../src/data/mode';
import { supabaseEnv, supabaseServer } from '../../../../../../src/data/supabase-server';
import { demoDossier } from '../../../../../../src/dossier/page/demo';
import { DossierSignIn } from '../../../../../../src/dossier/page/DossierSignIn';
import { readShort, shortCallbackPath, shortRepo } from '../../../../../../src/dossier/page/short';
import { findDossier } from '../../../../../../src/dossier/page/source';
import { outboxPath } from '../../../../../../src/dossier/page/view';

// /prd/at/<owner>/<repo>/<n> (PRD 251): the short address the outbox comment points at. It redirects to
// the PRD's dossier's Outbox tab, found by its key as the signed-in person, so row-level security
// decides: a dossier of another workspace, or none, is not found. Signed out, the sign-in card, coming
// back here through ./callback. Without a database it finds the demo dossier in development.

type Props = {
  params: Promise<{ owner: string; repo: string; n: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export default async function ShortRoute({ params, searchParams }: Props) {
  const [key, query] = await Promise.all([params.then(readShort), searchParams]);
  if (!key) notFound();
  const mode = arcadeMode(process.env);

  if (mode === 'demo') {
    const { dossier } = demoDossier(Date.now());
    if (dossier.home_repo === shortRepo(key) && dossier.prd === key.prd) redirect(outboxPath(dossier.id));
    notFound();
  }
  const env = supabaseEnv();
  if (mode === 'closed' || !env) {
    return (
      <Notice title="PRD dossiers are not open here">
        <p className="ask-muted">This deployment has no database, so it keeps no dossier.</p>
      </Notice>
    );
  }
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return <DossierSignIn supabase={env} returnPath={shortCallbackPath(key)} error={one(query.signin_error)} />;

  let id: string | null;
  try {
    id = await findDossier(db, shortRepo(key), key.prd);
  } catch (error) {
    console.error(error);
    return (
      <Notice title="The dossier database could not answer" tone="error">
        <p className="ask-muted">Reload the page in a moment.</p>
      </Notice>
    );
  }
  if (!id) notFound();
  redirect(outboxPath(id));
}
