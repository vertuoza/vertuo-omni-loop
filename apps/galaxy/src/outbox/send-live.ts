import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import { supabaseEnv, supabaseServer } from '../data/supabase-server';
import { serviceDb } from '../data/sign-in-live';
import { serverEnv, type GithubOAuthEnv } from '../env';
import { dossierGithub } from '../dossier/github/server';
import { recountLive } from '../stages/outbox/live';
import { liveSendSnapshot, liveStaleSnapshot } from '../dossier/snapshot/live';
import { sendOpen } from './open';
import { githubUser, type OutboxSource, type SendDeps, type SendStore } from './send';
import { parsePr, parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';

// Ported from archive/outbox-answers-v1:apps/galaxy/src/outbox/send-live.ts (PRD 251, s11); the outbox
// is read through PRD 426's GitHub reader, not a stored copy.
//
// Send's real dependencies (./send.ts): the signed-in person's own Supabase session, so row-level
// security decides who reads a dossier and who records and reads a send
// (supabase/migrations/20261005090000_outbox_sends.sql); the server's one GitHub reader, as the omni-loop
// App, read fresh for a send and cleared once it is posted; and GitHub, as the omni-loop App's user
// authorisation — GITHUB_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET, both server-only. Without them,
// Send is off; without a database, nobody is signed in. PRD 657 (s5): once a reply is posted, its PRD's
// open questions are recounted into prd_outbox as the service role (src/stages/outbox/live.ts). PRD 902
// (s2): the fresh read is `interactive` and stored as the dossier's GitHub snapshot, which a posted reply
// marks stale before the recount.

const SEND_COLUMNS = 'id, dossier_id, pr_number, reply, nonce_hash, created_at, posted_at, comment_url, login, counted, error';

type Db = Pick<SupabaseClient<Database>, 'from' | 'rpc'>;

/** A store call that failed: which, and the database's code. Never the row. */
export class SendStoreError extends Error {
  readonly code: string | undefined;
  constructor(what: string, code: string | undefined, message: string) {
    super(`Could not ${what}: ${message}`);
    this.code = code;
  }
}

export function sendStore(db: Db): SendStore {
  return {
    async target(dossierId) {
      const { data, error } = await db.from('dossiers').select('id, home_repo, prd').eq('id', dossierId).maybeSingle();
      if (error) throw new SendStoreError('read the dossier', error.code, error.message);
      if (!data) return null;
      const row = data;
      return { dossierId: row.id, homeRepo: row.home_repo, prd: row.prd === null ? null : parsePrd(row.prd) };
    },
    async create({ dossierId, prNumber, reply, nonceHash }) {
      const { data, error } = await db.from('outbox_sends')
        .insert({ dossier_id: dossierId, pr_number: prNumber, reply, nonce_hash: nonceHash }).select('id').single();
      if (error) throw new SendStoreError('record the send', error.code, error.message);
      return data.id;
    },
    async read(sendId) {
      const { data, error } = await db.from('outbox_sends').select(SEND_COLUMNS).eq('id', sendId).maybeSingle();
      if (error) throw new SendStoreError('read the send', error.code, error.message);
      return data ? { ...data, pr_number: parsePr(data.pr_number) } : null;
    },
    async done(sendId, outcome) {
      const { error } = await db.rpc('outbox_send_done', 'error' in outcome
        ? { p_send: sendId, p_error: outcome.error }
        : { p_send: sendId, p_comment_url: outcome.commentUrl, p_login: outcome.login, p_counted: outcome.counted });
      if (error) throw new SendStoreError('record the outcome', error.code, error.message);
    },
  };
}

/** The dossier's workspace, as the service role reads it; null when there is no such dossier. */
async function workspaceOf(dossierId: string): Promise<string | null> {
  const { data, error } = await serviceDb().from('dossiers').select('workspace_id').eq('id', dossierId).maybeSingle();
  if (error) throw new SendStoreError('read the dossier\'s workspace', error.code, error.message);
  return data?.workspace_id ?? null;
}

/** The server's one reader, read fresh and `interactive` (PRD 902, s2): stored as the dossier's GitHub
 * snapshot, its cached summary cleared first. */
function outboxSource(): OutboxSource {
  return {
    async fresh(dossier) {
      const reader = dossierGithub();
      if (!reader) return null;
      const workspace = await workspaceOf(dossier.id);
      if (workspace === null) return null;
      return liveSendSnapshot({ ...dossier, workspace_id: workspace });
    },
    forget(dossierId) {
      dossierGithub()?.forget(dossierId);
    },
  };
}

/** Recounts the dossier's PRD, found as the service role, its GitHub snapshot marked stale first so the
 * recount reads the reply just posted; a draft, or no dossier, recounts nothing. */
async function recountDossier(dossierId: string): Promise<void> {
  await liveStaleSnapshot(dossierId);
  const { data, error } = await serviceDb().from('dossiers').select('workspace_id, home_repo, prd').eq('id', dossierId).maybeSingle();
  if (error) throw new SendStoreError('read the dossier to recount', error.code, error.message);
  const row = data;
  if (!row || row.prd === null) return;
  await recountLive(row.workspace_id, [{ repository: row.home_repo, prd: parsePrd(row.prd), id: dossierId }]);
}

/** The App's OAuth client while this deployment may send (./open.ts), or none. */
function sendClient(): GithubOAuthEnv | null {
  return sendOpen() ? serverEnv().githubOAuth : null;
}

const NO_CLIENT: GithubOAuthEnv = { clientId: '', clientSecret: '' };

export function sendDeps(): SendDeps {
  const client = sendClient();
  return {
    clientId: client?.clientId ?? null,
    async store() {
      if (!supabaseEnv()) return null;
      const db = await supabaseServer();
      const { data: { user } } = await db.auth.getUser();
      return user ? sendStore(db) : null;
    },
    outbox: outboxSource(),
    github: () => githubUser({ ...(client ?? NO_CLIENT), fetch }),
    recount: recountDossier,
  };
}
