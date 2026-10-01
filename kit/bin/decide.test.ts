// `omni decide <decision>` (PRD 812 s3), seen from the outside: through `main()` on a fixture
// repository, with a stubbed `fetch` and an in-memory token store. Jev can never block (decision 6):
// every decision outcome exits 0, printing `<answer> <confidence>` when Jev's answer counted and
// `unset` otherwise; only a usage error exits 2.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const URL_ = 'https://omni.test';
const HOST = 'omni.test';
const STATE = { decision: 'Keep the sessions in Postgres.', options: ['A: Postgres', 'B: Redis'], slice: 's3', paths: ['supabase/'] };

function io() {
  const out = [];
  const err = [];
  return { out: () => out.join(''), err: () => err.join(''), stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } };
}

function memoryTokens(entries = {}) {
  const store = { ...entries };
  return { store, read: (host) => store[host] ?? null, write: (host, tokens) => { store[host] = tokens; } };
}

const config = (url) => `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${url ?? 'null'}\n`;

/** A fetch that answers every call with `answer(url, init)`, `{ status, body }`, and records the calls. */
function stubFetch(answer) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url: String(url), method: init.method, authorization: init.headers.authorization, body: init.body ? JSON.parse(init.body) : undefined });
    const { status = 200, body } = await answer(String(url), init);
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, calls };
}

function checkout({ url = URL_, signedIn = true } = {}) {
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config(url), 'state.json': JSON.stringify(STATE) } });
  const tokens = memoryTokens(signedIn ? { [HOST]: { access_token: 'access-1', refresh_token: 'refresh-1' } } : {});
  return { root, tokens };
}

async function decide(args, { root, tokens, fetch = stubFetch(() => ({ status: 500, body: {} })).fetch, callMs }) {
  const s = io();
  const code = await main(['decide', ...args], { cwd: root, ...s, tokens, env: {}, fetch, ...(callMs ? { callMs } : {}) });
  return { code, out: s.out(), err: s.err() };
}

const ARGS = ['outbox-risk', '--state-file', 'state.json', '--old', 'false', '--ref', 'item 812-s3-01'];
const JEV = { answer: 'true', confidence: 0.82, decidedBy: 'jev' };
const OLD = { answer: null, confidence: null, decidedBy: 'old' };

describe('omni decide', () => {
  it('prints Jev\'s answer and its confidence when it counted, after one call with the sign-in', async () => {
    const c = checkout();
    const stub = stubFetch(() => ({ body: JEV }));
    const run = await decide(ARGS, { ...c, fetch: stub.fetch });
    expect(run).toEqual({ code: 0, out: 'true 0.82\n', err: '' });
    expect(stub.calls).toEqual([{
      url: `${URL_}/api/decide/outbox-risk`, method: 'POST', authorization: 'Bearer access-1',
      body: { repo: 'acme/widgets', state: STATE, old: 'false', ref: 'item 812-s3-01' },
    }]);
  });

  it('sends no ref when none is given', async () => {
    const c = checkout();
    const stub = stubFetch(() => ({ body: JEV }));
    await decide(['outbox-risk', '--state-file', join(c.root, 'state.json'), '--old', 'true'], { ...c, fetch: stub.fetch });
    expect(stub.calls[0].body).toEqual({ repo: 'acme/widgets', state: STATE, old: 'true' });
  });

  it('prints --json as the answer, its confidence and who decided', async () => {
    const c = checkout();
    const run = await decide([...ARGS, '--json'], { ...c, fetch: stubFetch(() => ({ body: JEV })).fetch });
    expect(run.code).toBe(0);
    expect(JSON.parse(run.out)).toEqual({ decision: 'outbox-risk', answer: 'true', confidence: 0.82, decidedBy: 'jev', reason: null });
  });

  it('prints unset when the decision is Off or in Shadow (today\'s answer counts)', async () => {
    const c = checkout();
    const run = await decide(ARGS, { ...c, fetch: stubFetch(() => ({ body: OLD })).fetch });
    expect(run).toMatchObject({ code: 0, out: 'unset\n' });
    const json = await decide([...ARGS, '--json'], { ...c, fetch: stubFetch(() => ({ body: OLD })).fetch });
    expect(JSON.parse(json.out)).toEqual({ decision: 'outbox-risk', answer: null, confidence: null, decidedBy: 'old', reason: expect.any(String) });
  });

  it('prints unset without a sign-in, without calling anything', async () => {
    const c = checkout({ signedIn: false });
    const stub = stubFetch(() => ({ body: JEV }));
    const run = await decide(ARGS, { ...c, fetch: stub.fetch });
    expect(run).toMatchObject({ code: 0, out: 'unset\n' });
    expect(run.err).toMatch(/sign-in/);
    expect(stub.calls).toEqual([]);
  });

  it('prints unset with no Omni page set here', async () => {
    const c = checkout({ url: null });
    expect(await decide(ARGS, c)).toMatchObject({ code: 0, out: 'unset\n' });
  });

  it('prints unset on a refusal, a refused sign-in, and a server without the verb', async () => {
    const c = checkout();
    for (const status of [400, 403, 404, 500, 503]) {
      const run = await decide(ARGS, { ...c, fetch: stubFetch(() => ({ status, body: { error: 'no' } })).fetch });
      expect(run).toMatchObject({ code: 0, out: 'unset\n' });
    }
    const refused = await decide(ARGS, { ...c, fetch: stubFetch(() => ({ status: 401, body: { error: 'invalid' } })).fetch });
    expect(refused).toMatchObject({ code: 0, out: 'unset\n' });
  });

  it('prints unset on a timeout', async () => {
    const c = checkout();
    const hang = (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(Object.assign(new Error('timed out'), { name: 'TimeoutError' })));
    });
    const run = await decide(ARGS, { ...c, fetch: hang, callMs: 20 });
    expect(run).toMatchObject({ code: 0, out: 'unset\n' });
    expect(run.err).toMatch(/could not be reached/);
  });

  it('prints unset on a reply that is not a decision', async () => {
    const c = checkout();
    for (const body of [{}, { decidedBy: 'jev', answer: 'true' }, { decidedBy: 'jev', answer: '', confidence: 0.9 }, { decidedBy: 'jev', answer: 'true', confidence: 2 }]) {
      expect(await decide(ARGS, { ...c, fetch: stubFetch(() => ({ body })).fetch })).toMatchObject({ code: 0, out: 'unset\n' });
    }
  });

  it('exits 2 on a usage error', async () => {
    const c = checkout();
    for (const args of [
      [],
      ['outbox-risk'],
      ['outbox-risk', '--old', 'false'],
      ['outbox-risk', '--state-file', 'state.json'],
      ['outbox-risk', 'bug-risk', '--state-file', 'state.json', '--old', 'false'],
      ['outbox-risk', '--state-file', 'missing.json', '--old', 'false'],
      ['outbox-risk', '--state-file', 'state.json', '--old', 'false', '--nope'],
    ]) {
      const run = await decide(args, c);
      expect(run.code, args.join(' ')).toBe(2);
      expect(run.out).toBe('');
    }
  });

  it('exits 2 on a state file that is not JSON', async () => {
    const c = checkout();
    writeFileSync(join(c.root, 'bad.json'), 'not json');
    const run = await decide(['outbox-risk', '--state-file', 'bad.json', '--old', 'false'], c);
    expect(run.code).toBe(2);
    expect(run.err).toMatch(/JSON/);
  });
});

describe('/omni:do-work\'s "Record it" step', () => {
  const skill = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../plugin/skills/do-work/SKILL.md'), 'utf8');
  const step = skill.slice(skill.indexOf('2. **Record it**'), skill.indexOf('3. **Read the JSON on stdout.**'));

  it('asks omni decide outbox-risk with the agent\'s own hardToRevert, before the item is written', () => {
    expect(step).toContain('decide outbox-risk --state-file <state file> --old <true|false>');
    expect(step).toContain('before you run\n   `omni item new`');
  });

  it('writes the Decided by line only when Jev\'s answer counted, and leaves the step as today on unset', () => {
    expect(step).toContain('When it prints `unset`, keep your own `hardToRevert` and change nothing');
    expect(step).toContain('`Decided by: Jev (hardToRevert <confidence>) · agent said <yours>`');
    expect(step).toContain('the kit still picks the rank, its law floor included');
  });
});
