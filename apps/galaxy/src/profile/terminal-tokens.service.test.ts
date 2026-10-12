import { afterEach, describe, expect, it, vi } from 'vitest';
import { UNREADABLE } from '../dashboard/part';
import { terminalTokensRepository } from './terminal-tokens.repository';
import { readTerminalTokens } from './terminal-tokens.service';

// Your terminal tokens read for your own profile (PRD 1628 s4), on a fake rpc: kit_tokens_mine() for the
// profile's workspace, newest first; unreadable when the database fails or answers something else.

const TOKEN = { id: 'k-1', name: 'claude-cloud', lastFour: '9fKa', createdAt: '2026-10-01T08:00:00+00:00', lastUsedAt: null, expiresAt: '2026-12-30T08:00:00+00:00' };

function fake(answer: { data?: unknown; error?: { message: string } }) {
  const calls: unknown[][] = [];
  return {
    calls,
    db: {
      rpc: (fn: 'kit_tokens_mine', args: { p_workspace: string }) => {
        calls.push([fn, args]);
        return Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null });
      },
    },
  };
}

afterEach(() => { vi.restoreAllMocks(); });

describe('readTerminalTokens', () => {
  it('reads your kit tokens in the workspace, newest first, with your live count', async () => {
    const newer = { ...TOKEN, id: 'k-2', createdAt: '2026-10-09T08:00:00+00:00', lastUsedAt: '2026-10-10T08:00:00+00:00' };
    // The database lists more than a row needs (its scope, its maker): the page keeps what it shows.
    const { db, calls } = fake({ data: { tokens: [TOKEN, { ...newer, scope: 'kit', maker: { id: 'u-1' } }], live: 5, limit: 20 } });
    const read = await readTerminalTokens(terminalTokensRepository(db), 'ws-1');
    expect(calls).toEqual([['kit_tokens_mine', { p_workspace: 'ws-1' }]]);
    expect(read).toEqual({ tokens: [newer, TOKEN], live: 5, limit: 20 });
  });

  it('is unreadable when the database fails, or answers something else, and says so in the log', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await readTerminalTokens(terminalTokensRepository(fake({ error: { message: 'no such function' } }).db), 'ws-1')).toBe(UNREADABLE);
    expect(await readTerminalTokens(terminalTokensRepository(fake({ data: { tokens: [{ ...TOKEN, lastFour: 'toolong' }], live: 1, limit: 20 } }).db), 'ws-1')).toBe(UNREADABLE);
    expect(log).toHaveBeenCalledTimes(2);
    expect(String(log.mock.calls[0]?.[0])).toContain('no such function');
  });
});
