// Sign-up's storage (PRD 359), the only place it touches the database: create_workspace_from_installation()
// and the signup_requests table (supabase/migrations/20261001090000_github_sign_up.sql). `db` is the
// service role's client, the one role that may run the function and write the table.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Installation, WorkspaceMade } from './installation';

const Made = z.object({
  workspace_id: z.string(),
  slug: z.string(),
  role: z.enum(['owner', 'member']),
  created: z.boolean(),
});

const fail = (what: string, message: string) => new Error(`Supabase: could not ${what} (${message})`);

export function signupStore(db: Pick<SupabaseClient, 'rpc' | 'from'>) {
  return {
    async createWorkspace(userId: string, { id, account }: Installation): Promise<WorkspaceMade> {
      const { data, error } = await db.rpc('create_workspace_from_installation', {
        p_user_id: userId, p_installation_id: id, p_login: account.login, p_type: account.type,
      });
      if (error) throw fail('make the workspace', error.message);
      const made = Made.safeParse(data);
      if (!made.success) throw new Error('Supabase: create_workspace_from_installation() answered an odd shape');
      const { workspace_id, slug, role, created } = made.data;
      return { workspaceId: workspace_id, slug, role, created };
    },
    async pendingRequests(userId: string): Promise<string[]> {
      const { data, error } = await db.from('signup_requests').select('github_org').eq('user_id', userId);
      if (error) throw fail('read your sign-up requests', error.message);
      return ((data ?? []) as { github_org: string }[]).map((r) => r.github_org);
    },
    async recordRequest(userId: string, org: string): Promise<void> {
      const { error } = await db.from('signup_requests')
        .upsert({ user_id: userId, github_org: org }, { onConflict: 'user_id,github_org', ignoreDuplicates: true });
      if (error) throw fail('record your sign-up request', error.message);
    },
    async dropRequest(userId: string, org: string): Promise<void> {
      const { error } = await db.from('signup_requests').delete().eq('user_id', userId).eq('github_org', org);
      if (error) throw fail('close your sign-up request', error.message);
    },
  };
}
