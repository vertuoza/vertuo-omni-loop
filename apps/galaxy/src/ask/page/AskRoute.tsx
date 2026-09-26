import { notFound } from 'next/navigation';
import { arcadeMode } from '../../data/mode';
import { supabaseEnv, supabaseServer } from '../../data/supabase-server';
import { AskPage } from './AskPage';
import { demoPane, demoSessions, readScenario } from './demo';
import { Notice } from './Notice';
import { SignInCard } from './SignInCard';
import { callbackPath, isSessionId } from './sign-in';
import { readSession, readTabs } from './source';
import { rowOf, startPage } from './tabs';

// /ask and /ask/<id>: the person's page, one tab per terminal, rendered per request as the
// signed-in person. /ask opens on the first tab; /ask/<id> on that session's tab, a closed one
// read-only as the last tab. Signed out, a sign-in card that comes back to the same address; a
// session that is not the person's is not found, exactly like one that never was (row-level security
// hides it). Without a database it plays the demo terminals in development, and says ask mode is not
// open in any other build.

export type AskQuery = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export async function AskRoute({ id, query }: { id: string | null; query: AskQuery }) {
  const mode = arcadeMode(process.env);
  const now = Date.now();

  if (mode === 'demo') {
    const scenario = readScenario(one(query.demo));
    const rows = demoSessions(scenario, now).map(rowOf);
    const linked = id === null ? null : demoPane(id, scenario, now);
    const page = startPage(rows, id, linked && rowOf(linked), now);
    const pane = page.selected === null ? null : linked ?? demoPane(page.selected, scenario, now);
    const suffix = one(query.demo) ? `?demo=${scenario}` : '';
    return <AskPage key={page.selected ?? ''} source={{ kind: 'demo' }} page={page} pane={pane} serverNow={now} query={suffix} />;
  }
  const env = supabaseEnv();
  if (mode === 'closed' || !env) {
    return (
      <Notice title="Ask mode is not open here">
        <p className="ask-muted">This deployment has no database, so it cannot show Claude&apos;s questions.</p>
      </Notice>
    );
  }
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return <SignInCard supabase={env} returnPath={callbackPath(id)} error={one(query.signin_error)} />;
  if (id !== null && !isSessionId(id)) notFound();

  let rows;
  let pane;
  try {
    rows = await readTabs(db, now);
    const selected = id ?? startPage(rows, null, null, now).selected;
    pane = selected === null ? null : await readSession(db, selected);
  } catch (error) {
    console.error(error);
    return (
      <Notice title="The ask database could not answer" tone="error">
        <p className="ask-muted">Reload the page in a moment.</p>
      </Notice>
    );
  }
  if (pane && pane.session.owner !== user.id) pane = null;
  if (id !== null && !pane) notFound();
  const page = startPage(rows, pane?.session.id ?? null, pane && rowOf(pane), now);
  return <AskPage key={page.selected ?? ''} source={{ kind: 'database', ...env }} page={page} pane={pane} serverNow={Date.now()} />;
}
