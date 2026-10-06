import { tokenOf, tokensOf, type AgentToken } from './model';
import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';

// The links' store (PRD 855 s1): the functions of supabase/migrations/20261028090000_agent_tokens.sql,
// called as the signed-in person, so the database decides who may make, list and revoke. A refusal
// keeps Postgres's code and hint: 42501 not a member (or not the maker or an owner), 22023 a bad value
// (its field in the hint), 54000 the 21st live link, P0002 a link the workspace does not hold.

export class AgentTokenStoreError extends Error {
  readonly what: string;
  readonly code: string | undefined;
  readonly hint: string | undefined;
  readonly reason: string;
  constructor(what: string, code: string | undefined, hint: string | undefined, reason: string) {
    super(`${what}: ${reason}`);
    this.what = what;
    this.code = code;
    this.hint = hint;
    this.reason = reason;
  }
}

type Rpc = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

function failed(what: string, error: unknown): AgentTokenStoreError {
  const code = propertyOf(error, 'code');
  const hint = propertyOf(error, 'hint');
  const message = propertyOf(error, 'message');
  return new AgentTokenStoreError(
    what,
    typeof code === 'string' ? code : undefined,
    typeof hint === 'string' ? hint : undefined,
    typeof message === 'string' ? message : 'no answer',
  );
}

export interface AgentTokenStore {
  /** The workspace's links not revoked, newest first. */
  list(workspace: string): Promise<AgentToken[]>;
  /** Makes a link for the caller from a token's hash and last four; the token never reaches here. */
  make(workspace: string, name: string, hash: string, lastFour: string): Promise<AgentToken>;
  /** Revokes a link: its maker, or an owner. */
  revoke(workspace: string, token: string): Promise<AgentToken>;
}

export function agentTokenStore(db: Rpc): AgentTokenStore {
  const one = async (what: string, fn: string, args: Record<string, unknown>) => {
    const { data, error } = await db.rpc(fn, args);
    if (error) throw failed(what, error);
    const token = tokenOf(data);
    if (!token) throw new AgentTokenStoreError(what, undefined, undefined, 'an unexpected answer');
    return token;
  };
  return {
    async list(workspace) {
      const { data, error } = await db.rpc('agent_tokens_list', { p_workspace: workspace });
      if (error) throw failed('list the links', error);
      const tokens = tokensOf(data);
      if (!tokens) throw new AgentTokenStoreError('list the links', undefined, undefined, 'an unexpected answer');
      return tokens;
    },
    make: (workspace, name, hash, lastFour) =>
      one('make a link', 'agent_token_make', { p_workspace: workspace, p_name: name, p_hash: hash, p_last_four: lastFour }),
    revoke: (workspace, token) => one('revoke a link', 'agent_token_revoke', { p_workspace: workspace, p_token: token }),
  };
}
