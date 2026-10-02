import { describe, it, expect } from 'vitest';
import type { DossierListRow } from '../store';
import { findAt, outboxTabPath, readAt, atCallbackPath, atPath, atSignInReturn } from './history-at';

// /prd/at/<owner>/<repo>/<n> (PRD 251, s10): the short address the kit's outbox comment writes, knowing
// only the repository and the PRD. It names a dossier by its home repository and PRD among the ones the
// viewer may read, and lands on its Outbox tab; anything else is not found.

const row = (id: string, more: Partial<DossierListRow> = {}): DossierListRow => ({
  id, workspace_id: 'w1', home_repo: 'vertuoza/vertuo-omni-loop', prd: null, title: 'An idea', opened_by: 'u-pierre',
  created_at: '2026-09-20T09:00:00Z', numbered_at: null, repos: ['vertuoza/vertuo-omni-loop'], latest: {}, asked: 0, answered: 0,
  last_activity: '2026-09-20T09:00:00Z', ...more,
});

describe('the address', () => {
  it('reads an owner, a repository and a PRD number', () => {
    expect(readAt({ owner: 'vertuoza', repo: 'vertuo-omni-loop', n: '251' })).toEqual({ owner: 'vertuoza', repo: 'vertuo-omni-loop', prd: 251 });
    expect(readAt({ owner: 'Vertuoza', repo: 'my.repo_2', n: '7' })).toEqual({ owner: 'Vertuoza', repo: 'my.repo_2', prd: 7 });
    expect(readAt({ owner: 'vertuoza', repo: 'vertuo%2Domni', n: '1' })).toEqual({ owner: 'vertuoza', repo: 'vertuo-omni', prd: 1 });
  });

  it('names nothing for a PRD that is not a positive number, or a name GitHub would not give', () => {
    for (const n of ['0', '-1', '07', '1.5', 'abc', '', '1234567890']) expect(readAt({ owner: 'a', repo: 'b', n }), n).toBeNull();
    for (const name of ['', '.', '..', 'a b', 'a/b', '%2F', '%E0%A4%A', 'x'.repeat(101)]) {
      expect(readAt({ owner: name, repo: 'b', n: '1' }), name).toBeNull();
      expect(readAt({ owner: 'a', repo: name, n: '1' }), name).toBeNull();
    }
  });

  it('writes the address back, and its sign-in callback beside it', () => {
    const key = { owner: 'vertuoza', repo: 'vertuo-omni-loop', prd: 251 };
    expect(atPath(key)).toBe('/prd/at/vertuoza/vertuo-omni-loop/251');
    expect(atCallbackPath(key)).toBe('/prd/at/vertuoza/vertuo-omni-loop/251/callback');
  });
});

describe('the dossier it names', () => {
  const ROWS = [
    row('00000000-0000-4000-8000-0000000000d1', { prd: 251 }),
    row('00000000-0000-4000-8000-0000000000d2', { prd: 216, home_repo: 'vertuoza/vertuo-core' }),
    row('00000000-0000-4000-8000-0000000000d3', { prd: null }),
  ];

  it('is the dossier with that home repository and PRD, the repository in any case', () => {
    expect(findAt(ROWS, { owner: 'Vertuoza', repo: 'Vertuo-Omni-Loop', prd: 251 })).toBe('00000000-0000-4000-8000-0000000000d1');
    expect(findAt(ROWS, { owner: 'vertuoza', repo: 'vertuo-core', prd: 216 })).toBe('00000000-0000-4000-8000-0000000000d2');
  });

  it('is none for another repository, another PRD, or a dossier the viewer may not read (absent from the rows)', () => {
    expect(findAt(ROWS, { owner: 'vertuoza', repo: 'vertuo-core', prd: 251 })).toBeNull();
    expect(findAt(ROWS, { owner: 'vertuoza', repo: 'vertuo-omni-loop', prd: 999 })).toBeNull();
    expect(findAt([], { owner: 'vertuoza', repo: 'vertuo-omni-loop', prd: 251 })).toBeNull();
  });

  it('lands on its Outbox tab', () => {
    expect(outboxTabPath('00000000-0000-4000-8000-0000000000d1')).toBe('/prd/00000000-0000-4000-8000-0000000000d1?tab=outbox');
  });
});

describe('coming back from the sign-in', () => {
  const key = { owner: 'vertuoza', repo: 'vertuo-omni-loop', prd: 251 };
  const ORIGIN = 'https://omni.example.test';
  const back = (query: string) => new URL(`${ORIGIN}/prd/at/vertuoza/vertuo-omni-loop/251/callback${query}`);

  it('exchanges the code, joins, and goes back to the same short address', async () => {
    const calls: string[] = [];
    const to = await atSignInReturn(back('?code=c1'), ORIGIN, key, (code) => {
      calls.push(`exchange ${code}`);
      return Promise.resolve({ error: null });
    }, () => Promise.resolve(calls.push('join')));
    expect(to).toBe(`${ORIGIN}/prd/at/vertuoza/vertuo-omni-loop/251`);
    expect(calls).toEqual(['exchange c1', 'join']);
  });

  it('carries a refusal back to the short address', async () => {
    const to = await atSignInReturn(back('?error=access_denied'), ORIGIN, key, null, null);
    expect(to).toBe(`${ORIGIN}/prd/at/vertuoza/vertuo-omni-loop/251?signin_error=access_denied`);
  });

  it('goes to the history when the address names no PRD', async () => {
    expect(await atSignInReturn(back(''), ORIGIN, null, null, null)).toBe(`${ORIGIN}/prd`);
  });
});
