import { refuse, reply } from '../../business-api/reply';
import { askJev, type JevOutcome, type JevQuestion } from '../client';
import { sealSecret } from '../secret-box';
import { JevStoreError, type JevKeyStatus, type JevStore } from '../store';

// Settings › Jev's key routes (PRD 812 s1), as plain functions of a Request so each route file stays
// one line. Both act as the signed-in person: the database's functions decide who owns the workspace.
//
//   POST   /api/jev/key {workspace, key}   200 {key}: tested with one call to Jev, sealed, stored
//   DELETE /api/jev/key {workspace}        200 {key}: removed, and every decision set Off
//
// Refusals, each `{error}` in plain words: 400 a malformed body, 401 signed out, 403 not the owner,
// 422 the test call failed (TypeSafe's reason), 500 the database failed, 503 no SECRETS_MASTER_KEY on
// this deployment (nothing can be saved). A key is only ever stored after its test call answered; a
// non-owner's key is never sent to TypeSafe.

export const NOT_AVAILABLE = 'Jev is not available on this deployment.';
export const ONLY_OWNER = 'Only the workspace’s owner can change its Jev settings.';

/** What the key's one test call asks: a Noul about a fixed text, nothing of the workspace's. */
const KEY_CHECK_STATE = 'Omni Loop is checking that this TypeSafe API key works.';
export const KEY_CHECK: JevQuestion = { type: 'noul', statement: 'This text is a key check.' };

/** The one test call a pasted key gets before it is stored. */
export function keyCheck(key: string, fetch: typeof globalThis.fetch): Promise<JevOutcome> {
  return askJev({ key, state: KEY_CHECK_STATE, question: KEY_CHECK, fetch });
}

export interface KeyRouteDeps {
  /** The store as the signed-in person, or null when nobody is signed in (or no database). */
  store: () => Promise<Pick<JevStore, 'isOwner' | 'setKey' | 'removeKey'> | null>;
  /** The deployment's master key, or null when SECRETS_MASTER_KEY is missing or malformed. */
  master: () => Buffer | null;
  /** The test call (keyCheck, with the real fetch). */
  test: (key: string) => Promise<JevOutcome>;
}

const NO_KEY: JevKeyStatus = { stored: false, lastFour: null, setAt: null };

const id = (value: unknown) => (typeof value === 'string' && value.length > 0 && value.length <= 64 ? value : null);
const keyOf = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const key = value.trim();
  return key.length >= 8 && key.length <= 512 && !/\s/.test(key) ? key : null;
};

async function bodyOf(request: Request): Promise<Record<string, unknown> | null> {
  const sent: unknown = await request.json().catch(() => null);
  return sent && typeof sent === 'object' && !Array.isArray(sent) ? (sent as Record<string, unknown>) : null;
}

/** What the page says when the test call failed. */
export function testRefusal(outcome: Extract<JevOutcome, { kind: 'failed' }>): string {
  switch (outcome.reason) {
    case 'status':
      return `TypeSafe refused this key: ${outcome.message}`;
    case 'timeout':
      return 'TypeSafe did not answer the test call in time. Nothing was saved; try again.';
    case 'network':
      return 'TypeSafe could not be reached for the test call. Nothing was saved; try again.';
    case 'schema':
      return 'TypeSafe answered the test call in a shape Omni Loop does not read. Nothing was saved.';
  }
}

function refusal(error: unknown, what: string): Response {
  if (error instanceof JevStoreError && error.code === '42501') return refuse(403, ONLY_OWNER);
  console.error(`jev: ${what} failed (${error instanceof Error ? error.message : String(error)})`);
  return refuse(500, 'The database could not answer. Try again.');
}

export async function saveKeyRoute(request: Request, deps: KeyRouteDeps): Promise<Response> {
  const master = deps.master();
  if (!master) return refuse(503, NOT_AVAILABLE);
  const store = await deps.store();
  if (!store) return refuse(401, 'Sign in first.');
  const body = await bodyOf(request);
  const workspace = id(body?.workspace);
  const key = keyOf(body?.key);
  if (!workspace || !key) return refuse(400, 'Send the workspace and the whole API key, as TypeSafe shows it.');
  try {
    if (!(await store.isOwner(workspace))) return refuse(403, ONLY_OWNER);
  } catch (error) {
    return refusal(error, 'reading the role');
  }
  const outcome = await deps.test(key);
  if (outcome.kind === 'failed') return refuse(422, testRefusal(outcome));
  try {
    return reply(200, { key: await store.setKey(workspace, sealSecret(key, master)) });
  } catch (error) {
    return refusal(error, 'saving the key');
  }
}

export async function removeKeyRoute(request: Request, deps: Pick<KeyRouteDeps, 'store'>): Promise<Response> {
  const store = await deps.store();
  if (!store) return refuse(401, 'Sign in first.');
  const workspace = id((await bodyOf(request))?.workspace);
  if (!workspace) return refuse(400, 'Send the workspace.');
  try {
    await store.removeKey(workspace);
    return reply(200, { key: NO_KEY });
  } catch (error) {
    return refusal(error, 'removing the key');
  }
}
