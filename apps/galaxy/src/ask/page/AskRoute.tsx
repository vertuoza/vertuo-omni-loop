import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { arcadeMode } from '../../data/mode';
import { supabaseEnv, supabaseServer } from '../../data/supabase-server';
import { AskPage } from './AskPage';
import { AskSession } from './AskSession';
import { DEMO_MEMBERS, DEMO_OWNER, demoPane, demoSessions, readScenario } from './demo';
import { Notice } from './Notice';
import { QuestionsTabs } from './QuestionsTabs';
import { SignInCard } from './SignInCard';
import { callbackPath, isSessionId } from './sign-in';
import { readAskDock } from './dock-player';
import { readMembers, readSession, readTabs, sessionPings } from './source';
import { rowOf, startPage } from './tabs';

// /ask and /ask/<id>: the person's page, one tab per terminal, rendered per request as the
// signed-in person. /ask opens on the first tab; /ask/<id> on that session's tab, a closed one
// read-only as the last tab. Signed out, a sign-in card that comes back to the same address. The
// tabs are the person's own terminals; their selected session gets the answer form, Share on the open
// round and the delete button (PRD 144). Another member's session of the same workspace opens at
// /ask/<id> on its own, read-only, outside the tabs (PRD 144); a session of another workspace is not
// found, exactly like one that never was (row-level security hides it). Without a database it plays
// the demo terminals in development, and says ask mode is not open in any other build. Everything
// but a teammate's session starts with the Questions tabs, Open questions marked (PRD 733): /ask and
// the person's own /ask/<id>, which a terminal tab opens, are the same page. The selected tab also
// carries its terminal's heartbeat and who plays in its play dock (PRD 757); a teammate's session gets
// no dock.

export type AskQuery = Record<string, string | string[] | undefined>;

/** The person's own page: the Questions tabs above what it shows. */
const tabbed = (node: ReactNode) => (
  <>
    <QuestionsTabs current="/ask" />
    {node}
  </>
);

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
    return tabbed(
      <AskPage
        key={page.selected ?? ''}
        source={{ kind: 'demo' }}
        page={page}
        pane={pane}
        serverNow={now}
        query={suffix}
        me={DEMO_OWNER}
        members={DEMO_MEMBERS}
      />,
    );
  }
  const env = supabaseEnv();
  if (mode === 'closed' || !env) {
    return tabbed(
      <Notice title="Ask mode is not open here">
        <p className="ask-muted">This deployment has no database, so it cannot show Claude&apos;s questions.</p>
      </Notice>,
    );
  }
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return tabbed(<SignInCard supabase={env} returnPath={callbackPath(id)} error={one(query.signin_error)} />);
  if (id !== null && !isSessionId(id)) notFound();

  let rows;
  let pane;
  try {
    rows = await readTabs(db, user.id, now);
    const selected = id ?? startPage(rows, null, null, now).selected;
    pane = selected === null ? null : await readSession(db, selected, sessionPings(db));
  } catch (error) {
    console.error(error);
    return tabbed(
      <Notice title="The ask database could not answer" tone="error">
        <p className="ask-muted">Reload the page in a moment.</p>
      </Notice>,
    );
  }
  if (id !== null && !pane) notFound();
  const source = { kind: 'database' as const, ...env };
  if (pane && pane.session.owner !== user.id) {
    // A teammate's session, linked: read-only, on its own. The tabs are the person's terminals only.
    return <AskSession key={pane.session.id} source={source} initial={pane} serverNow={Date.now()} viewer="member" me={user.id} />;
  }
  // Whom the owner may share an open round with; nobody to offer when the list cannot be read.
  // Who plays in the tab's play dock (PRD 757), read as the arcade reads it.
  const [members, dock] = await Promise.all([
    pane ? readMembers(db, pane.session.workspace_id) : [],
    pane ? readAskDock(db, user, env) : null,
  ]);
  const page = startPage(rows, pane?.session.id ?? null, pane && rowOf(pane), now);
  return tabbed(<AskPage key={page.selected ?? ''} source={source} page={page} pane={pane} serverNow={Date.now()} me={user.id} members={members} dock={dock} />);
}
