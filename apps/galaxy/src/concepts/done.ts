// POST /api/concepts/done {concept, done} (PRD 2213, s3): a member of a concept's workspace marks it done
// (`done: true`, its issue closed as completed) or reopens it (`done: false`), as a plain function of a
// Request so it is tested with a stubbed Supabase client and a fake GitHub. The caller is checked as
// themselves, never with a service key: the concept is read through their own session, so row-level
// security answers for them, and a concept they may not read is refused 403, the same words whether or
// not it exists. The issue is closed or reopened as the omni-loop App, with a comment naming the caller
// (./done-github.ts); only then are the concept's stored facts written (as the service role, as the
// page's refresh does), so a GitHub failure changes nothing stored. A concept whose PR has not merged is
// never marked done: it is in review. The token never reaches the browser (N-PRODUCT-17).
import { z } from 'zod';
import { parseIssue, type IssueNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { refuse, reply } from '../business-api/reply';
import type { ConceptFacts, FixIssue } from '../dossier/github/fix';
import { UNREAD } from '../dossier/github/summary';
import { isDossierId, type Db } from '../dossier/page/source';
import { rowKind } from '../dossier/page/work';
import { dossierReader } from '../dossier/store';
import { mergeConceptFacts } from '../fixes/facts/refresh';
import { conceptFactsStore, type ConceptFactsStore } from '../fixes/facts/store';

/** The signed-in caller: a client acting as them, and their GitHub login (null when they have none). */
export type Caller = { db: Pick<Db, 'from'>; login: string | null };

export type DoneDeps = {
  /** The caller's own session; null when nobody is signed in. Missing: this deployment has no database. */
  session: (() => Promise<Caller | null>) | null;
  /** Closes (`done`) or reopens the issue as the App, commenting as `login`; the issue as it stands; may throw. */
  setIssue: (repo: string, issue: IssueNumber, done: boolean, login: string) => Promise<FixIssue>;
  /** The concept's stored facts as the caller reads them; null when none are stored. */
  facts: (db: Pick<Db, 'from'>, concept: { id: string; workspace_id: string }) => Promise<ConceptFacts | null>;
  /** Stores what GitHub answered into the concept's facts (the service role); may throw. */
  keep: (concept: { id: string; workspace_id: string }, issue: FixIssue) => Promise<void>;
};

const MAX_BODY_BYTES = 1024;
const NOT_MEMBER = 'Only a member of the concept\'s workspace may mark it done.';
const NOT_MERGED = 'A concept whose concept PR has not merged cannot be marked done.';
const NOT_ISSUED = 'This concept has no issue to close.';
const NO_LOGIN = 'Sign in with GitHub to mark a concept done: the comment names you.';

const Body = z.object({ concept: z.string().refine(isDossierId), done: z.boolean() }).strict();

/** The body a POST carries, or the Response that refuses it. */
async function bodyOf(request: Request): Promise<z.infer<typeof Body> | Response> {
  const text = await request.text();
  const bad = () => refuse(400, 'The body must be {"concept": <the concept\'s id>, "done": true or false}.');
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return bad();
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return bad();
  }
  const parsed = Body.safeParse(value);
  return parsed.success ? parsed.data : bad();
}

/** The concept's stored facts, as the caller reads them (row-level security applies). */
export const storedFacts: DoneDeps['facts'] = async (db, { id, workspace_id }) =>
  (await conceptFactsStore(db).readFacts(workspace_id, [id])).get(id) ?? null;

/** Whether the concept PR its facts name has merged. */
const merged = (facts: ConceptFacts | null) => !!facts && facts.pull !== UNREAD && facts.pull?.state === 'merged';

const said = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The concept the caller may mark done, with the login the comment names; or the Response that refuses. */
async function markable(deps: DoneDeps, caller: Caller, id: string) {
  const row = await dossierReader(caller.db).dossier(id);
  if (!row || rowKind(row) !== 'concept') return refuse(403, NOT_MEMBER);
  if (row.prd === null) return refuse(409, NOT_ISSUED);
  if (!merged(await deps.facts(caller.db, row))) return refuse(409, NOT_MERGED);
  if (caller.login === null) return refuse(403, NO_LOGIN);
  return { row, prd: parseIssue(row.prd), login: caller.login };
}

/** POST: the caller marks a concept done, or reopens it; the concept's issue as it stands answers. */
export async function markDone(request: Request, deps: DoneDeps): Promise<Response> {
  if (!deps.session) return refuse(503, 'Marking a concept done is not available here: this deployment has no database.');
  const caller = await deps.session();
  if (!caller) return refuse(401, 'Sign in first to mark a concept done.');
  const body = await bodyOf(request);
  if (body instanceof Response) return body;
  let found: Awaited<ReturnType<typeof markable>>;
  try {
    found = await markable(deps, caller, body.concept);
  } catch (error) {
    console.error(`concept done: ${said(error)}`);
    return refuse(500, 'The concept could not be read. Try again.');
  }
  if (found instanceof Response) return found;
  const { row, prd, login } = found;
  let issue: FixIssue;
  try {
    issue = await deps.setIssue(row.home_repo, prd, body.done, login);
  } catch (error) {
    console.error(`concept done: ${said(error)}`);
    return refuse(502, `GitHub did not ${body.done ? 'close' : 'reopen'} the concept's issue. Nothing changed: try again.`);
  }
  try {
    await deps.keep(row, issue);
  } catch (error) {
    // GitHub holds the truth and the next sync run stores it: the page still reads the issue's new state.
    console.error(`concept done: ${row.id} is ${issue.state} on GitHub, but its facts were not stored: ${said(error)}`);
  }
  return reply(200, { concept: row.id, issue: { number: issue.number, state: issue.state } });
}

/** A `keep` that stores, in `store`, the issue GitHub answered, the concept PR already stored kept. */
export function keepIssue(store: ConceptFactsStore): DoneDeps['keep'] {
  return async ({ id, workspace_id }, issue) => {
    const stored = (await store.readFacts(workspace_id, [id])).get(id) ?? null;
    await store.writeFacts([{ dossier_id: id, workspace_id, facts: mergeConceptFacts(stored, { issue, pull: UNREAD }) }]);
  };
}
