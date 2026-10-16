import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { orThrow, parseRow, parseRows } from '../../data/parse-rows';
import { ApiKeySchema, type ApiKey } from './api-keys.contract';

// The API keys' reads and writes (PRD 2022 s1; ADR-0095), on the client they are given: the signed-in
// person's own, so the functions of supabase/migrations/20261210090000_api_keys.sql decide who may (an
// owner makes and revokes, any member lists) and row-level security which repositories they read. Each
// answer is parsed where it comes in; a failed read throws, a refused write answers the database's code,
// hint and words. No rule lives here: api-keys.service.ts holds them.

export type ApiKeysDb = Pick<SupabaseClient, 'from' | 'rpc'>;

/** A write: its value, or the database's refusal. */
export type Written<T> = { ok: true; value: T } | { ok: false; code: string | null; hint: string | null; message: string };

const WHERE = 'public-api/keys/api-keys.repository';
const IsOwner = z.boolean();
const MadeId = z.string().min(1);
const TrackedRepository = z.object({ full_name: z.string() });

type Answer = { data: unknown; error: { code?: string; hint?: string; message: string } | null };

const refused = (error: NonNullable<Answer['error']>): { ok: false; code: string | null; hint: string | null; message: string } =>
  ({ ok: false, code: error.code || null, hint: error.hint || null, message: error.message });

export function apiKeysRepository(db: ApiKeysDb) {
  return {
    /** The workspace's live keys, newest first (api_keys_list()). */
    async list(workspace: string): Promise<ApiKey[]> {
      const answer: Answer = await db.rpc('api_keys_list', { p_workspace: workspace });
      if (answer.error) throw new Error(`Supabase: could not read the API keys (${answer.error.message})`);
      return orThrow(parseRows(ApiKeySchema, answer.data, `${WHERE}: api_keys_list`));
    },

    /** Makes a key from its secret's hash and last four (api_key_make()): the new key's id. */
    async make(workspace: string, name: string, repos: string[], hash: string, lastFour: string): Promise<Written<string>> {
      const answer: Answer = await db.rpc('api_key_make', { p_workspace: workspace, p_name: name, p_repos: repos, p_hash: hash, p_last_four: lastFour });
      if (answer.error) return refused(answer.error);
      return { ok: true, value: orThrow(parseRow(MadeId, answer.data, `${WHERE}: api_key_make`)) };
    },

    /** Revokes a key (api_key_revoke()): the key as listed, revoked. */
    async revoke(workspace: string, key: string): Promise<Written<ApiKey>> {
      const answer: Answer = await db.rpc('api_key_revoke', { p_workspace: workspace, p_key: key });
      if (answer.error) return refused(answer.error);
      return { ok: true, value: orThrow(parseRow(ApiKeySchema, answer.data, `${WHERE}: api_key_revoke`)) };
    },

    /** Whether the caller owns the workspace. */
    async owner(workspace: string): Promise<boolean> {
      const answer: Answer = await db.rpc('is_owner', { workspace });
      if (answer.error) throw new Error(`Supabase: could not read your role (${answer.error.message})`);
      return orThrow(parseRow(IsOwner, answer.data, `${WHERE}: is_owner`));
    },

    /** The repositories the workspace tracks, by `owner/name`: what an allow-list may name. */
    async tracked(workspace: string): Promise<string[]> {
      const { data, error } = await db.from('repositories').select('full_name').eq('workspace_id', workspace).eq('tracked', true).order('full_name');
      if (error) throw new Error(`Supabase: could not read the repositories (${error.message})`);
      return orThrow(parseRows(TrackedRepository, data, `${WHERE}: repositories`)).map((r) => r.full_name);
    },
  };
}

export type ApiKeysRepository = ReturnType<typeof apiKeysRepository>;
