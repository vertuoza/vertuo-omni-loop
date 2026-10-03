import { describe, expect, it, vi } from 'vitest';
import { readOnlyClient, readOnlyFetch } from './parse-rows-client';

// A stand-in for the network: answers every request it is given with an empty list of rows.
const network = () => vi.fn<typeof fetch>(() => Promise.resolve(new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })));

/** The address a request was sent to. */
const hrefOf = (input: string | URL | Request | undefined): string => (input instanceof Request ? input.url : input instanceof URL ? input.href : input ?? '');

describe('readOnlyFetch', () => {
  it('passes a GET or a HEAD through, and refuses any other method without sending it', async () => {
    const base = network();
    const guarded = readOnlyFetch(base);
    await guarded('http://db.test/rest/v1/teams');
    await guarded('http://db.test/rest/v1/teams', { method: 'HEAD' });
    expect(base).toHaveBeenCalledTimes(2);
    for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      await expect(guarded('http://db.test/rest/v1/teams', { method })).rejects.toThrow(`schemas:verify only reads: a ${method} was refused`);
    }
    await expect(guarded(new Request('http://db.test/rest/v1/teams', { method: 'DELETE' }))).rejects.toThrow('a DELETE was refused');
    expect(base).toHaveBeenCalledTimes(2);
  });
});

describe('readOnlyClient', () => {
  const client = (base = network()) => ({ base, db: readOnlyClient('http://db.test', 'service-role', base) });

  it('reads a select, with the key it was given', async () => {
    const { base, db } = client();
    const { data, error } = await db.from('teams').select('name');
    expect({ data, error }).toEqual({ data: [], error: null });
    const [url, init] = base.mock.calls[0] ?? [];
    expect(hrefOf(url)).toBe('http://db.test/rest/v1/teams?select=name');
    expect(new Headers(init?.headers).get('apikey')).toBe('service-role');
  });

  it('reads an rpc called with get: true, which PostgREST runs read-only', async () => {
    const { base, db } = client();
    await db.rpc('business_for_repo', { p_repo: 'vertuoza/a' }, { get: true });
    expect(base).toHaveBeenCalledTimes(1);
  });

  it('writes nothing: an insert, an update, a delete and a posted rpc fail before any request leaves', async () => {
    const { base, db } = client();
    const answers = [
      await db.from('teams').insert({ name: 'x', label: 'X', color: '#fff', motto: '', sort: 1, workspace_id: 'w' }),
      await db.from('teams').update({ label: 'Y' }).eq('name', 'x'),
      await db.from('teams').delete().eq('name', 'x'),
      await db.rpc('business_for_repo', { p_repo: 'vertuoza/a' }),
    ];
    for (const answer of answers) expect(answer.error?.message).toContain('schemas:verify only reads');
    expect(base).not.toHaveBeenCalled();
  });
});
