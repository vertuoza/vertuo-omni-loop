// `omni dossier link <n>` (PRD 413), through `main()` on a fixture repository, against a stubbed fetch
// that follows the lookup's contract (`GET /api/dossiers?repo=<owner/name>&prd=<n>`). The sign-in is an
// in-memory token store and the environment is passed in, so nothing real is read or written.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOSSIERS_FILE } from '../../lib/dossier/local.ts';
import { makeRepo } from '../../test/fixture.ts';
import { main } from '../omni.ts';

const BASE = 'https://omni.example';
const HOST = 'omni.example';
const LINK = `${BASE}/prd/0b7c-dossier-7`;

const config = ({ url = BASE, enabled = true } = {}) =>
  `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${url ?? 'null'}\ndossier:\n  enabled: ${enabled}\n`;

function memoryTokens(entries = {}) {
  const store = { ...entries };
  return { store, read: (host: string | number) => store[host] ?? null, write: (host: string | number, tokens: any) => { store[host] = tokens; } };
}
const signedIn = () => memoryTokens({ [HOST]: { access_token: 'access-1', refresh_token: 'refresh-1' } });

/** A fetch that answers every call with `reply(url, init)` and keeps each call. */
function stubFetch(reply) {
  const calls = [];
  const fetch = async (url: string, init) => {
    calls.push({ url: String(url), method: init.method, authorization: init.headers.authorization });
    return reply(String(url), init);
  };
  return { calls, fetch };
}
const json = (status: number, body = {}) => new Response(JSON.stringify(body), { status });
const down = () => { throw new TypeError('fetch failed'); };

/** A local record holding a draft still unnumbered and PRD 7's numbered dossier. */
const RECORD = [
  { id: 'draft-1', url: `${BASE}/prd/draft-1`, claudeSessionId: null, prd: null, openedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'local-7', url: `${BASE}/prd/local-7`, claudeSessionId: 's', prd: 7, openedAt: '2026-09-02T00:00:00.000Z' },
];

function checkout({ enabled, url, record } = {}) {
  const repo = makeRepo({ git: true, files: { '.omni-loop/config.yml': config({ url, enabled }) } });
  if (record) repo.write(DOSSIERS_FILE, `${JSON.stringify(record, null, 2)}\n`);
  return repo;
}

/** Every file under `.omni-loop/local/`, with its text: what `link` must leave as it found it. */
function localFiles(root: string) {
  const dir = join(root, '.omni-loop/local');
  if (!existsSync(dir)) return {};
  return Object.fromEntries(readdirSync(dir).map((name) => [name, readFileSync(join(dir, name), 'utf8')]));
}

async function link(args: string[], { root, tokens = signedIn(), fetch }) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['dossier', 'link', ...args], {
    cwd: root, tokens, env: {}, fetch,
    stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) },
  });
  return { code, out: out.join(''), err: err.join('') };
}

describe('omni dossier link', () => {
  it('asks the app for PRD n of this repository and prints its link on one line', async () => {
    const { root } = checkout();
    const { calls, fetch } = stubFetch(() => json(200, { id: '0b7c-dossier-7', url: LINK }));
    expect(await link(['7'], { root, fetch })).toEqual({ code: 0, out: `${LINK}\n`, err: '' });
    expect(calls).toEqual([{ url: `${BASE}/api/dossiers?repo=acme%2Fwidgets&prd=7`, method: 'GET', authorization: 'Bearer access-1' }]);
  });

  it('prefers the app to the local record when the app answers', async () => {
    const { root } = checkout({ record: RECORD });
    const { fetch } = stubFetch(() => json(200, { id: '0b7c-dossier-7', url: LINK }));
    expect((await link(['7'], { root, fetch })).out).toBe(`${LINK}\n`);
  });

  it('a PRD with no dossier: none, exit 1, even when the record names one', async () => {
    const { root } = checkout({ record: RECORD });
    const { fetch } = stubFetch(() => json(404));
    expect(await link(['7'], { root, fetch })).toEqual({ code: 1, out: '', err: 'none\n' });
  });

  it('a reply without a link: refused, exit 1', async () => {
    const { root } = checkout();
    const { fetch } = stubFetch(() => json(200, { id: 'x' }));
    expect(await link(['7'], { root, fetch })).toEqual({ code: 1, out: '', err: 'refused (no dossier in the reply)\n' });
  });
});

describe('omni dossier link when the app cannot be reached', () => {
  it('prints the numbered entry the local record holds for n, exit 0', async () => {
    const { root } = checkout({ record: RECORD });
    const { fetch } = stubFetch(down);
    expect(await link(['7'], { root, fetch })).toEqual({ code: 0, out: `${BASE}/prd/local-7\n`, err: '' });
  });

  it('takes the last one recorded when the record holds two for n', async () => {
    const later = { id: 'local-7b', url: `${BASE}/prd/local-7b`, claudeSessionId: null, prd: 7, openedAt: '2026-09-03T00:00:00.000Z' };
    const { root } = checkout({ record: [...RECORD, later] });
    const { fetch } = stubFetch(down);
    expect((await link(['7'], { root, fetch })).out).toBe(`${later.url}\n`);
  });

  it('without a numbered entry for n: unreachable, exit 1', async () => {
    const { root } = checkout({ record: RECORD });
    const { fetch } = stubFetch(down);
    expect(await link(['8'], { root, fetch })).toEqual({ code: 1, out: '', err: 'unreachable\n' });
    const bare = checkout();
    expect(await link(['7'], { root: bare.root, fetch })).toEqual({ code: 1, out: '', err: 'unreachable\n' });
  });
});

describe('omni dossier link skips as open and push do', () => {
  it('off: prints off and calls nothing', async () => {
    const { calls, fetch } = stubFetch(() => json(200, { id: 'i', url: LINK }));
    expect(await link(['7'], { root: checkout({ enabled: false }).root, fetch })).toEqual({ code: 1, out: '', err: 'off\n' });
    expect(await link(['7'], { root: checkout({ url: null }).root, fetch })).toEqual({ code: 1, out: '', err: 'off\n' });
    expect(calls).toEqual([]);
  });

  it('no sign-in: says omni signin and calls nothing', async () => {
    const { root } = checkout({ record: RECORD });
    const { calls, fetch } = stubFetch(() => json(200, { id: 'i', url: LINK }));
    expect(await link(['7'], { root, fetch, tokens: memoryTokens() })).toEqual({ code: 1, out: '', err: 'no sign-in (omni signin)\n' });
    expect(calls).toEqual([]);
  });

  it('a refusal carries its status', async () => {
    const { root } = checkout({ record: RECORD });
    const { fetch } = stubFetch(() => json(500));
    expect(await link(['7'], { root, fetch })).toEqual({ code: 1, out: '', err: 'refused (500)\n' });
  });

  it('a refusal with a reason prints it after the status, on one line (PRD 459)', async () => {
    const { root } = checkout();
    const reason = 'you are not a member of Globex, which owns globex/web';
    expect(await link(['7'], { root, fetch: stubFetch(() => json(403, { error: reason })).fetch }))
      .toEqual({ code: 1, out: '', err: `refused (403): ${reason}\n` });
    expect(await link(['7'], { root, fetch: stubFetch(() => json(403, { error: 'two\nlines' })).fetch }))
      .toEqual({ code: 1, out: '', err: 'refused (403): two lines\n' });
    expect(await link(['7'], { root, fetch: stubFetch(() => json(403)).fetch })).toEqual({ code: 1, out: '', err: 'refused (403)\n' });
  });

  it('a 401 after one refresh: refused (401)', async () => {
    const { root } = checkout();
    const { calls, fetch } = stubFetch((url: string) => (url.endsWith('/api/ask/token') ? json(200, { access_token: 'access-2' }) : json(401)));
    expect(await link(['7'], { root, fetch })).toEqual({ code: 1, out: '', err: 'refused (401)\n' });
    expect(calls.map((call) => new URL(call.url).pathname)).toEqual(['/api/dossiers', '/api/ask/token', '/api/dossiers']);
  });
});

describe('omni dossier link writes nothing', () => {
  it('leaves .omni-loop/local/ as it found it, whatever the answer', async () => {
    const replies = [() => json(200, { id: 'i', url: LINK }), () => json(404), () => json(500), down];
    const { root } = checkout({ record: RECORD });
    const before = localFiles(root);
    for (const reply of replies) await link(['7'], { root, fetch: stubFetch(reply).fetch });
    expect(localFiles(root)).toEqual(before);

    const bare = checkout();
    for (const reply of replies) await link(['7'], { root: bare.root, fetch: stubFetch(reply).fetch });
    expect(existsSync(join(bare.root, '.omni-loop/local'))).toBe(false);
  });
});

describe('omni dossier link refuses what it cannot run', () => {
  it('exits 2 with the usage line, which names link, for a missing, extra or non-numeric PRD', async () => {
    const { root } = checkout();
    const { calls, fetch } = stubFetch(() => json(200, { id: 'i', url: LINK }));
    for (const args of [[], ['x'], ['0'], ['-3'], ['7', '8']]) {
      const run = await link(args, { root, fetch });
      expect(run.code, JSON.stringify(args)).toBe(2);
      expect(run.err.trim().split('\n'), JSON.stringify(args)).toHaveLength(1);
    }
    for (const args of [[], ['x']]) expect((await link(args, { root, fetch })).err).toMatch(/^usage: .*omni dossier link <n>/);
    expect(calls).toEqual([]);
  });
});

describe('omni dossier open and push print the server\'s reason (PRD 459)', () => {
  const REASON = 'no workspace owns acme/widgets yet — install the Omni App: https://github.com/apps/omni-loop-invader/installations/new';

  async function run(args: string[], { root, fetch }) {
    const out: string[] = [];
    const err: string[] = [];
    const code = await main(['dossier', ...args], {
      cwd: root, tokens: signedIn(), env: {}, fetch,
      stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) },
    });
    return { code, out: out.join(''), err: err.join('') };
  }

  it('open: refused (403): <reason>, and no draft recorded', async () => {
    const { root } = checkout();
    expect(await run(['open', 'An idea'], { root, fetch: stubFetch(() => json(403, { error: REASON })).fetch }))
      .toEqual({ code: 1, out: '', err: `refused (403): ${REASON}\n` });
    expect(existsSync(join(root, DOSSIERS_FILE))).toBe(false);
  });

  it('push: refused (403): <reason>', async () => {
    const { root, write } = checkout();
    write('.omni-loop/delivery/inbox/0007-team-inbox/spec.md', '---\nprd: 7\ntitle: Team inbox\nblocked-by: none\nspec: file\n---\n\n# Team inbox\n');
    expect(await run(['push', '7'], { root, fetch: stubFetch(() => json(403, { error: REASON })).fetch }))
      .toEqual({ code: 1, out: '', err: `refused (403): ${REASON}\n` });
  });
});

describe('omni dossier push and link --kind (PRD 627)', () => {
  const VISUAL = '.omni-loop/delivery/visual/0548-omni-links-new-tab';
  const BUGS = '.omni-loop/delivery/bugs/0571-number-args';
  const SPEC = '---\nprd: 7\ntitle: Team inbox\nblocked-by: none\nspec: file\n---\n\n# Team inbox\n';
  const PAGE = '<!doctype html>\n<title>Links</title>\n';

  /** A fetch that keeps each call with its body, and answers with `reply`. */
  function recordingFetch(reply) {
    const calls = [];
    const fetch = async (url: string, init) => {
      calls.push({ url: String(url), method: init.method, body: init.body === undefined ? undefined : JSON.parse(init.body) });
      return reply(String(url), init);
    };
    return { calls, fetch };
  }

  /** git as it is; gh answers the issue's title with `title`, or fails when it is null. */
  const withIssue = (title: string | null, seen = []) => (command: string, args: readonly string[], options) => {
    if (command !== 'gh') return execFileSync(command, args, options);
    seen.push(args);
    if (title === null) throw new Error('gh: not found');
    return `${title}\n`;
  };

  async function run(args: string[], { root, fetch, exec }) {
    const out: string[] = [];
    const err: string[] = [];
    const code = await main(['dossier', ...args], {
      cwd: root, tokens: signedIn(), env: {}, fetch, ...(exec ? { exec } : {}),
      stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) },
    });
    return { code, out: out.join(''), err: err.join('') };
  }

  const pushed = (url: string) => json(200, { id: 'd-1', url, added: [{ kind: 'before-after', version: 1 }], unchanged: [] });

  it('push <n> sends voice.json as the voice artifact when the PRD folder has one (PRD 822)', async () => {
    const { root, write } = checkout();
    const VOICE = '{"rounds": []}\n';
    write('.omni-loop/delivery/inbox/0007-team-inbox/spec.md', SPEC);
    write('.omni-loop/delivery/inbox/0007-team-inbox/voice.json', VOICE);
    const { calls, fetch } = recordingFetch(() => json(200, { id: 'd-1', url: LINK, added: [{ kind: 'voice', version: 2 }], unchanged: ['spec'] }));
    const result = await run(['push', '7'], { root, fetch });
    expect(result).toEqual({ code: 0, out: `${LINK}\nadded: voice v2 · unchanged: spec\n`, err: '' });
    expect(calls[0].body.artifacts).toEqual([{ kind: 'spec', content: SPEC }, { kind: 'voice', content: VOICE }]);
  });

  it('push <n> with no --kind sends exactly what it sent before: no kind, the PRD folder, and asks GitHub nothing', async () => {
    const { root, write } = checkout();
    write('.omni-loop/delivery/inbox/0007-team-inbox/spec.md', SPEC);
    const { calls, fetch } = recordingFetch(() => pushed(LINK));
    const seen: never[] | undefined = [];
    expect((await run(['push', '7'], { root, fetch, exec: withIssue('never asked', seen) })).code).toBe(0);
    expect(calls.map((c) => c.body)).toEqual([{ repo: 'acme/widgets', prd: 7, title: 'Team inbox', artifacts: [{ kind: 'spec', content: SPEC }] }]);
    expect(seen).toEqual([]);
  });

  it('push <n> --kind visual sends the fix\'s page and rounds with its kind and its issue\'s title, and prints the link', async () => {
    const { root, write } = checkout();
    write(`${VISUAL}/before-after.html`, PAGE);
    write(`${VISUAL}/variations-r2.html`, 'round 2');
    write(`${VISUAL}/variations-r1.html`, 'round 1');
    const { calls, fetch } = recordingFetch(() => pushed(`${BASE}/visual/d-1`));
    const seen: never[] | undefined = [];
    const result = await run(['push', '548', '--kind', 'visual'], { root, fetch, exec: withIssue('Visual: Omni links open in a new tab', seen) });
    expect(result).toEqual({ code: 0, out: `${BASE}/visual/d-1\nadded: before-after v1\n`, err: '' });
    expect(calls).toEqual([{
      url: `${BASE}/api/dossiers/push`, method: 'POST',
      body: {
        repo: 'acme/widgets', prd: 548, kind: 'visual', title: 'Omni links open in a new tab',
        artifacts: [{ kind: 'before-after', content: PAGE }, { kind: 'variations', content: 'round 1' }, { kind: 'variations', content: 'round 2' }],
      },
    }]);
    expect(seen).toEqual([['issue', 'view', '548', '--repo', 'acme/widgets', '--json', 'title', '--jq', '.title']]);
    expect(existsSync(join(root, DOSSIERS_FILE))).toBe(false);
  });

  it('push <n> --kind bug sends bug.md as its record, titled after the folder when the issue cannot be read', async () => {
    const { root, write } = checkout();
    write(`${BUGS}/bug.md`, '# Bug 571\n');
    const { calls, fetch } = recordingFetch(() => pushed(`${BASE}/bugs/d-1`));
    expect((await run(['push', '571', '--kind', 'bug'], { root, fetch, exec: withIssue(null) })).code).toBe(0);
    expect(calls[0].body).toEqual({ repo: 'acme/widgets', prd: 571, kind: 'bug', title: 'number-args', artifacts: [{ kind: 'bug-record', content: '# Bug 571\n' }] });
  });

  it('push <n> --kind prd is the PRD push', async () => {
    const { root, write } = checkout();
    write('.omni-loop/delivery/inbox/0007-team-inbox/spec.md', SPEC);
    const { calls, fetch } = recordingFetch(() => pushed(LINK));
    expect((await run(['push', '7', '--kind', 'prd'], { root, fetch })).code).toBe(0);
    expect(calls[0].body).not.toHaveProperty('kind');
  });

  it('exits 2 for a fix with no folder, an unknown kind, or a kind on open or status, and calls nothing', async () => {
    const { root } = checkout();
    const { calls, fetch } = recordingFetch(() => pushed(LINK));
    for (const args of [['push', '548', '--kind', 'visual'], ['push', '7', '--kind', 'epic'], ['link', '7', '--kind', 'epic'], ['push', '7', '--kind'],
      ['open', 'An idea', '--kind', 'bug'], ['status', '--kind', 'bug']]) {
      const result = await run(args, { root, fetch, exec: withIssue(null) });
      expect(result.code, JSON.stringify(args)).toBe(2);
      expect(result.err.trim().split('\n'), JSON.stringify(args)).toHaveLength(1);
    }
    expect(calls).toEqual([]);
  });

  it('link <n> --kind bug asks the app for the bug fix, and prints its link', async () => {
    const { root } = checkout({ record: RECORD });
    const { calls, fetch } = recordingFetch(() => json(200, { id: 'd-2', url: `${BASE}/bugs/d-2` }));
    expect(await run(['link', '571', '--kind', 'bug'], { root, fetch })).toEqual({ code: 0, out: `${BASE}/bugs/d-2\n`, err: '' });
    expect(calls.map((c) => c.url)).toEqual([`${BASE}/api/dossiers?repo=acme%2Fwidgets&prd=571&kind=bug`]);
  });

  it('link <n> --kind visual never falls back to a PRD the local record holds', async () => {
    const { root } = checkout({ record: RECORD });
    const { fetch } = recordingFetch(down);
    expect(await run(['link', '7', '--kind', 'visual'], { root, fetch })).toEqual({ code: 1, out: '', err: 'unreachable\n' });
  });
});
