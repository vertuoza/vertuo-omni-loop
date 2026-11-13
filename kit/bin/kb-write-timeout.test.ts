// Bug #2805: when a knowledge write still times out, the terminal never says the page could not be
// reached: the change may be saved, so it says to read the list before trying again, never to retry.
import { describe, expect, it } from 'vitest';
import type { Tokens } from '../lib/ask/schema.ts';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const timingOut = (): Promise<Response> => Promise.reject(Object.assign(new Error('aborted'), { name: 'TimeoutError' }));

async function omni(args: string[]) {
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: https://omni.test\n' } });
  const store: Record<string, Tokens> = { 'omni.test': { access_token: 'access-1', refresh_token: 'refresh-1' } };
  const tokens = { read: (host: string) => store[host] ?? null, write: (host: string, entry: Tokens) => { store[host] = entry; } };
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['kb', ...args], { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) }, tokens, fetch: timingOut, env: {} });
  return { code, out: out.join(''), err: err.join('') };
}

describe('a knowledge write that times out (#2805)', () => {
  it('says the change may be saved and names the read to run, never that the page could not be reached', async () => {
    const result = await omni(['legal', 'add', '--code', 'VAT', '--statement', 's', '--source', 'src']);
    expect(result).toEqual({
      code: 1, out: '',
      err: 'omni kb legal add: the Omni page did not answer in time; the change may be saved: run omni kb legal before you try again\n',
    });
  });

  it('names the same read under --json', async () => {
    const result = await omni(['glossary', 'add', '--term', 'Quote', '--meaning', 'm', '--json']);
    expect(result.code).toBe(1);
    expect(JSON.parse(result.out)).toEqual({ error: 'the Omni page did not answer in time; the change may be saved: run omni kb glossary before you try again' });
  });
});
