import { KitTokensMineSchema, type KitTokensMine } from './terminal-tokens.contract';

// Terminal tokens' database read (PRD 1628 s4): kit_tokens_mine() of 20261204090000_kit_tokens.sql, as
// the signed-in person, so the database hands them their own kit tokens and nobody else's. Revoking goes
// through Connect an agent's route (DELETE /api/agent-tokens, agent_token_revoke()), which clears a kit
// token's stored session. No rule lives here: ./terminal-tokens.service.ts reads what comes back.

type Rpc = { rpc(fn: 'kit_tokens_mine', args: { p_workspace: string }): PromiseLike<{ data: unknown; error: { message: string } | null }> };

export interface TerminalTokensRepository {
  /** Your live kit tokens in `workspace` and your live count; throws when the database fails or answers
   * something else. */
  mine(workspace: string): Promise<KitTokensMine>;
}

export function terminalTokensRepository(db: Rpc): TerminalTokensRepository {
  return {
    async mine(workspace) {
      const { data, error } = await db.rpc('kit_tokens_mine', { p_workspace: workspace });
      if (error) throw new Error(`kit_tokens_mine: ${error.message}`);
      const read = KitTokensMineSchema.safeParse(data);
      if (!read.success) throw new Error('kit_tokens_mine: an unexpected answer');
      return read.data;
    },
  };
}
