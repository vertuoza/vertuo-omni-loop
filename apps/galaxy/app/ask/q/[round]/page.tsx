import { notFound } from 'next/navigation';
import { AskQuestion } from '../../../../src/ask/page/AskQuestion';
import { DEMO_MEMBERS, DEMO_TEAMMATE, demoQuestion } from '../../../../src/ask/page/demo';
import { Notice } from '../../../../src/ask/page/Notice';
import { SignInCard } from '../../../../src/ask/page/SignInCard';
import { isSessionId, questionCallbackPath } from '../../../../src/ask/page/sign-in';
import { readMembers, readQuestion } from '../../../../src/ask/page/source';
import { arcadeMode } from '../../../../src/data/mode';
import { supabaseEnv, supabaseServer } from '../../../../src/data/supabase-server';

// /ask/q/<round>: one question, the link a session's owner shares (PRD 144). Rendered per request, as
// the signed-in person: signed out, a sign-in card that comes back here; as the owner or the member it
// is shared with, the answer form while it is open; as any other member of the session's workspace,
// the same question read-only; once answered, who answered first, with the answer; as anyone else,
// not found. Without a database it plays the demo's shared question in development (`?demo=answered`:
// already answered by its owner). `?from=<dossier id>` is where the page goes back once answered (PRD 384).

type Props = {
  params: Promise<{ round: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export default async function AskQuestionPage({ params, searchParams }: Props) {
  const [{ round: id }, query] = await Promise.all([params, searchParams]);
  const mode = arcadeMode(process.env);
  const now = Date.now();

  if (mode === 'demo') {
    const initial = demoQuestion(now, one(query.demo) === 'answered');
    return <AskQuestion source={{ kind: 'demo' }} initial={initial} serverNow={now} me={DEMO_TEAMMATE} members={DEMO_MEMBERS} from={one(query.from)} />;
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
  if (!user) return <SignInCard supabase={env} returnPath={questionCallbackPath(id)} error={one(query.signin_error)} />;
  if (!isSessionId(id)) notFound();

  let state;
  try {
    state = await readQuestion(db, id);
  } catch (error) {
    console.error(error);
    return (
      <Notice title="The ask database could not answer" tone="error">
        <p className="ask-muted">Reload the page in a moment.</p>
      </Notice>
    );
  }
  if (!state) notFound();
  const members = await readMembers(db, state.session.workspace_id);
  return <AskQuestion source={{ kind: 'database', ...env }} initial={state} serverNow={Date.now()} me={user.id} members={members} from={one(query.from)} />;
}
