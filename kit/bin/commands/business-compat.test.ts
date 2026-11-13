// The business read, seen by the kit as shipped in v0.0.613 (PRD 2779's "Old kits keep reading"):
// `business-v0.0.613.txt` is that kit's `omni business show`, kept as it shipped. It refuses the whole
// reply when one persona has a stance it does not know, so the server sends it `excited` for an
// enthusiastic persona unless the reader asks for `stances=2`. This proves the reply sent without it
// keeps every persona, and that this kit asks for it.
import { copyFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it, afterAll, beforeAll } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { business as current } from './business.ts';
import type { Fetch } from '../../lib/ask/client.ts';

/** The shipped reader is text, so the repository's audits do not read it as live code: it is copied beside the current one to run. */
const HERE = dirname(fileURLToPath(import.meta.url));
const COPY = join(HERE, 'business-v0.0.613.run.ts');
let shipped: typeof current;
beforeAll(async () => {
  copyFileSync(join(HERE, 'business-v0.0.613.txt'), COPY);
  shipped = (await import(pathToFileURL(COPY).href) as { business: typeof current }).business;
});
afterAll(() => { rmSync(COPY, { force: true }); });

const HOST = 'omni.test';
const config = `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: https://${HOST}\n`;
const persona = (name: string, stance: string, trade: string) => ({ name, stance, trade, who: `${name} works`, usage: 'every day' });

/** What the server sends for `stances`: `enthusiastic` only to a reader that asked for it, else `excited`. */
const replyFor = (stances: string | null) => ({
  state: 'ok',
  business: { name: 'Acme' },
  product: null,
  claims: [{ id: 'region#1', kind: 'region', value: 'Belgium', source: 'pick', state: 'confirmed', receipt: null, lastSeen: null }],
  personas: [
    persona('Ada', stances === '2' ? 'enthusiastic' : 'excited', 'credit risk analyst'),
    persona('Sam', 'skeptical', 'data analyst'),
  ],
  legal: [],
  glossary: [],
});

/** A reader of the business run against a fake server, with the urls it asked for. */
async function read(command: typeof current, { old }: { old: boolean }) {
  const asked: string[] = [];
  const fetch: Fetch = (sent) => {
    // The shipped kit carried its own client, which never sent stances: the shared one is made to forget it.
    const target = new URL(sent);
    if (old) target.searchParams.delete('stances');
    const url = target.toString();
    asked.push(url);
    return Promise.resolve(new Response(JSON.stringify(replyFor(new URL(url).searchParams.get('stances'))), { status: 200, headers: { 'content-type': 'application/json' } }));
  };
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config } });
  const out: string[] = [];
  const tokens = { read: () => ({ access_token: 'a', refresh_token: 'r' }), write: () => undefined };
  const code = await command.run(['show'], {
    cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: () => true }, tokens, fetch,
    exec: () => '', env: {}, vars: {}, script: '',
  } as never);
  return { code, out: out.join(''), asked };
}

describe('the business read across kits', () => {
  it('the kit of v0.0.613 keeps every persona of the reply sent without stances=2', async () => {
    const run = await read(shipped, { old: true });
    expect(run.asked.map((url) => new URL(url).searchParams.get('stances'))).toEqual([null]);
    expect(run.out).toContain('persona   Ada (excited, credit risk analyst): Ada works');
    expect(run.out).toContain('persona   Sam (skeptical, data analyst): Sam works');
  });

  it('this kit asks for stances=2 and reads enthusiastic and any trade text', async () => {
    const run = await read(current, { old: false });
    expect(run.asked.map((url) => new URL(url).searchParams.get('stances'))).toEqual(['2']);
    expect(run.out).toContain('persona   Ada (enthusiastic, credit risk analyst): Ada works');
    expect(run.out).toContain('persona   Sam (skeptical, data analyst): Sam works');
  });
});
