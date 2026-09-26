import { notFound } from 'next/navigation';
import { AskSession } from '../../../src/ask/page/AskSession';
import { demoState, readScenario } from '../../../src/ask/page/demo';
import { Notice } from '../../../src/ask/page/Notice';
import { SignInCard } from '../../../src/ask/page/SignInCard';
import { callbackPath, isSessionId } from '../../../src/ask/page/sign-in';
import { readSession } from '../../../src/ask/page/source';
import { arcadeMode } from '../../../src/data/mode';
import { supabaseEnv, supabaseServer } from '../../../src/data/supabase-server';

// /ask/<session>: the page `omni ask on` links to. Rendered per request, as the signed-in person:
// signed out, a sign-in card that comes back here; signed in as its owner, the answer form and the
// delete button; as another member of its workspace (PRD 144), the same session read-only; as anyone
// else, not found, exactly like a session that never was (row-level security hides it). Without a database it
// plays the demo session in development, and says ask mode is not open in any other build.

type Props = {
  params: Promise<{ session: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export default async function AskSessionPage({ params, searchParams }: Props) {
  const [{ session: id }, query] = await Promise.all([params, searchParams]);
  const mode = arcadeMode(process.env);
  const now = Date.now();

  if (mode === 'demo') {
    return <AskSession source={{ kind: 'demo' }} initial={demoState(id, readScenario(one(query.demo)), now)} serverNow={now} viewer="owner" />;
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
  if (!isSessionId(id)) notFound();

  let state;
  try {
    state = await readSession(db, id);
  } catch (error) {
    console.error(error);
    return (
      <Notice title="The ask database could not answer" tone="error">
        <p className="ask-muted">Reload the page in a moment.</p>
      </Notice>
    );
  }
  if (!state) notFound();
  const viewer = state.session.owner === user.id ? 'owner' : 'member';
  return <AskSession source={{ kind: 'database', ...env }} initial={state} serverNow={Date.now()} viewer={viewer} />;
}
