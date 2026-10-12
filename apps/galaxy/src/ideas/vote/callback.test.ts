import { describe, expect, it, vi } from 'vitest';
import { voterReturn, type VoterCallbackPorts } from './callback';

// A voter coming back from GitHub (PRD 1246, s3): the code becomes a session, the vote pressed while
// signed out is counted, and the voter lands back on the board, never on /signup, whether they are in
// a workspace or not. Supabase is faked.

const IDEA = '00000000-0000-4000-8000-000000000001';

function ports(over: Partial<VoterCallbackPorts> = {}): VoterCallbackPorts & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    exchange: vi.fn((code: string) => { calls.push(`exchange ${code}`); return Promise.resolve({ error: null }); }),
    vote: vi.fn((id: string) => { calls.push(`vote ${id}`); return Promise.resolve(null); }),
    ...over,
  };
}
const query = (q: Record<string, string>) => new URLSearchParams({ next: 'ideas', ...q });

describe('a voter back from GitHub', () => {
  it('counts the vote and lands back on the board', async () => {
    const p = ports();
    expect(await voterReturn(query({ code: 'c', board: 'acme/widgets', vote: IDEA }), p)).toBe('/ideas/acme/widgets');
    expect(p.calls).toEqual(['exchange c', `vote ${IDEA}`]);
  });

  it('lands back on the board even when the vote is refused, and logs why', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const p = ports({ vote: () => Promise.resolve('new row violates row-level security policy') });
    expect(await voterReturn(query({ code: 'c', board: 'acme/widgets', vote: IDEA }), p)).toBe('/ideas/acme/widgets');
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  it('counts no vote for an idea id that is not one', async () => {
    const p = ports();
    expect(await voterReturn(query({ code: 'c', board: 'acme/widgets', vote: 'x; drop table' }), p)).toBe('/ideas/acme/widgets');
    expect(p.calls).toEqual(['exchange c']);
  });

  it('counts no vote when the exchange fails, and says the sign-in did not finish', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const vote = vi.fn<VoterCallbackPorts['vote']>(() => Promise.resolve(null));
    const p = ports({ exchange: () => Promise.resolve({ error: 'invalid flow state' }), vote });
    const back = new URL(await voterReturn(query({ code: 'c', board: 'acme/widgets', vote: IDEA }), p), 'https://galaxy.example');
    expect(back.pathname).toBe('/ideas/acme/widgets');
    expect(back.searchParams.get('signin_error')).toBe('That sign-in could not be finished. Press ▲ again.');
    expect(vote).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('lands back on the board with GitHub\'s refusal', async () => {
    const p = ports();
    const back = new URL(await voterReturn(query({ error: 'access_denied', error_description: 'Nope', board: 'acme/widgets' }), p), 'https://galaxy.example');
    expect(back.pathname).toBe('/ideas/acme/widgets');
    expect(back.searchParams.get('signin_error')).toBe('Nope');
    expect(p.calls).toEqual([]);
  });

  it('lands on the board with no database, counting nothing', async () => {
    expect(await voterReturn(query({ code: 'c', board: 'acme/widgets', vote: IDEA }), null)).toBe('/ideas/acme/widgets');
  });
});

describe('a return path off the allowlist', () => {
  it('is refused: nothing exchanged, nothing voted, back to /play', async () => {
    for (const board of ['//evil.example', 'https://evil.example', 'acme/widgets/../../signup', '']) {
      const p = ports();
      expect(await voterReturn(query({ code: 'c', board, vote: IDEA }), p)).toBe('/play');
      expect(p.calls).toEqual([]);
    }
  });
});
