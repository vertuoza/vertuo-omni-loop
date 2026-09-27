import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseEnv, supabaseServer } from '../data/supabase-server';
import { githubUser, type SendDeps, type SendStore } from './send';
import type { SendRow } from './sent';
import { outboxReader, OutboxStoreError } from './store';

// Send's real dependencies (src/outbox/send.ts): the signed-in person's own Supabase session, so
// row-level security decides who records and reads a send (supabase/migrations/20260929090000_outbox_answers.sql),
// and GitHub, as the omni-loop App's user authorisation — GITHUB_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET,
// both server-only. Without the client id, Send is off; without a database, nobody is signed in.

export const SEND_COLUMNS = 'id, dossier_id, pr_number, reply, nonce_hash, created_at, posted_at, comment_url, login, counted, error';

type Db = Pick<SupabaseClient, 'from' | 'rpc'>;

export function sendStore(db: Db): SendStore {
  return {
    async target(dossierId) {
      const { data, error } = await db.from('dossiers').select('id, prd').eq('id', dossierId).maybeSingle();
      if (error) throw new OutboxStoreError('read the dossier', error.code, error.message);
      if (!data) return null;
      const row = data as { id: string; prd: number | null };
      return { dossierId: row.id, prd: row.prd, outbox: await outboxReader(db).latest(row.id) };
    },
    async create({ dossierId, prNumber, reply, nonceHash }) {
      const { data, error } = await db.from('outbox_sends')
        .insert({ dossier_id: dossierId, pr_number: prNumber, reply, nonce_hash: nonceHash }).select('id').single();
      if (error) throw new OutboxStoreError('record the send', error.code, error.message);
      return (data as { id: string }).id;
    },
    async read(sendId) {
      const { data, error } = await db.from('outbox_sends').select(SEND_COLUMNS).eq('id', sendId).maybeSingle();
      if (error) throw new OutboxStoreError('read the send', error.code, error.message);
      return (data as SendRow | null) ?? null;
    },
    async done(sendId, outcome) {
      const { error } = await db.rpc('outbox_send_done', 'error' in outcome
        ? { p_send: sendId, p_error: outcome.error }
        : { p_send: sendId, p_comment_url: outcome.commentUrl, p_login: outcome.login, p_counted: outcome.counted });
      if (error) throw new OutboxStoreError('record the outcome', error.code, error.message);
    },
  };
}

/** Whether this deployment may send: it knows the omni-loop App's client. */
export const sendConfigured = () => Boolean(process.env.GITHUB_APP_CLIENT_ID && process.env.GITHUB_APP_CLIENT_SECRET && supabaseEnv());

export function sendDeps(): SendDeps {
  const clientId = process.env.GITHUB_APP_CLIENT_ID || null;
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET || '';
  return {
    clientId: sendConfigured() ? clientId : null,
    async store() {
      if (!supabaseEnv()) return null;
      const db = await supabaseServer();
      const { data: { user } } = await db.auth.getUser();
      return user ? sendStore(db) : null;
    },
    github: () => githubUser({ clientId: clientId ?? '', clientSecret, fetch }),
  };
}
