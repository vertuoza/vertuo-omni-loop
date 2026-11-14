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
    for (const args of [['push'], ['pull', '2850'], ['push', 'x'], ['push', '2850', 'more']]) {
      expect((await mission(args, { root, fetch })).code).toBe(2);
    }
    expect(calls).toEqual([]);
  });
});
