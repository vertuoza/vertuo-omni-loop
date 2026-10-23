// `omni rewind facts` and `omni rewind push` (PRD 2410, s5), seen from the outside: through `main()` on a
// fixture repository, against a small server that answers the two routes, with the sign-in an in-memory store.
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { Tokens } from '../lib/ask/schema.ts';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const servers: Server[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

type Answer = { status: number; body: unknown };
type Seen = { method: string; url: string; body: unknown };

const FACTS = {
  watches: [{ lane: 'acme/widgets', status: 'broke', merge_sha: 'a'.repeat(40), merged_at: '2026-10-01T09:00:00Z', watch_until: '2026-10-08T09:00:00Z', unread: [] }],
  breaks: [{ lane: 'acme/widgets', kind: 'ci-red', source: 'run-1', url: 'https://github.com/acme/widgets/actions/runs/1', title: 'lint job', parent: 'green', at: '2026-10-02T09:00:00Z' }],
  findings: [],
};

async function checkout(answer: (seen: Seen) => Answer) {
  const seen: Seen[] = [];
  const server = createServer((request, response) => {
    let text = '';
    request.on('data', (chunk: Buffer) => { text += chunk.toString(); });
    request.on('end', () => {
      const call: Seen = { method: request.method ?? '', url: request.url ?? '', body: text === '' ? null : (JSON.parse(text) as unknown) };
      seen.push(call);
      const { status, body } = answer(call);
      response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const host = typeof address === 'object' && address ? `127.0.0.1:${String(address.port)}` : '';
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: http://${host}\n` } });
  const store: Record<string, Tokens> = { [host]: { access_token: 'access-1', refresh_token: 'refresh-1' } };
  const tokens = { read: (h: string) => store[h] ?? null, write: (h: string, entry: Tokens) => { store[h] = entry; } };
  return { root, tokens, seen };
}

async function omni(args: string[], { root, tokens }: { root: string; tokens: unknown }) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['rewind', ...args], { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) }, tokens, env: {} });
  return { code, out: out.join(''), err: err.join('') };
}

const FINDING = { check: 'ci', origin: 'repository', happened: 'The lint job was red on the slice and merged anyway.', evidence: ['https://github.com/acme/widgets/actions/runs/1'], fix: 'Make the lint a required check.' };

function sentFile(run: { root: string }, content: unknown) {
  writeFileSync(join(run.root, 'findings.json'), typeof content === 'string' ? content : JSON.stringify(content));
  return ['--file', 'findings.json'];
}

describe('omni rewind facts', () => {
  it('prints the status per repository and each break', async () => {
    const run = await checkout(() => ({ status: 200, body: FACTS }));
    const result = await omni(['facts', '7'], run);
    expect(result.code).toBe(0);
    expect(result.out).toContain('acme/widgets: broke');
    expect(result.out).toContain('ci-red · lint job');
    expect(result.out).toContain('https://github.com/acme/widgets/actions/runs/1');
    expect(result.out).toContain('Findings: none yet.');
    expect(run.seen).toEqual([{ method: 'GET', url: '/api/rewind/facts?repo=acme%2Fwidgets&prd=7', body: null }]);
  });

  it('says when the PRD has no watch', async () => {
    const run = await checkout(() => ({ status: 200, body: { watches: [], breaks: [], findings: [] } }));
    const result = await omni(['facts', '7'], run);
    expect(result.code).toBe(0);
    expect(result.out).toContain('PRD 7 has no watch on main');
  });

  it('prints the reply with --json, and the server\'s refusal as one line', async () => {
    const run = await checkout(() => ({ status: 200, body: FACTS }));
    expect(JSON.parse((await omni(['facts', '7', '--json'], run)).out)).toEqual(FACTS);
    const refused = await checkout(() => ({ status: 403, body: { error: 'Only a member reads this.' } }));
    expect(await omni(['facts', '7'], refused)).toEqual({ code: 1, out: '', err: 'omni rewind facts: Only a member reads this.\n' });
  });
});

describe('omni rewind push', () => {
  it('sends the findings, evidence sorted, to the PRD\'s page', async () => {
    const run = await checkout(() => ({ status: 200, body: { added: 1 } }));
    const more = { ...FINDING, evidence: ['https://b.test/x', 'https://a.test/y'] };
    const result = await omni(['push', '7', ...sentFile(run, [more])], run);
    expect(result.code).toBe(0);
    expect(result.out).toContain('1 finding(s) sent');
    expect(run.seen).toEqual([{ method: 'POST', url: '/api/rewind/findings', body: { repo: 'acme/widgets', prd: 7, findings: [{ ...more, evidence: ['https://a.test/y', 'https://b.test/x'] }] } }]);
  });

  it.each([
    ['no evidence link', { ...FINDING, evidence: [] }, 'finding 1: no evidence link'],
    ['evidence that is not a link', { ...FINDING, evidence: ['see the log'] }, 'finding 1: evidence'],
    ['an unknown origin', { ...FINDING, origin: 'production' }, 'finding 1: origin must be one of repository, omni-setup, knowledge'],
    ['an unknown check', { ...FINDING, check: 'vibes' }, 'finding 1: check must be one of'],
  ])('refuses %s, naming the finding, and calls nothing', async (_, bad, line) => {
    const run = await checkout(() => ({ status: 200, body: { added: 1 } }));
    const result = await omni(['push', '7', ...sentFile(run, [bad])], run);
    expect(result.code).toBe(1);
    expect(result.err).toContain(line);
    expect(result.err).toContain('Nothing sent.');
    expect(run.seen).toEqual([]);
  });

  it('names the second finding when the first is fine', async () => {
    const run = await checkout(() => ({ status: 200, body: { added: 2 } }));
    const result = await omni(['push', '7', ...sentFile(run, [FINDING, { ...FINDING, origin: 'nowhere' }])], run);
    expect(result.err).toContain('finding 2: origin');
    expect(run.seen).toEqual([]);
  });

  it('refuses a finding repeated in the file', async () => {
    const run = await checkout(() => ({ status: 200, body: { added: 1 } }));
    const result = await omni(['push', '7', ...sentFile(run, [FINDING, FINDING])], run);
    expect(result.err).toContain('finding 2 repeats finding 1');
    expect(run.seen).toEqual([]);
  });

  it('prints the page\'s refusal of a finding already proposed', async () => {
    const run = await checkout(() => ({ status: 409, body: { error: 'Finding 1 (ci, repository) was already proposed for this PRD.' } }));
    const result = await omni(['push', '7', ...sentFile(run, [FINDING])], run);
    expect(result).toEqual({ code: 1, out: '', err: 'omni rewind push: Finding 1 (ci, repository) was already proposed for this PRD. Nothing sent.\n' });
  });

  it('refuses a file that is missing or not JSON', async () => {
    const run = await checkout(() => ({ status: 200, body: { added: 1 } }));
    expect((await omni(['push', '7', '--file', 'nope.json'], run)).err).toContain('cannot read nope.json');
    expect((await omni(['push', '7', ...sentFile(run, 'not json')], run)).err).toContain('is not JSON');
    expect(run.seen).toEqual([]);
  });
});

describe('usage', () => {
  it.each([[[]], [['facts']], [['facts', 'x']], [['push', '7']], [['push', '--file', 'f.json']], [['other', '7']]])('exits 2 on %j', async (args) => {
    const run = await checkout(() => ({ status: 200, body: FACTS }));
    const result = await omni(args, run);
    expect(result.code).toBe(2);
    expect(result.err).toMatch(/usage|positive number/);
    expect(run.seen).toEqual([]);
  });
});
