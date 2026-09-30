// The heartbeat's half of the contract (PRD 757's spec, "The heartbeat"; ADR-0002), as a plain function
// of a Request, so it is tested with a stubbed Supabase client and the route under
// app/api/ask/heartbeat/ stays one line:
//
//   POST /api/ask/heartbeat {claudeSessionId, repo, work, ended?}                        → 204
//
// `work` is null, {kind: 'draft', draftId}, or {kind: 'prd' | 'visual' | 'bug', number}: what the kit's
// work finder named. Nothing else is taken: an unknown field is refused, so no tool name, path or text
// can ever be stored. The database places the row, resolves its dossier and keeps it the caller's own
// (working_ping(), supabase/migrations/20261020090000_working_pings.sql).
//
// Refusals follow ADR-0029, each `{error}` in plain words: 400 a malformed body, 401 no valid bearer
// token, 403 the database's refusal (a session another account owns, or a repository no workspace of
// the caller owns, with the App's install link after its hint), 413 a body over its cap, 503 no database
// here or the sign-in service down, 500 the database failed. The kit ignores every one of them.
import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticate, withInstallLink, type TokenCheck } from '../ask/auth';
import { WORK_KINDS, type WorkKind } from '../dossier/store';
import { workingStore, WorkingStoreError, type Heartbeat, type Work } from './store';

/** The largest heartbeat: a session id, a repository and a work, with room to spare. */
export const MAX_HEARTBEAT_BYTES = 4 * 1024;

/** A Supabase client acting as one access token: the Auth server's check and the functions. */
export type WorkingClient = TokenCheck & Pick<SupabaseClient, 'rpc'>;

export type WorkingDeps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => WorkingClient) | null;
  /** The App's install link, put after the database's install hint; null or missing: the hint alone. */
  installLink?: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REPO = /^[\w.-]+\/[\w.-]+$/;
const NUMBER_MAX = 2 ** 31 - 1;
const FIELDS = new Set(['claudeSessionId', 'repo', 'work', 'ended']);

const refuse = (status: number, error: string) => Response.json({ error }, { status, headers: { 'cache-control': 'no-store' } });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const hasOnly = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every((key) => keys.includes(key));

const isText = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length >= 1 && value.length <= max;
const isWorkNumber = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 1 && (value as number) <= NUMBER_MAX;

/** A draft's work, or undefined when it is malformed. */
function draftOf(value: Record<string, unknown>): Work | undefined {
  return hasOnly(value, ['kind', 'draftId']) && typeof value.draftId === 'string' && UUID.test(value.draftId)
    ? { kind: 'draft', draftId: value.draftId } : undefined;
}

/** The work a heartbeat names, or undefined when it is malformed. */
function workOf(value: unknown): Work | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  if (value.kind === 'draft') return draftOf(value);
  if (!WORK_KINDS.includes(value.kind as WorkKind) || !hasOnly(value, ['kind', 'number'])) return undefined;
  return isWorkNumber(value.number) ? { kind: value.kind as WorkKind, number: value.number } : undefined;
}

/** The heartbeat a body carries, or the problem with it. */
function heartbeatOf(sent: unknown): Heartbeat | { problem: string } {
  if (!isRecord(sent)) return { problem: 'The body must be a JSON object.' };
  const unknown = Object.keys(sent).find((key) => !FIELDS.has(key));
  if (unknown) return { problem: `A heartbeat carries claudeSessionId, repo, work and ended only, not ${unknown}.` };
  const session = sent.claudeSessionId;
  if (!isText(session, 200)) return { problem: '`claudeSessionId` is a text of 1 to 200 characters.' };
  const repo = sent.repo;
  if (!isText(repo, 200) || !REPO.test(repo)) return { problem: 'A heartbeat names its repository as owner/name.' };
  const work = workOf(sent.work);
  if (work === undefined) {
    return { problem: `\`work\` is null, {kind: 'draft', draftId}, or {kind, number} with kind one of ${WORK_KINDS.join(', ')}.` };
  }
  const ended = sent.ended ?? false;
  if (typeof ended !== 'boolean') return { problem: '`ended`, when sent, is true or false.' };
  return { claudeSessionId: session, repo, work, ended };
}

/** The database's refusal as the contract's answer; a failure is a 500, never a guess. */
function refusal(error: WorkingStoreError, deps: WorkingDeps): Response {
  if (error.code === '42501') return refuse(403, withInstallLink(error.reason, deps.installLink));
  if (error.code === '22023' || error.code === '23514') return refuse(400, error.reason);
  console.error(`heartbeat: ${error.message}`);
  return refuse(500, 'The heartbeat could not be recorded. Try again.');
}

export async function heartbeat(request: Request, deps: WorkingDeps): Promise<Response> {
  if (!deps.connect) return refuse(503, 'Heartbeats are not available here: this deployment has no database.');
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  if (!auth.ok) return refuse(auth.status, auth.error);

  const tooLarge = () => refuse(413, `A heartbeat carries ${MAX_HEARTBEAT_BYTES / 1024} KiB at most.`);
  if (Number(request.headers.get('content-length') ?? 0) > MAX_HEARTBEAT_BYTES) return tooLarge();
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_HEARTBEAT_BYTES) return tooLarge();
  let sent: unknown;
  try {
    sent = JSON.parse(text);
  } catch {
    return refuse(400, 'The body must be a JSON object.');
  }
  const beat = heartbeatOf(sent);
  if ('problem' in beat) return refuse(400, beat.problem);

  try {
    await workingStore(deps.connect(auth.caller.token)).ping(beat);
  } catch (error) {
    if (!(error instanceof WorkingStoreError)) throw error;
    return refusal(error, deps);
  }
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}
