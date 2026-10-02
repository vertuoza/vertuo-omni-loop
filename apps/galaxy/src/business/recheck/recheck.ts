import { createHash, timingSafeEqual } from 'node:crypto';
import { reply as json } from '../../business-api/reply';
import type { DraftRow } from '../draft/run';
import { firstPart, group } from 'vertuo-omni-plan/kit/lib/narrow.ts';

// POST /api/business/recheck (PRD 774, s4): the weekly recheck. .github/workflows/business-recheck.yml
// calls it every Sunday at 22:00 UTC with `Authorization: Bearer <BUSINESS_RECHECK_SECRET>`; any other
// caller, or every caller while the deployment has no secret, is refused (401) before anything is read.
// For each business holding at least one confirmed claim (decision 14), it starts a draft of kind
// `recheck` and runs it on the same sources as a member's draft (../draft/run.ts), whose merge turns a
// new value into an addition, a new offering or size into a replacement, and moves the receipts of what
// is quoted again. A workspace that fails (its draft cannot start, or its run throws) is logged and
// skipped; the others still run. A business whose draft is already running is skipped too. Only the
// businesses failing to list fails the run (500), so the workflow goes red.

export interface RecheckDeps {
  /** BUSINESS_RECHECK_SECRET; undefined or empty when the deployment has none. */
  secret: string | undefined;
  /** The workspaces whose business holds at least one confirmed claim. */
  businesses(): Promise<string[]>;
  /** business_draft_start(workspace, 'recheck'): the new recheck, or the draft already running. */
  start(workspace: string): Promise<DraftRow>;
  /** Runs a started recheck to its end. */
  run(workspace: string, draft: string): Promise<void>;
  now(): string;
  log(line: string): void;
}

type Skipped = { workspace: string; reason: string };

const why = (error: unknown) => firstPart(error instanceof Error ? error.message : String(error), '\n').slice(0, 300);
const digest = (text: string) => createHash('sha256').update(text).digest();

/** Whether the request carries `Bearer <secret>`; never, without a secret. Compared in constant time. */
function bearerMatches(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const match = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '');
  return match ? timingSafeEqual(digest(group(match, 1)), digest(secret)) : false;
}

/** Rechecks one workspace; null when it ran, else why it was skipped. */
async function recheckOne(deps: RecheckDeps, workspace: string): Promise<string | null> {
  try {
    const draft = await deps.start(workspace);
    if (draft.kind !== 'recheck' || draft.state !== 'running') return 'a draft is already running';
    await deps.run(workspace, draft.id);
    return null;
  } catch (error) {
    deps.log(`business recheck: ${workspace} skipped — ${why(error)}`);
    return why(error);
  }
}

export async function recheckRoute(request: Request, deps: RecheckDeps): Promise<Response> {
  if (!bearerMatches(request, deps.secret)) return json(401, { error: 'A valid bearer secret is required.' });
  let workspaces: string[];
  try {
    workspaces = await deps.businesses();
  } catch (error) {
    deps.log(`business recheck: the businesses could not be listed — ${why(error)}`);
    return json(500, { error: 'The businesses could not be read.' });
  }
  const rechecked: string[] = [];
  const skipped: Skipped[] = [];
  // One at a time: the App's GitHub budget is shared (PRD 587), and each run is already many calls.
  for (const workspace of workspaces) {
    const reason = await recheckOne(deps, workspace);
    if (reason === null) rechecked.push(workspace);
    else skipped.push({ workspace, reason });
  }
  return json(200, { rechecked_at: deps.now(), rechecked, skipped });
}

type Answer = { data: unknown; error: { message: string } | null };
export type ClaimsDb = { from(table: 'claims'): { select(columns: 'workspace_id'): { eq(column: 'state', value: 'confirmed'): PromiseLike<Answer> } } };

/** The workspaces holding a confirmed claim, each once, sorted: read as the service role. */
export async function rechecked(db: ClaimsDb): Promise<string[]> {
  const { data, error } = await db.from('claims').select('workspace_id').eq('state', 'confirmed');
  if (error) throw new Error(`Supabase refused to read the claims: ${error.message}`);
  const ids = ((data ?? []) as Array<{ workspace_id: unknown }>).map((r) => String(r.workspace_id)); // ts-allow: the select names workspace_id; a select answers rows, read here as unknown
  return [...new Set(ids)].sort();
}
