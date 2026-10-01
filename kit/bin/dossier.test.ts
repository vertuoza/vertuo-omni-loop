// `omni dossier open | push | status` (PRD 216), seen from the outside: through `main()` on a fixture
// repository, against the fake contract server, with the sign-in an in-memory token store. The real
// `~/.config/omni/` is never touched, and the environment is always passed in, so the Claude session
// running these tests never leaks its own id into them.
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CALL_TIMEOUT_MS } from '../lib/ask/client.ts';
import { DOSSIERS_FILE, readDossiers } from '../lib/dossier/local.ts';
import { startFakeAskServer } from '../test/fake-ask-server.ts';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const INBOX = '.omni-loop/delivery/inbox/0007-team-inbox';
const SPEC = '---\nprd: 7\ntitle: Team inbox\nblocked-by: none\nspec: file\n---\n\n# Team inbox\n';
const PLAN = '# Plan: team inbox\n';
const PAGE = '<!doctype html>\n<title>Before and after</title>\n';
const FOLDER = { [`${INBOX}/spec.md`]: SPEC, [`${INBOX}/plan.md`]: PLAN, [`${INBOX}/before-after.html`]: PAGE };

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out: () => out.join(''), err: () => err.join(''), stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
}

function memoryTokens(entries = {}) {
  const store = { ...entries };
  return { store, read: (host: string | number) => store[host] ?? null, write: (host: string | number, tokens: any) => { store[host] = tokens; } };
}

const config = ({ url, enabled = true }) =>
  `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${url ?? 'null'}\ndossier:\n  enabled: ${enabled}\n`;

let server;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

/** A checkout holding PRD 7's folder, switched on against the fake server and signed in to it. */
async function signedIn({ serverOptions = {}, files = FOLDER, enabled = true } = {}) {
  server = await startFakeAskServer(serverOptions);
  const repo = makeRepo({ git: true, files: { '.omni-loop/config.yml': config({ url: server.url, enabled }), ...files } });
  const tokens = memoryTokens({ [server.host]: { access_token: 'access-1', refresh_token: 'refresh-1', email: 'ada@example.com' } });
  return { ...repo, tokens };
}

/** `omni dossier <args>`, with the terminal's environment given as `env` and nothing else. */
async function dossier(args: string[], { root, tokens, env = {}, ...more }) {
  const s = io();
  const started = Date.now();
  const code = await main(['dossier', ...args], { cwd: root, ...s, tokens, env, ...more });
  return { code, out: s.out(), err: s.err(), ms: Date.now() - started };
}

describe('omni dossier open', () => {
  it('opens a draft for this repository, prints its link, and records it', async () => {
    const { root, tokens } = await signedIn();
    const run = await dossier(['open', 'A team inbox for every question'], { root, tokens, env: { CLAUDE_CODE_SESSION_ID: 'sess-a' } });

    expect(run.err).toBe('');
    expect(run.code).toBe(0);
    const [only] = [...server.dossiers.values()];
    expect(run.out).toBe(`${server.url}/prd/${only.id}\n`);
    expect(server.calls.map(({ path, body }) => ({ path, body }))).toEqual([
      { path: '/api/dossiers', body: { title: 'A team inbox for every question', repo: 'acme/widgets', claudeSessionId: 'sess-a' } },
    ]);
    expect(readDossiers(root)).toEqual([
      { id: only.id, url: `${server.url}/prd/${only.id}`, claudeSessionId: 'sess-a', prd: null, openedAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/) },
    ]);
  });

  it('sends no session id when CLAUDE_CODE_SESSION_ID is not set, and records the draft without one', async () => {
    const { root, tokens } = await signedIn();
    expect((await dossier(['open', 'An idea'], { root, tokens, env: {} })).code).toBe(0);
    expect(server.calls[0].body).toEqual({ title: 'An idea', repo: 'acme/widgets' });
    expect(readDossiers(root)[0]!.claudeSessionId).toBeNull();
    expect((await dossier(['open', 'Another'], { root, tokens, env: { CLAUDE_CODE_SESSION_ID: '' } })).code).toBe(0);
    expect(server.calls[1].body).toEqual({ title: 'Another', repo: 'acme/widgets' });
  });

  it('cuts a long idea to the 200 characters a title takes', async () => {
    const { root, tokens } = await signedIn();
    await dossier(['open', `  ${'i'.repeat(300)}  `], { root, tokens });
    expect(server.calls[0].body.title).toBe('i'.repeat(200));
  });
});

describe('omni dossier push', () => {
  it('numbers the draft this session opened, sends the three files, and prints the link and the versions added', async () => {
    const { root, tokens } = await signedIn();
    const env = { CLAUDE_CODE_SESSION_ID: 'sess-a' };
    await dossier(['open', 'A team inbox'], { root, tokens, env });
    const [draft] = readDossiers(root);

    const run = await dossier(['push', '7'], { root, tokens, env });

    expect(run.err).toBe('');
    expect(run.code).toBe(0);
    expect(run.out).toBe(`${draft!.url}\nadded: spec v1, plan v1, before-after v1\n`);
    expect(server.calls[1]).toMatchObject({
      path: '/api/dossiers/push',
      body: {
        repo: 'acme/widgets', prd: 7, title: 'Team inbox', draftId: draft!.id,
        artifacts: [{ kind: 'spec', content: SPEC }, { kind: 'plan', content: PLAN }, { kind: 'before-after', content: PAGE }],
      },
    });
    expect(server.dossiers.get(draft!.id)).toMatchObject({ prd: 7, title: 'Team inbox', claudeSessionId: 'sess-a' });
    expect(readDossiers(root)).toEqual([{ ...draft, prd: 7 }]);
  });

  it('a second identical push adds nothing, and says what it left unchanged', async () => {
    const { root, tokens } = await signedIn();
    await dossier(['open', 'A team inbox'], { root, tokens });
    await dossier(['push', '7'], { root, tokens });

    const again = await dossier(['push', '7'], { root, tokens });

    expect(again.code).toBe(0);
    expect(again.out.split('\n')[1]).toBe('added: none · unchanged: spec, plan, before-after');
    expect(server.calls[2].body).not.toHaveProperty('draftId');
    const [only] = [...server.dossiers.values()];
    expect(only.versions).toHaveLength(3);
  });

  it('adds a version of a changed file only', async () => {
    const { root, tokens, write } = await signedIn();
    await dossier(['push', '7'], { root, tokens });
    write(`${INBOX}/spec.md`, `${SPEC}\nA second paragraph.\n`);

    const run = await dossier(['push', '7'], { root, tokens });

    expect(run.out.split('\n')[1]).toBe('added: spec v2 · unchanged: plan, before-after');
  });

  it('with no draft recorded, finds or creates PRD n\'s dossier by its key', async () => {
    const { root, tokens } = await signedIn();
    const run = await dossier(['push', '7'], { root, tokens });
    expect(run.code).toBe(0);
    expect(server.calls[0].body).not.toHaveProperty('draftId');
    const [only] = [...server.dossiers.values()];
    expect(only).toMatchObject({ repo: 'acme/widgets', prd: 7 });
    expect(readDossiers(root)).toEqual([]);
  });

  it('from a worktree, numbers the draft the main checkout recorded', async () => {
    const { root, tokens } = await signedIn();
    const tree = join(mkdtempSync(join(tmpdir(), 'omni-wt-')), 'tree');
    execFileSync('git', ['worktree', 'add', '-q', '-b', 'feat/team-inbox', tree], { cwd: root, stdio: 'ignore' });
    await dossier(['open', 'A team inbox'], { root: tree, tokens });
    const [draft] = readDossiers(root);

    const run = await dossier(['push', '7'], { root: tree, tokens });

    expect(run.code).toBe(0);
    expect(server.calls[1].body.draftId).toBe(draft!.id);
    expect(readDossiers(root)[0]!.prd).toBe(7);
  });

  it('with several drafts and no session id, numbers none', async () => {
    const { root, tokens } = await signedIn();
    await dossier(['open', 'One idea'], { root, tokens });
    await dossier(['open', 'Another idea'], { root, tokens });
    await dossier(['push', '7'], { root, tokens });
    expect(server.calls[2].body).not.toHaveProperty('draftId');
    expect(readDossiers(root).map((entry) => entry.prd)).toEqual([null, null]);
  });

  it('when the server no longer has the draft, forgets it and pushes by the key', async () => {
    const { root, tokens } = await signedIn();
    await dossier(['open', 'A team inbox'], { root, tokens });
    const [draft] = readDossiers(root);
    server.dossiers.delete(draft!.id);

    const run = await dossier(['push', '7'], { root, tokens });

    expect(run.code).toBe(0);
    expect(server.calls.slice(1).map((call) => call.body.draftId ?? null)).toEqual([draft!.id, null]);
    expect(readDossiers(root)).toEqual([]);
    expect([...server.dossiers.values()]).toMatchObject([{ prd: 7 }]);
  });

  it('sends the others and exits 1 naming a file over 512 KiB', async () => {
    const { root, tokens } = await signedIn({ files: { ...FOLDER, [`${INBOX}/before-after.html`]: 'x'.repeat(512 * 1024 + 1) } });
    const run = await dossier(['push', '7'], { root, tokens });

    expect(run.code).toBe(1);
    expect(run.err).toBe(`too large: ${INBOX}/before-after.html\n`);
    expect(run.out.split('\n')[1]).toBe('added: spec v1, plan v1');
    expect(server.calls[0].body.artifacts.map((a) => a.kind)).toEqual(['spec', 'plan']);
  });

  it('exits 2 for a PRD with no folder, and calls nothing', async () => {
    const { root, tokens } = await signedIn();
    const run = await dossier(['push', '99'], { root, tokens });
    expect(run.code).toBe(2);
    expect(run.err).toMatch(/PRD 99 has no inbox or shipped folder/);
    expect(server.calls).toEqual([]);
  });
});

describe('omni dossier status', () => {
  it('prints on with the switch\'s source', async () => {
    const { root, tokens } = await signedIn();
    const run = await dossier(['status'], { root, tokens });
    expect(run).toMatchObject({ code: 0, out: 'on (dossier.enabled is true in .omni-loop/config.yml)\n', err: '' });
    expect(server.calls).toEqual([]);
  });

  it('prints off with the reason', async () => {
    const off = makeRepo({ git: true, files: { '.omni-loop/config.yml': config({ url: 'https://omni.example', enabled: false }) } });
    expect((await dossier(['status'], { root: off.root, tokens: memoryTokens() })).out).toBe('off (dossier.enabled is false)\n');
    const noUrl = makeRepo({ git: true, files: { '.omni-loop/config.yml': config({ url: null }) } });
    expect((await dossier(['status'], { root: noUrl.root, tokens: memoryTokens() })).out).toBe('off (ask.url is not set)\n');
  });
});

describe('omni dossier never blocks: each skip exits 1 with its one line', () => {
  it('off: prints off and calls nothing, for open and push alike', async () => {
    const { root, tokens } = await signedIn({ enabled: false });
    for (const args of [['open', 'An idea'], ['push', '7']]) {
      expect(await dossier(args, { root, tokens })).toMatchObject({ code: 1, out: '', err: 'off\n' });
    }
    const noUrl = makeRepo({ git: true, files: { '.omni-loop/config.yml': config({ url: null }), ...FOLDER } });
    expect(await dossier(['push', '7'], { root: noUrl.root, tokens })).toMatchObject({ code: 1, err: 'off\n' });
    expect(server.calls).toEqual([]);
    expect(readDossiers(root)).toEqual([]);
  });

  it('no sign-in: says omni signin and calls nothing', async () => {
    const { root } = await signedIn();
    for (const args of [['open', 'An idea'], ['push', '7']]) {
      expect(await dossier(args, { root, tokens: memoryTokens() })).toMatchObject({ code: 1, out: '', err: 'no sign-in (omni signin)\n' });
    }
    expect(server.calls).toEqual([]);
  });

  it('a 401 after one refresh: refused (401)', async () => {
    const { root, tokens } = await signedIn();
    server.denyAccess();
    const run = await dossier(['push', '7'], { root, tokens });
    expect(run).toMatchObject({ code: 1, out: '', err: 'refused (401)\n' });
    expect(server.calls.map((call) => call.path)).toEqual(['/api/dossiers/push', '/api/ask/token', '/api/dossiers/push']);
    expect(run.ms).toBeLessThan(15_000);
  });

  it('a server that is down: unreachable, at once', async () => {
    const { root, tokens } = await signedIn();
    await server.close();
    for (const args of [['open', 'An idea'], ['push', '7']]) {
      const run = await dossier(args, { root, tokens });
      expect(run).toMatchObject({ code: 1, out: '', err: 'unreachable\n' });
      expect(run.ms).toBeLessThan(15_000);
    }
    expect(readDossiers(root)).toEqual([]);
  });

  it('a server that never answers: unreachable once the call\'s time is up — 5 seconds each, so 15 at most with a refresh', async () => {
    expect(CALL_TIMEOUT_MS).toBe(5000);
    const sockets = new Set();
    const silent = createServer((socket) => { sockets.add(socket); });
    await new Promise((resolve) => silent.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${silent.address()!.port}`;
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config({ url }), ...FOLDER } });
    const tokens = memoryTokens({ [`127.0.0.1:${silent.address()!.port}`]: { access_token: 'a', refresh_token: 'r' } });
    try {
      const run = await dossier(['push', '7'], { root, tokens, callMs: 200 });
      expect(run).toMatchObject({ code: 1, err: 'unreachable\n' });
      expect(run.ms).toBeLessThan(2000);
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => silent.close(resolve));
    }
  });

  it('a body the server finds too large: refused (413)', async () => {
    const { root, tokens } = await signedIn({ serverOptions: { dossierBodyBytes: 100 } });
    const run = await dossier(['push', '7'], { root, tokens });
    expect(run).toMatchObject({ code: 1, out: '', err: 'refused (413)\n' });
  });

  it('a server without the dossier calls: refused (404), and the draft is kept', async () => {
    const { root, tokens } = await signedIn();
    await dossier(['open', 'A team inbox'], { root, tokens });
    const [draft] = readDossiers(root);
    const run = await dossier(['push', '7'], { root, tokens, fetch: (url, init) => (
      String(url).endsWith('/api/dossiers/push') ? Promise.resolve(new Response('{}', { status: 404 })) : fetch(url, init)
    ) });
    expect(run).toMatchObject({ code: 1, err: 'refused (404)\n' });
    expect(readDossiers(root)).toEqual([draft]);
  });
});

describe('omni dossier refuses what it cannot run', () => {
  it('exits 2 with the usage for a missing or unknown verb, a missing title or a PRD that is not a number', async () => {
    const { root, tokens } = await signedIn();
    for (const args of [[], ['close'], ['open'], ['open', '   '], ['push'], ['push', 'seven'], ['status', 'now'], ['open', 'a', 'b']]) {
      const run = await dossier(args, { root, tokens });
      expect(run.code, JSON.stringify(args)).toBe(2);
      expect(run.err.trim().split('\n'), JSON.stringify(args)).toHaveLength(1);
    }
    expect(server.calls).toEqual([]);
  });

  it('exits 2 where the kit is not installed', async () => {
    const { root } = makeRepo({ git: true });
    const run = await dossier(['push', '7'], { root, tokens: memoryTokens() });
    expect(run.code).toBe(2);
    expect(run.err).toMatch(/not installed/);
  });

  it('exits 2 when the config does not read', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': 'kit: 1\ndossier:\n  enabled: maybe\n' } });
    expect((await dossier(['status'], { root, tokens: memoryTokens() })).code).toBe(2);
  });

  it('keeps its local file out of git', async () => {
    const { root, tokens } = await signedIn();
    await dossier(['open', 'An idea'], { root, tokens });
    expect(readFileSync(join(root, '.omni-loop/local/.gitignore'), 'utf8')).toBe('*\n');
    expect(execFileSync('git', ['status', '--porcelain', '--', DOSSIERS_FILE], { cwd: root, encoding: 'utf8' })).toBe('');
  });
});
