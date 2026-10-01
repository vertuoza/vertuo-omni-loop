import { describe, expect, it, vi } from 'vitest';
import { loadTokens } from './load';
import { agentTokenStore, AgentTokenStoreError } from './store';

// The links' store against a fake rpc (PRD 855 s1): each call names its function and arguments, reads
// back a link (never a hash), and keeps a refusal's code and hint.

const LINK = {
  id: 't-1', name: 'Tom’s editor', lastFour: 'Zz09', createdAt: '2026-10-01T08:00:00+00:00', lastUsedAt: null,
  maker: { id: 'u-1', login: 'tom', name: null }, mine: false, canRevoke: true, working: true,
};

function fake(answer: { data?: unknown; error?: unknown }) {
  const calls: unknown[][] = [];
  return { calls, db: { rpc: async (fn: string, args: Record<string, unknown>) => { calls.push([fn, args]); return { data: answer.data ?? null, error: answer.error ?? null }; } } };
}

describe('agentTokenStore', () => {
  it('lists, makes and revokes through the three functions', async () => {
    const list = fake({ data: [LINK] });
    expect(await agentTokenStore(list.db).list('ws-1')).toEqual([LINK]);
    expect(list.calls).toEqual([['agent_tokens_list', { p_workspace: 'ws-1' }]]);

    const make = fake({ data: LINK });
    expect(await agentTokenStore(make.db).make('ws-1', 'Tom’s editor', 'a'.repeat(64), 'Zz09')).toEqual(LINK);
    expect(make.calls).toEqual([['agent_token_make', { p_workspace: 'ws-1', p_name: 'Tom’s editor', p_hash: 'a'.repeat(64), p_last_four: 'Zz09' }]]);

    const revoke = fake({ data: LINK });
    await agentTokenStore(revoke.db).revoke('ws-1', 't-1');
    expect(revoke.calls).toEqual([['agent_token_revoke', { p_workspace: 'ws-1', p_token: 't-1' }]]);
  });

  it('keeps a refusal’s code, hint and reason', async () => {
    const { db } = fake({ error: { code: '22023', hint: 'name', message: 'Name: you already have a link named X.' } });
    const err = await agentTokenStore(db).make('ws-1', 'X', 'a'.repeat(64), 'abcd').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AgentTokenStoreError);
    expect(err).toMatchObject({ code: '22023', hint: 'name', reason: 'Name: you already have a link named X.' });
  });

  it('refuses an answer that is not a link', async () => {
    await expect(agentTokenStore(fake({ data: { id: 't-1' } }).db).revoke('ws-1', 't-1')).rejects.toThrow('an unexpected answer');
    await expect(agentTokenStore(fake({ data: [{ ...LINK, hash: undefined, lastFour: 'toolong' }] }).db).list('ws-1')).rejects.toThrow('an unexpected answer');
  });
});

describe('loadTokens', () => {
  it('reads the list, and none when it cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await loadTokens(fake({ data: [LINK] }).db, 'ws-1')).toEqual([LINK]);
    expect(await loadTokens(fake({ error: { code: 'PGRST202', message: 'no such function' } }).db, 'ws-1')).toEqual([]);
  });
});
