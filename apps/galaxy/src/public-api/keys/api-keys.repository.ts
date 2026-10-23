import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { orThrow, parseRow, parseRows } from '../../data/parse-rows';
import { ApiKeySchema, type ApiKey } from './api-keys.contract';

// The API keys' reads and writes (PRD 2022 s1; ADR-0095), on the client they are given: the signed-in
// person's own, so the functions of supabase/migrations/20261210090000_api_keys.sql decide who may (an
// owner makes and revokes, any member lists) and row-level security which repositories they read. Each
// answer is parsed where it comes in; a failed read throws, a refused write answers the database's code,
// hint and words. No rule lives here: api-keys.service.ts holds them.
//
// A key's GitHub App (PRD 2433 s4) is the same: supabase/migrations/20261228090000_api_key_github_apps.sql
// lets an owner attach, replace and remove it, any member read its slug and an owner its last token. The
// list joins each key with its App; the sealed private key goes in on attach and never comes out.

export type ApiKeysDb = Pick<SupabaseClient, 'from' | 'rpc'>;

/** A private key sealed by the secret box: what the database keeps of it. */
type SealedKey ={ ciphertext: string; iv: string };

/** A write: its value, or the database's refusal. */
export type Written<T> = { ok: true; value: T } | { ok: false; code: string | null; hint: string | null; message: string };

const WHERE = 'public-api/keys/api-keys.repository';
const IsOwner = z.boolean();
const MadeId = z.string().min(1);
const TrackedRepository = z.object({ full_name: z.string() });
/** A key's App as api_key_github_apps_list() answers: `lastTokenAt` is there for an owner only. */
const ListedApp = z.object({ keyId: z.string().min(1), slug: z.string().min(1), lastTokenAt: z.string().min(1).nullable().optional() });
/** What api_key_github_app_attach() answers. */
const AttachedApp = z.object({ slug: z.string().min(1) });
const RemovedApp = z.boolean();

type Answer = { data: unknown; error: { code?: string; hint?: string; message: string } | null };

const refused = (error: NonNullable<Answer['error']>): { ok: false; code: string | null; hint: string | null; message: string } =>
  ({ ok: false, code: error.code || null, hint: error.hint || null, message: error.message });

export function apiKeysRepository(db: ApiKeysDb) {
  return {
    /** The workspace's live keys, newest first (api_keys_list()), each with its GitHub App, or null (api_key_github_apps_list()). */
    async list(workspace: string): Promise<ApiKey[]> {
      const read = async (fn: string): Promise<Answer> => {
        const answer: Answer = await db.rpc(fn, { p_workspace: workspace });
        return answer;
      };
      const [keys, apps] = await Promise.all([read('api_keys_list'), read('api_key_github_apps_list')]);
      if (keys.error) throw new Error(`Supabase: could not read the API keys (${keys.error.message})`);
      if (apps.error) throw new Error(`Supabase: could not read the API keys' GitHub Apps (${apps.error.message})`);
      const listed = orThrow(parseRows(ApiKeySchema, keys.data, `${WHERE}: api_keys_list`));
      const held = new Map(orThrow(parseRows(ListedApp, apps.data, `${WHERE}: api_key_github_apps_list`)).map((app) => [app.keyId, app]));
      return listed.map((key) => {
        const app = held.get(key.id);
        if (!app) return { ...key, githubApp: null };
        return { ...key, githubApp: app.lastTokenAt === undefined ? { slug: app.slug } : { slug: app.slug, lastTokenAt: app.lastTokenAt } };
      });
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

    /**
     * Attaches the App to a key, or replaces the one it holds (api_key_github_app_attach()): the App's
     * id, its slug and its bot's id, which GitHub has just confirmed, and the private key sealed. Answers
     * the slug it stored. An owner of the key's workspace only, on a live key.
     */
    async attachGithubApp(key: string, appId: number, slug: string, botId: number, sealed: SealedKey): Promise<Written<{ slug: string }>> {
      const answer: Answer = await db.rpc('api_key_github_app_attach', {
        p_key: key, p_app_id: appId, p_slug: slug, p_bot_id: botId, p_ciphertext: sealed.ciphertext, p_iv: sealed.iv,
      });
      if (answer.error) return refused(answer.error);
      const attached = orThrow(parseRow(AttachedApp, answer.data, `${WHERE}: api_key_github_app_attach`));
      return { ok: true, value: { slug: attached.slug } };
    },

    /** Removes a key's App (api_key_github_app_remove()): whether it held one. An owner only. */
    async removeGithubApp(key: string): Promise<Written<boolean>> {
      const answer: Answer = await db.rpc('api_key_github_app_remove', { p_key: key });
      if (answer.error) return refused(answer.error);
      return { ok: true, value: orThrow(parseRow(RemovedApp, answer.data, `${WHERE}: api_key_github_app_remove`)) };
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
