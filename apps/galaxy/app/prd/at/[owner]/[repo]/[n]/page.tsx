import { notFound, redirect } from 'next/navigation';
import { Notice } from '../../../../../../src/ask/page/Notice';
import { arcadeMode } from '../../../../../../src/data/mode';
import { supabaseEnv, supabaseServer } from '../../../../../../src/data/supabase-server';
import { demoHistory } from '../../../../../../src/dossier/page/demo';
import { DossierSignIn } from '../../../../../../src/dossier/page/DossierSignIn';
import { atCallbackPath, findAt, outboxTabPath, readAt } from '../../../../../../src/dossier/page/history-at';
import { readHistory } from '../../../../../../src/dossier/page/source';

// /prd/at/<owner>/<repo>/<n> (PRD 251, s10): the short address the kit's outbox comment points at. It
// redirects to the Outbox tab of the dossier whose home repository and PRD it names, found among the
// dossiers the signed-in person may read (dossier_list(), so row-level security decides): a dossier of
// another workspace, or none, is not found. Signed out, the sign-in card, coming back here through
// ./callback. Without a database it finds the demo history's dossiers in development.

type Props = {
  params: Promise<{ owner: string; repo: string; n: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export default async function AtRoute({ params, searchParams }: Props) {
  const [key, query] = await Promise.all([params.then(readAt), searchParams]);
  if (!key) notFound();
  const mode = arcadeMode(process.env);

  if (mode === 'demo') {
    const id = findAt(demoHistory(Date.now()), key);
    if (!id) notFound();
    redirect(outboxTabPath(id));
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
  if (!user) return <DossierSignIn supabase={env} returnPath={atCallbackPath(key)} error={one(query.signin_error)} />;

  let id: string | null;
  try {
    id = findAt(await readHistory(db), key);
  } catch (error) {
    console.error(error);
    return (
      <Notice title="The dossier database could not answer" tone="error">
        <p className="ask-muted">Reload the page in a moment.</p>
      </Notice>
    );
  }
  if (!id) notFound();
  redirect(outboxTabPath(id));
}
