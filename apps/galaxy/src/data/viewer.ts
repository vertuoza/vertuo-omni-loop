import 'server-only';
import { cache } from 'react';
import type { JwtPayload, User, UserIdentity } from '@supabase/supabase-js';
import { readWaitingQuestions } from '../waiting/source';
import type { WaitingQuestion } from '../waiting/waiting';
import { arcadeMode, type ArcadeMode } from './mode';
import { supabaseEnv, supabaseServer } from './supabase-server';
import { memberWorkspace, type Workspace } from './workspace';

// Who is looking at an app page, decided once per request (PRD 657): the demo in development (or
// OMNI_LOOP_DEMO=1); with no database, closed; signed out, the sign-in card; signed in, the database
// as that person (row-level security decides what each read returns), the user read from the session's
// claims, their member workspace and the questions waiting for them. viewer() is wrapped in React's
// cache(), so the layout and the page share one client, one claims read, one workspace read and one
// questions read. The claims come from auth.getClaims(), which checks the JWT locally when the project
// signs with asymmetric keys: no call to Supabase Auth. The proxy (proxy.ts) refreshed the session
// before the render.

export type ViewerEnv = { url: string; key: string };
export type ViewerDb = Awaited<ReturnType<typeof supabaseServer>>;

export type Viewing =
  | { kind: 'demo' }
  | { kind: 'closed' }
  | { kind: 'sign-in'; db: ViewerDb; env: ViewerEnv }
  | {
      kind: 'signed-in';
      db: ViewerDb;
      env: ViewerEnv;
      user: User;
      /** The workspace they joined first, or null: read once, when first asked. Rejects when it
       * cannot be read. */
      workspace(): Promise<Workspace | null>;
      /** The waiting list's Questions part: read once, when first asked. Rejects when it cannot be read. */
      questions(): Promise<WaitingQuestion[]>;
    };

/** Where the viewer is read from: the live ones in production, fakes in a test. */
export interface ViewerDeps {
  mode(): ArcadeMode;
  env(): ViewerEnv | null;
  client(): Promise<ViewerDb>;
  questions(db: ViewerDb, userId: string, now: number): Promise<WaitingQuestion[]>;
  now(): number;
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** A Supabase user as the claims carry it: id, email and both metadata. The claims hold no identity
 * list, so a GitHub sign-in's login (its metadata's user_name, else preferred_username) stands in as
 * the one linked GitHub identity the app reads. */
export function userOfClaims(claims: JwtPayload): User {
  const meta: Record<string, unknown> = claims.user_metadata ?? {};
  const app: Record<string, unknown> = claims.app_metadata ?? {};
  const providers = Array.isArray(app.providers) ? app.providers : [app.provider];
  const userName = text(meta.user_name);
  const preferred = text(meta.preferred_username);
  const github = providers.includes('github') && (userName || preferred);
  const identities: UserIdentity[] = github
    ? [{ id: claims.sub, user_id: claims.sub, identity_id: claims.sub, provider: 'github', identity_data: { user_name: userName, preferred_username: preferred } }]
    : [];
  return {
    id: claims.sub,
    aud: typeof claims.aud === 'string' ? claims.aud : 'authenticated',
    ...(claims.email === undefined ? {} : { email: claims.email }),
    ...(claims.phone === undefined ? {} : { phone: claims.phone }),
    role: claims.role,
    ...(claims.is_anonymous === undefined ? {} : { is_anonymous: claims.is_anonymous }),
    app_metadata: app,
    user_metadata: meta,
    created_at: '',
    identities,
  };
}

/** A read started at most once: the first call's promise, every call after. */
function once<T>(read: () => Promise<T>): () => Promise<T> {
  let kept: Promise<T> | null = null;
  return () => (kept ??= read());
}

async function claimsOf(db: ViewerDb): Promise<JwtPayload | null> {
  try {
    const { data, error } = await db.auth.getClaims();
    return error || !data ? null : data.claims;
  } catch (error) {
    console.error(error);
    return null;
  }
}

/** This request's viewer, read from `deps`. */
export async function readViewing(deps: ViewerDeps): Promise<Viewing> {
  const mode = deps.mode();
  if (mode === 'demo') return { kind: 'demo' };
  const env = deps.env();
  if (mode === 'closed' || !env) return { kind: 'closed' };
  const db = await deps.client();
  const claims = await claimsOf(db);
  if (!claims?.sub) return { kind: 'sign-in', db, env };
  const user = userOfClaims(claims);
  return {
    kind: 'signed-in', db, env, user,
    workspace: once(() => memberWorkspace(db, user.id)),
    questions: once(() => deps.questions(db, user.id, deps.now())),
  };
}

type Memo = <T>(read: () => T) => () => T;

/** The viewer read through `memo`: React's cache() in production, one read per request. */
export const viewerOf = (deps: ViewerDeps, memo: Memo) => memo(() => readViewing(deps));

const LIVE: ViewerDeps = {
  mode: () => arcadeMode(process.env),
  env: supabaseEnv,
  client: supabaseServer,
  questions: (db, userId, now) => readWaitingQuestions(db, userId, now),
  now: Date.now,
};

/** This request's viewer: read once, however many times the layout and the page ask. */
export const viewer = viewerOf(LIVE, cache);
