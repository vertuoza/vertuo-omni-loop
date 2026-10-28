// `omni rewind facts`, `omni rewind push` (PRD 2410, s5) and `omni rewind outcome` (PRD 2498, s2), seen from the outside: through `main()` on a
// fixture repository, against a small server that answers the routes, with the sign-in an in-memory store.
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

  it('keeps each finding\'s id and outcome in --json, which /omni:rewind-apply reads (PRD 2498, s3)', async () => {
    const found = { id: '3f2a9c1e-5b7d-4e8f-a1b2-c3d4e5f60718', check: 'knowledge', origin: 'knowledge', state: 'approved', happened: 'No rule said it.', fix: 'Write the rule.', evidence: ['https://github.com/acme/widgets/pull/9'] };
    const outcome = { kind: 'proposed', pr: 42, url: 'https://github.com/acme/widgets/pull/42' };
    const run = await checkout(() => ({ status: 200, body: { ...FACTS, findings: [{ ...found, outcome: null }, { ...found, id: 'b'.repeat(8), outcome }, found] } }));
    expect(JSON.parse((await omni(['facts', '7', '--json'], run)).out)).toMatchObject({ findings: [{ ...found, outcome: null }, { ...found, id: 'b'.repeat(8), outcome }, found] });
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

describe('omni rewind outcome', () => {
  const ID = '6f1c1b1e-8a0e-4c1f-9d55-2c1f7b0e9a11';
  const route = `/api/rewind/findings/${ID}/outcome`;
  const answered = { status: 200, body: { outcome: 'recorded' } };

  it('sends a proposed rule with its pull request, and prints it', async () => {
    const run = await checkout(() => answered);
    const result = await omni(['outcome', ID, '--pr', '42'], run);
    expect(result).toEqual({ code: 0, out: `rewind outcome — finding ${ID}: rule proposed in PR #42.\n`, err: '' });
    expect(run.seen).toEqual([{ method: 'POST', url: route, body: { outcome: 'proposed', pr: 42 } }]);
  });

  it('sends the rule that already says it', async () => {
    const run = await checkout(() => answered);
    const result = await omni(['outcome', ID, '--already', 'playbook/testing#where-tests-live'], run);
    expect(result.code).toBe(0);
    expect(result.out).toContain('already said by playbook/testing#where-tests-live');
    expect(run.seen).toEqual([{ method: 'POST', url: route, body: { outcome: 'already', note: 'playbook/testing#where-tests-live' } }]);
  });

  it('sends the question asked', async () => {
    const run = await checkout(() => answered);
    const result = await omni(['outcome', ID, '--asks', 'Which form holds it?'], run);
    expect(result.code).toBe(0);
    expect(result.out).toContain('asks Which form holds it?');
    expect(run.seen).toEqual([{ method: 'POST', url: route, body: { outcome: 'asks', note: 'Which form holds it?' } }]);
  });

  it.each([
    ['no outcome', [], 'give exactly one of'],
    ['two outcomes', ['--pr', '4', '--asks', 'Why?'], 'give exactly one of'],
    ['a pull request that is not a number', ['--pr', 'four'], '--pr must be a positive number'],
    ['a pull request of zero', ['--pr', '0'], '--pr must be a positive number'],
    ['a blank rule', ['--already', '  '], '--already needs'],
    ['a rule on two lines', ['--already', 'a\nb'], '--already is one line'],
    ['a rule too long', ['--already', 'x'.repeat(201)], '--already is one line'],
    ['a blank question', ['--asks', ' '], '--asks needs'],
    ['a question too long', ['--asks', 'x'.repeat(2001)], '--asks is at most'],
    ['a flag with no value', ['--pr'], '--pr needs a value'],
  ])('exits 2 on %s, and calls nothing', async (_, flags, line) => {
    const run = await checkout(() => answered);
    const result = await omni(['outcome', ID, ...flags], run);
    expect(result.code).toBe(2);
    expect(result.err).toContain(line);
    expect(run.seen).toEqual([]);
  });

  it.each([[['outcome', '--pr', '4']], [['outcome', 'not-an-id', '--pr', '4']], [['outcome', ID, ID, '--pr', '4']]])('exits 2 on %j', async (args) => {
    const run = await checkout(() => answered);
    expect((await omni(args, run)).code).toBe(2);
    expect(run.seen).toEqual([]);
  });

  it('prints the page\'s refusal of a second outcome, and records nothing', async () => {
    const run = await checkout(() => ({ status: 409, body: { error: 'This finding already has an outcome: an outcome is never rewritten.' } }));
    const result = await omni(['outcome', ID, '--pr', '9'], run);
    expect(result).toEqual({ code: 1, out: '', err: 'omni rewind outcome: This finding already has an outcome: an outcome is never rewritten. Nothing recorded.\n' });
  });

  it('says so when signed out', async () => {
    const run = await checkout(() => answered);
    const result = await omni(['outcome', ID, '--pr', '9'], { ...run, tokens: { read: () => null, write: () => undefined } });
    expect(result.code).toBe(1);
    expect(result.err).toContain('no sign-in');
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
