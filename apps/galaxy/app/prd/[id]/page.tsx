import { notFound } from 'next/navigation';
import { Notice } from '../../../src/ask/page/Notice';
import { arcadeMode } from '../../../src/data/mode';
import { supabaseEnv, supabaseServer } from '../../../src/data/supabase-server';
import { renderMarkdown, type RenderedMarkdown } from '../../../src/dossier/markdown';
import { DEMO_VIEWER, demoContent, demoDossier } from '../../../src/dossier/page/demo';
import { DossierPage } from '../../../src/dossier/page/DossierPage';
import { DossierSignIn } from '../../../src/dossier/page/DossierSignIn';
import { pulseOf, signature } from '../../../src/dossier/page/live';
import { LiveRefresh } from '../../../src/dossier/page/live-refresh';
import { dossierCallbackPath } from '../../../src/dossier/page/sign-in';
import { readContent, readDossier } from '../../../src/dossier/page/source';
import { dossierView, readPick, type DossierRead } from '../../../src/dossier/page/view';

// /prd/<id>, the page to share (PRD 216): one PRD's dossier. Rendered per request, as the signed-in
// person, so row-level security decides: signed out, a sign-in card that comes back here through
// /prd/<id>/callback; a member of the dossier's workspace, the dossier; anyone else — a member of
// another workspace, a dossier that never was — not found, in the same words. `?tab=` and `?v=` pick the
// artifact and its version. After its opener deletes a draft, `?deleted=1` says it is gone. Without a
// database it plays the demo dossier in development. With one, the page refreshes itself (PRD 384):
// LiveRefresh starts from the signature of what was read here and re-renders only when it moves. Which
// open rounds the signed-in person may answer on the list is read here too, on the server.

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

/** The shown Spec or Plan, rendered; null when it could not be read (the pane says so). */
async function markdownOf(read: () => Promise<string | null>): Promise<RenderedMarkdown | null> {
  try {
    const content = await read();
    return content === null ? null : renderMarkdown(content);
  } catch (error) {
    console.error(error);
    return null;
  }
}

export default async function DossierRoute({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const pick = readPick(query);
  const mode = arcadeMode(process.env);

  if (mode === 'demo') {
    const view = dossierView(demoDossier(Date.now()), DEMO_VIEWER, pick);
    const shown = view.shown;
    const markdown = shown && !shown.frame ? await markdownOf(async () => demoContent(shown.id)) : null;
    return <DossierPage view={view} markdown={markdown} supabase={null} />;
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
  if (!user) return <DossierSignIn supabase={env} returnPath={dossierCallbackPath(id)} error={one(query.signin_error)} />;

  let read: DossierRead | null;
  try {
    read = await readDossier(db, id, user.id);
  } catch (error) {
    console.error(error);
    return (
      <Notice title="The dossier database could not answer" tone="error">
        <p className="ask-muted">Reload the page in a moment.</p>
      </Notice>
    );
  }
  if (!read && one(query.deleted) === '1') {
    return (
      <Notice title="Draft deleted">
        <p className="ask-muted">Nothing is left of it but the questions it asked, which stay in the ask history.</p>
      </Notice>
    );
  }
  if (!read) notFound();

  const view = dossierView(read, user.id, pick);
  const shown = view.shown;
  const markdown = shown && !shown.frame ? await markdownOf(() => readContent(db, shown.id)) : null;
  const pulse = pulseOf(read);
  const live = <LiveRefresh supabase={env} id={view.id} signature={pulse ? signature(pulse) : null} />;
  return <DossierPage view={view} markdown={markdown} supabase={env} live={live} />;
}
