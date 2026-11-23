// `omni mission push <n>` (PRD 2842 s2), through `main()` on a fixture repository, against a stubbed
// fetch that follows the dossier push's contract (`POST /api/dossiers/push`, kind `mission`). The sign-in
// is an in-memory token store and the environment is passed in, so nothing real is read or written.
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';
import type { Tokens } from '../lib/ask/schema.ts';
import type { FetchInit } from '../test/fixture.ts';

const BASE = 'https://omni.example';
const HOST = 'omni.example';
const FOLDER = '.omni-loop/delivery/missions/2850-paid-online';
const RECORD = [
  '---', 'mission: 2850', 'title: Every quote can be paid online', 'fleet: night-shift',
  'goal: Every quote can be paid online, for every customer.', 'scope:', '  prds: [2803, 2804]', '  roadmaps: [12]', '---', '',
  '# Every quote can be paid online', '',
].join('\n');
const PAGE = '<!doctype html>\n<title>Every quote can be paid online</title>\n<a href="https://github.com/acme/widgets/issues/2850">the issue</a>\n';

const config = ({ enabled = true }: { enabled?: boolean | undefined } = {}) =>
  `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${BASE}\ndossier:\n  enabled: ${enabled}\n`;

const signedIn = (): { read: (host: string) => Tokens | null; write: () => void } => {
  const tokens: Tokens = { access_token: 'access-1', refresh_token: 'refresh-1' };
  return { read: (host) => (host === HOST ? tokens : null), write: () => undefined };
};

/** A checkout holding mission 2850's folder, its files overridden by `files` (undefined: left out). */
function checkout({ enabled, files = {} }: { enabled?: boolean; files?: Record<string, string | undefined> } = {}) {
  const all: Record<string, string | undefined> = {
    '.omni-loop/config.yml': config({ enabled }), [`${FOLDER}/mission.md`]: RECORD, [`${FOLDER}/mission.html`]: PAGE, ...files,
  };
  return makeRepo({ git: true, files: Object.fromEntries(Object.entries(all).filter((entry): entry is [string, string] => entry[1] !== undefined)) });
}

/** A fetch that answers every call with `reply()` and keeps each call's address, method and body. */
function recordingFetch(reply: () => Response | Promise<Response>) {
  const calls: { url: string; method?: string | undefined; body: unknown }[] = [];
  const fetch = (url: string, init: FetchInit) => {
    calls.push({ url, method: init.method, body: init.body === undefined ? undefined : JSON.parse(init.body) });
    return new Promise<Response>((resolve) => {
      resolve(reply());
    });
  };
  return { calls, fetch };
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

async function mission(args: string[], { root, fetch }: { root: string; fetch: unknown }) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['mission', ...args], {
    cwd: root, tokens: signedIn(), env: {}, fetch,
    stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) },
  });
  return { code, out: out.join(''), err: err.join('') };
}

describe('omni mission push', () => {
  it('sends mission.md and mission.html as a mission\'s page, titled from the front matter, and prints its link and what it added', async () => {
    const { root } = checkout();
    const { calls, fetch } = recordingFetch(() => json(200, {
      id: 'd-1', url: `${BASE}/missions/d-1`, added: [{ kind: 'mission-record', version: 1 }, { kind: 'brief', version: 1 }], unchanged: [],
    }));
    expect(await mission(['push', '2850'], { root, fetch })).toEqual({
      code: 0, out: `${BASE}/missions/d-1\nadded: mission-record v1, brief v1\n`, err: '',
    });
    expect(calls).toEqual([{
      url: `${BASE}/api/dossiers/push`, method: 'POST',
      body: {
        repo: 'acme/widgets', prd: 2850, kind: 'mission', title: 'Every quote can be paid online',
        artifacts: [{ kind: 'mission-record', content: RECORD }, { kind: 'brief', content: PAGE }],
      },
    }]);
  });

  it('prints that a second push of the same files added nothing', async () => {
    const { root } = checkout();
    const { fetch } = recordingFetch(() => json(200, { id: 'd-1', url: `${BASE}/missions/d-1`, added: [], unchanged: ['mission-record', 'brief'] }));
    expect(await mission(['push', '2850'], { root, fetch })).toEqual({
      code: 0, out: `${BASE}/missions/d-1\nadded: none · unchanged: mission-record, brief\n`, err: '',
    });
  });

  it('refuses a mission.md the brief\'s schema refuses, naming each field, and sends nothing', async () => {
    const { root } = checkout({ files: { [`${FOLDER}/mission.md`]: RECORD.replace('fleet: night-shift\n', '').replace('  roadmaps: [12]\n', 'mandate:\n  parallel: 9\n') } });
    const { calls, fetch } = recordingFetch(() => json(200, {}));
    expect(await mission(['push', '2850'], { root, fetch })).toEqual({
      code: 1, out: '',
      err: `invalid mission: ${FOLDER}/mission.md: fleet: missing.\ninvalid mission: ${FOLDER}/mission.md: mandate.parallel: is 1 to 4.\n`,
    });
    expect(calls).toEqual([]);
  });

  it('refuses a mission.md naming another mission, a missing mission.html, and a page that loads from the network', async () => {
    const { fetch, calls } = recordingFetch(() => json(200, {}));
    const other = checkout({ files: { [`${FOLDER}/mission.md`]: RECORD.replace('mission: 2850', 'mission: 2851') } });
    expect((await mission(['push', '2850'], { root: other.root, fetch })).err).toBe(`invalid mission: ${FOLDER}/mission.md: mission is #2851, not #2850.\n`);
    const pageless = checkout({ files: { [`${FOLDER}/mission.html`]: undefined } });
    expect(await mission(['push', '2850'], { root: pageless.root, fetch })).toEqual({ code: 1, out: '', err: `invalid mission: ${FOLDER} has no mission.html.\n` });
    const loading = checkout({ files: { [`${FOLDER}/mission.html`]: '<img src="https://cdn.example.com/a.png">' } });
    expect((await mission(['push', '2850'], { root: loading.root, fetch })).err)
      .toBe(`invalid mission: ${FOLDER}/mission.html: loads from the network: <img src> https://cdn.example.com/a.png; inline it, and keep only links a person follows.\n`);
    expect(calls).toEqual([]);
  });

  it('says why the app refused the push, in its own words, and exits 1', async () => {
    const { root } = checkout();
    const { fetch } = recordingFetch(() => json(400, { error: 'fleet: night-shift is no Virtual Fleet of this workspace.' }));
    expect(await mission(['push', '2850'], { root, fetch })).toEqual({
      code: 1, out: '', err: 'refused (400): fleet: night-shift is no Virtual Fleet of this workspace.\n',
    });
  });

  it('says unreachable when the app cannot be reached, off when dossiers are off, and sends nothing while off', async () => {
    const { root } = checkout();
    const down = () => { throw new TypeError('fetch failed'); };
    expect(await mission(['push', '2850'], { root, fetch: recordingFetch(down).fetch })).toEqual({ code: 1, out: '', err: 'unreachable\n' });
    const off = checkout({ enabled: false });
    const { calls, fetch } = recordingFetch(() => json(200, {}));
    expect(await mission(['push', '2850'], { root: off.root, fetch })).toEqual({ code: 1, out: '', err: 'off\n' });
    expect(calls).toEqual([]);
  });

  it('is a usage error for a mission with no folder, a verb it does not know, or a number that is none', async () => {
    const { root } = checkout();
    const { calls, fetch } = recordingFetch(() => json(200, {}));
    const none = await mission(['push', '2851'], { root, fetch });
    expect(none).toMatchObject({ code: 2, out: '' });
    expect(none.err).toContain('mission 2851 has no folder under .omni-loop/delivery/missions');
    for (const args of [['push'], ['pull', '2850'], ['push', 'x'], ['push', '2850', 'more'], ['push', '2850', '--keep'], ['drop', '12'], ['drop', '12', 'x'], ['drop', '12', '7', 'more']]) {
      expect((await mission(args, { root, fetch })).code).toBe(2);
    }
    expect(calls).toEqual([]);
  });
});

describe('omni mission drop (PRD 2896 s7)', () => {
  const dropped = (over: Record<string, unknown> = {}) => ({
    drop: { mission: 'm-1', branch: 'mission/12-faster-quotes', prd: 7, sharing: [9], dropped: [7, 9], keep: false, ...over },
  });

  it('asks the app to take the PRD off the branch, and prints what leaves with it and what shares its territory', async () => {
    const { root } = checkout();
    const { calls, fetch } = recordingFetch(() => json(200, dropped()));
    const done = await mission(['drop', '12', '7'], { root, fetch });
    expect(done.code).toBe(0);
    expect(done.out).toContain('PRD 7 will be dropped from mission/12-faster-quotes');
    expect(done.out).toContain('the default branch is never changed');
    expect(done.out).toContain('dropped with it: PRD 9');
    expect(calls).toEqual([{ url: `${BASE}/api/missions/drop`, method: 'POST', body: { repo: 'acme/widgets', mission: 12, prd: 7, keep: false } }]);
  });

  it('with --keep sends it and says the PRDs sharing the territory stay', async () => {
    const { root } = checkout();
    const { calls, fetch } = recordingFetch(() => json(200, dropped({ dropped: [7], keep: true })));
    const done = await mission(['drop', '12', '7', '--keep'], { root, fetch });
    expect(done.out).toContain('kept on the branch (--keep): PRD 9');
    expect(calls[0]?.body).toEqual({ repo: 'acme/widgets', mission: 12, prd: 7, keep: true });
  });

  it('prints the app\'s refusal, and says off, unreachable or unsigned in one line', async () => {
    const { root } = checkout();
    const refused = recordingFetch(() => json(409, { error: 'PRD 7 is not on mission/12-faster-quotes: there is nothing to drop.' }));
    expect(await mission(['drop', '12', '7'], { root, fetch: refused.fetch })).toEqual({ code: 1, out: '', err: 'refused (409): PRD 7 is not on mission/12-faster-quotes: there is nothing to drop.\n' });
    const down = () => { throw new TypeError('fetch failed'); };
    expect(await mission(['drop', '12', '7'], { root, fetch: recordingFetch(down).fetch })).toEqual({ code: 1, out: '', err: 'unreachable\n' });
    const off = checkout({ enabled: false });
    expect(await mission(['drop', '12', '7'], { root: off.root, fetch: recordingFetch(() => json(200, {})).fetch })).toEqual({ code: 1, out: '', err: 'off\n' });
  });
});

describe('omni mission overturn (PRD 2896 s11)', () => {
  const overturned = (over: Record<string, unknown> = {}) => ({ overturn: { mission: 'm-1', branch: 'mission/12-faster-quotes', decision: '7', prd: 7, onBranch: true, ...over } });

  it('sends the decision and prints what changes: the decision stays, the PRD leaves the branch', async () => {
    const { root } = checkout();
    const { calls, fetch } = recordingFetch(() => json(200, overturned()));
    const done = await mission(['overturn', '12', '7'], { root, fetch });
    expect(done.code).toBe(0);
    expect(done.out).toContain('The decision stays as it was recorded; yours is added beside it.');
    expect(done.out).toContain('approve it yourself');
    expect(done.out).toContain('PRD 7 leaves mission/12-faster-quotes');
    expect(calls).toEqual([{ url: `${BASE}/api/missions/overturn`, method: 'POST', body: { repo: 'acme/widgets', mission: 12, decision: '7' } }]);
  });

  it('names an item\'s answer by <prd>/<item>, and prints no drop for a PRD that was not on the branch', async () => {
    const { root } = checkout();
    const { calls, fetch } = recordingFetch(() => json(200, overturned({ decision: '7/s1-01', branch: null, onBranch: false })));
    const done = await mission(['overturn', '12', '7/s1-01'], { root, fetch });
    expect(done.out).toContain('s1-01 of PRD 7 is open again for you');
    expect(done.out).not.toContain('leaves');
    expect(calls[0]?.body).toMatchObject({ decision: '7/s1-01' });
  });

  it('refuses a decision that is no name, prints the app\'s refusal, and says off or unreachable in one line', async () => {
    const { root } = checkout();
    const none = recordingFetch(() => json(200, {}));
    expect((await mission(['overturn', '12', 'x'], { root, fetch: none.fetch })).code).toBe(2);
    expect(none.calls).toEqual([]);
    const refused = recordingFetch(() => json(409, { error: 'The fleet carried no decision 7 in mission 12.' }));
    expect(await mission(['overturn', '12', '7'], { root, fetch: refused.fetch })).toEqual({ code: 1, out: '', err: 'refused (409): The fleet carried no decision 7 in mission 12.\n' });
    const down = () => { throw new TypeError('fetch failed'); };
    expect(await mission(['overturn', '12', '7'], { root, fetch: recordingFetch(down).fetch })).toEqual({ code: 1, out: '', err: 'unreachable\n' });
    expect(await mission(['overturn', '12', '7'], { root: checkout({ enabled: false }).root, fetch: recordingFetch(() => json(200, {})).fetch })).toEqual({ code: 1, out: '', err: 'off\n' });
    expect(await mission(['overturn', '12', '7'], { root, fetch: recordingFetch(() => json(200, {})).fetch })).toEqual({ code: 1, out: '', err: 'refused (no overturn in the reply)\n' });
  });
});

describe('omni mission request (PRD omni-loop-24 s5)', () => {
  const ID = '3f2a9c1e-7b4d-4e8a-9c2f-1a2b3c4d5e6f';
  const reply = { request: { id: ID, repo: 'acme/widgets', fleet: 'night-shift', goal: 'Quotes get a dark mode', requestedBy: 'ada', mission: null, createdAt: '2026-11-23T10:00:00Z' } };

  it('prints the fleet and the goal of the request the page holds', async () => {
    const { root } = checkout();
    const { calls, fetch } = recordingFetch(() => json(200, reply));
    expect(await mission(['request', ID], { root, fetch })).toEqual({ code: 0, out: 'fleet: night-shift\ngoal: Quotes get a dark mode\n', err: '' });
    expect(calls).toEqual([{ url: `${BASE}/api/missions/requests/${ID}`, method: 'GET', body: undefined }]);
  });

  it('says one line and exits 1 when the page refuses, is down, or answers no request', async () => {
    const { root } = checkout();
    const refused = recordingFetch(() => json(404, { error: 'No such mission request.' }));
    expect((await mission(['request', ID], { root, fetch: refused.fetch })).code).toBe(1);
    expect((await mission(['request', ID], { root, fetch: refused.fetch })).err).toMatch(/^refused \(404\)/);
    const down = (): Response => { throw new TypeError('fetch failed'); };
    expect(await mission(['request', ID], { root, fetch: recordingFetch(down).fetch })).toEqual({ code: 1, out: '', err: 'unreachable\n' });
    expect(await mission(['request', ID], { root, fetch: recordingFetch(() => json(200, {})).fetch })).toEqual({ code: 1, out: '', err: 'refused (no request in the reply)\n' });
  });

  it('refuses an id that is not a uuid before any call', async () => {
    const { root } = checkout();
    const none = recordingFetch(() => json(200, reply));
    expect((await mission(['request', 'dark-mode'], { root, fetch: none.fetch })).code).toBe(2);
    expect(none.calls).toEqual([]);
  });
});
