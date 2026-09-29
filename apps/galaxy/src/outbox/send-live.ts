import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseEnv, supabaseServer } from '../data/supabase-server';
import { dossierGithub } from '../dossier/github/server';
import { sendOpen } from './open';
import { githubUser, type OutboxSource, type SendDeps, type SendStore } from './send';
import type { SendRow } from './sent';

// Ported from archive/outbox-answers-v1:apps/galaxy/src/outbox/send-live.ts (PRD 251, s11); the outbox
// is read through PRD 426's GitHub reader, not a stored copy.
//
// Send's real dependencies (./send.ts): the signed-in person's own Supabase session, so row-level
// security decides who reads a dossier and who records and reads a send
// (supabase/migrations/20261005090000_outbox_sends.sql); the server's one GitHub reader, as the omni-loop
// App, read fresh for a send and cleared once it is posted; and GitHub, as the omni-loop App's user
// authorisation — GITHUB_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET, both server-only. Without them,
// Send is off; without a database, nobody is signed in.

const SEND_COLUMNS = 'id, dossier_id, pr_number, reply, nonce_hash, created_at, posted_at, comment_url, login, counted, error';

type Db = Pick<SupabaseClient, 'from' | 'rpc'>;

/** A store call that failed: which, and the database's code. Never the row. */
export class SendStoreError extends Error {
  constructor(what: string, readonly code: string | undefined, message: string) {
    super(`Could not ${what}: ${message}`);
  }
}

export function sendStore(db: Db): SendStore {
  return {
    async target(dossierId) {
      const { data, error } = await db.from('dossiers').select('id, home_repo, prd').eq('id', dossierId).maybeSingle();
      if (error) throw new SendStoreError('read the dossier', error.code, error.message);
      if (!data) return null;
      const row = data as { id: string; home_repo: string; prd: number | null };
      return { dossierId: row.id, homeRepo: row.home_repo, prd: row.prd };
    },
    async create({ dossierId, prNumber, reply, nonceHash }) {
      const { data, error } = await db.from('outbox_sends')
        .insert({ dossier_id: dossierId, pr_number: prNumber, reply, nonce_hash: nonceHash }).select('id').single();
      if (error) throw new SendStoreError('record the send', error.code, error.message);
      return (data as { id: string }).id;
    },
    async read(sendId) {
      const { data, error } = await db.from('outbox_sends').select(SEND_COLUMNS).eq('id', sendId).maybeSingle();
      if (error) throw new SendStoreError('read the send', error.code, error.message);
      return (data as SendRow | null) ?? null;
    },
    async done(sendId, outcome) {
      const { error } = await db.rpc('outbox_send_done', 'error' in outcome
        ? { p_send: sendId, p_error: outcome.error }
        : { p_send: sendId, p_comment_url: outcome.commentUrl, p_login: outcome.login, p_counted: outcome.counted });
      if (error) throw new SendStoreError('record the outcome', error.code, error.message);
    },
  };
}

/** The server's one reader, read fresh: its cached summary cleared first, so the fresh one is kept. */
function outboxSource(): OutboxSource {
  return {
    async fresh(dossier) {
      const reader = dossierGithub();
      if (!reader) return null;
      reader.forget(dossier.id);
      return reader.summary(dossier);
    },
    forget(dossierId) {
      dossierGithub()?.forget(dossierId);
    },
  };
}

export function sendDeps(): SendDeps {
  const clientId = process.env.GITHUB_APP_CLIENT_ID?.trim() || null;
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET?.trim() || '';
  return {
    clientId: sendOpen() && supabaseEnv() ? clientId : null,
    async store() {
      if (!supabaseEnv()) return null;
      const db = await supabaseServer();
      const { data: { user } } = await db.auth.getUser();
      return user ? sendStore(db) : null;
    },
    outbox: outboxSource(),
    github: () => githubUser({ clientId: clientId ?? '', clientSecret, fetch }),
  };
}
