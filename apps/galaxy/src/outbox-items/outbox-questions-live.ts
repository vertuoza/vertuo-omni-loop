import 'server-only';
import { signInBackTo } from '../ask/page/sign-in';
import { readAsSignedIn, type NotRead } from '../ask/page/signed-in-live';
import { supabaseEnv, supabaseServer } from '../data/supabase-server';
import { serverEnv } from '../env';
import { OUTBOX_PATH, outboxViewOf, type OutboxView } from './outbox-questions';
import { outboxQuestionsRepository } from './outbox-questions.repository';

// Work › Questions › Outbox, read on the server as the signed-in person (PRD 2011 s14): the open outbox items
// of their workspaces' product PRDs, narrowed by the address's product. Row-level security decides what
// they read. The demo has no outbox to show: it reads as not open, like the other pages without a database.

export type OutboxRead = { kind: 'view'; view: OutboxView } | NotRead;

export async function readOutboxLive(query: Readonly<Record<string, string | string[] | undefined>>): Promise<OutboxRead> {
  const mode = serverEnv().mode;
  if (mode === 'demo') return { kind: 'unavailable' };
  return readAsSignedIn(mode, async (db, me): Promise<OutboxRead> => {
    const repo = outboxQuestionsRepository(db);
    const items = await repo.items();
    const [prds, products, authors] = await Promise.all([repo.prds([...new Set(items.map((i) => i.dossier_id))]), repo.products(), repo.authors()]);
    return { kind: 'view', view: outboxViewOf({ items, prds, products, authors, me }, query) };
  });
}

/** Where Google's callback sends the person: back to Outbox, once the code is the session cookie, with
 * `signin_error` when the sign-in failed. */
export async function outboxSignInReturn(url: URL, origin: string): Promise<string> {
  const exchange = supabaseEnv() ? async (code: string) => (await supabaseServer()).auth.exchangeCodeForSession(code) : null;
  return signInBackTo(url, new URL(OUTBOX_PATH, origin), exchange, 'ask');
}
