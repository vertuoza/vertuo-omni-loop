import { reply as json } from '../business-api/reply';

// GET /api/waiting/business (PRD 774, s5): for the signed-in person, how many things wait to be checked
// in the business of their workspace (the one joined first, as Settings › Business reads it):
// business_to_check() counts the proposed evidence claims, the contradictions and the faded claims,
// and since PRD 822 the proposed claims a person answered in a skill run (an overrule saved as a claim);
// since PRD 855 (s3), agent_questions_open() adds the open questions agents couldn't answer.
// Any member gets it, since any member can confirm (PRD 774, decision 4). With no workspace, 0. It
// reads as the person (their cookie session), never with a service key (ADR-0032).

/** What the route needs of the Supabase client: who is signed in, and one function call. */
export type BusinessCountDb = {
  auth: { getUser(): Promise<{ data: { user: { id: string } | null } }> };
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export type BusinessCountDeps<Db extends BusinessCountDb = BusinessCountDb> = {
  /** The client acting as the signed-in person; throws when there is no database. */
  db: () => Promise<Db>;
  /** The person's workspace, as the Business page picks it, read through the same client; null when they belong to none. */
  workspace: (db: Db, user: string) => Promise<{ id: string } | null>;
};

type BusinessCount = { count: number };

const why = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function signedIn<Db extends BusinessCountDb>(deps: BusinessCountDeps<Db>): Promise<{ db: Db; user: string } | null> {
  try {
    const db = await deps.db();
    const user = (await db.auth.getUser()).data.user?.id;
    return user ? { db, user } : null;
  } catch (error) {
    console.error(`Waiting business: nobody can sign in: ${why(error)}`);
    return null;
  }
}

/** GET /api/waiting/business → 200 { count }, 401 { error } signed out, or 500 { error }. */
export async function waitingBusiness<Db extends BusinessCountDb>(deps: BusinessCountDeps<Db>): Promise<Response> {
  const who = await signedIn(deps);
  if (!who) return json(401, { error: 'Sign in to see what waits for you.' });
  try {
    const workspace = await deps.workspace(who.db, who.user);
    if (!workspace) return json(200, { count: 0 } satisfies BusinessCount);
    const counted = async (fn: string) => {
      const { data, error } = await who.db.rpc(fn, { p_workspace: workspace.id });
      if (error) throw new Error(error.message);
      return typeof data === 'number' && Number.isInteger(data) && data > 0 ? data : 0;
    };
    const [toCheck, questions] = await Promise.all([counted('business_to_check'), counted('agent_questions_open')]);
    return json(200, { count: toCheck + questions } satisfies BusinessCount);
  } catch (error) {
    console.error(`Waiting business: the count could not be read: ${why(error)}`);
    return json(500, { error: 'The business could not be read.' });
  }
}
