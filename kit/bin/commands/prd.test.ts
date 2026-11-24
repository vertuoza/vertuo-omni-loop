// `omni prd <n>`'s `product:` line (PRD 1364, s6), through `main()` on a fixture repository, against a
// stubbed fetch that follows the dossier lookup's contract (`GET /api/dossiers?repo=<owner/name>&prd=<n>`,
// answering `{id, url, product}`). The sign-in is an in-memory token store, so nothing real is read.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Tokens } from '../../lib/ask/schema.ts';
import { makeRepo } from '../../test/fixture.ts';
import { main } from '../omni.ts';

const BASE = 'https://omni.example';
const HOST = 'omni.example';
const DIR = '.omni-loop/delivery/inbox/0007-quote';

const config = ({ enabled = true, url = BASE }: { enabled?: boolean | undefined; url?: string | null | undefined } = {}) =>
  `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${url ?? 'null'}\ndossier:\n  enabled: ${enabled}\n`;

function memoryTokens(entries: Record<string, Tokens> = {}) {
  const store: Record<string, Tokens> = { ...entries };
  return { read: (host: string) => store[host] ?? null, write: (host: string, tokens: Tokens) => { store[host] = tokens; } };
}
const signedIn = () => memoryTokens({ [HOST]: { access_token: 'access-1', refresh_token: 'refresh-1' } });

const json = (status: number, body = {}) => new Response(JSON.stringify(body), { status });

/** A fetch that answers every call with `reply()` and keeps each URL. */
function stubFetch(reply: () => Response) {
  const urls: string[] = [];
  const fetch = (url: string) => {
    urls.push(url);
    return new Promise<Response>((resolve) => {
      resolve(reply());
    });
  };
  return { urls, fetch };
}

async function prd({ reply, enabled, url, tokens = signedIn() }: {
  reply: () => Response; enabled?: boolean; url?: string | null; tokens?: ReturnType<typeof memoryTokens>;
}) {
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config({ enabled, url }), [`${DIR}/spec.md`]: 'x' } });
  const { urls, fetch } = stubFetch(reply);
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['prd', '7'], {
    cwd: root, tokens, env: {}, fetch, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) },
  });
  return { code, lines: out.join('').trimEnd().split('\n'), err: err.join(''), urls };
}

describe('omni prd: the product line (PRD 1364)', () => {
  it('prints the product the Omni page names for the PRD\'s dossier, last', async () => {
    const run = await prd({ reply: () => json(200, { id: 'd-7', url: `${BASE}/prd/d-7`, product: 'Mobile' }) });
    expect(run.code).toBe(0);
    expect(run.lines.at(-1)).toBe('product: Mobile');
    expect(run.lines.filter((line) => line.startsWith('product:'))).toHaveLength(1);
    expect(run.urls).toEqual([`${BASE}/api/dossiers?repo=acme%2Fwidgets&prd=7`]);
  });

  it('prints product: none for a dossier with no product, or one the page answers without a product', async () => {
    expect((await prd({ reply: () => json(200, { id: 'd-7', url: `${BASE}/prd/d-7`, product: null }) })).lines.at(-1)).toBe('product: none');
    expect((await prd({ reply: () => json(200, { id: 'd-7', url: `${BASE}/prd/d-7` }) })).lines.at(-1)).toBe('product: none');
  });

  it('prints product: none for a PRD with no dossier yet', async () => {
    expect((await prd({ reply: () => json(404, { error: 'No dossier for PRD #7 of acme/widgets.' }) })).lines.at(-1)).toBe('product: none');
  });

  it('says it could not tell, and still exits 0, when the page is unreachable, refuses, or there is no sign-in', async () => {
    const down = await prd({ reply: () => { throw new TypeError('fetch failed'); } });
    expect(down.code).toBe(0);
    expect(down.lines.at(-1)).toBe('product: unknown (unreachable)');
    expect((await prd({ reply: () => json(500, { error: 'down' }) })).lines.at(-1)).toBe('product: unknown (refused (500))');
    const anonymous = await prd({ reply: () => json(200, {}), tokens: memoryTokens() });
    expect(anonymous.lines.at(-1)).toBe('product: unknown (no sign-in: omni signin)');
    expect(anonymous.urls).toEqual([]);
  });

  it('prints no product line and calls nothing where dossiers are off: the page is where a product lives', async () => {
    for (const off of [{ enabled: false }, { url: null }]) {
      const run = await prd({ reply: () => json(200, { product: 'Mobile' }), ...off });
      expect(run.code).toBe(0);
      expect(run.lines.some((line) => line.startsWith('product:'))).toBe(false);
      expect(run.urls).toEqual([]);
    }
  });
});

describe('omni prd: a PRD whose folder is only on its feature branch (bug #3236)', () => {
  /** A repository whose default branch holds no folder for PRD 7, and whose remote feature branch
   * `origin/feat/quote` holds it in the inbox: how a mission's PM leaves the PRDs it writes. */
  function onItsFeatureBranchOnly() {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config({ enabled: false }) } });
    const run = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    run('switch', '-q', '-c', 'feat/quote');
    mkdirSync(join(root, DIR), { recursive: true });
    writeFileSync(join(root, DIR, 'spec.md'), 'x');
    run('add', '-A');
    run('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'docs(prd): quote');
    run('update-ref', 'refs/remotes/origin/feat/quote', 'HEAD');
    run('switch', '-q', 'main');
    run('branch', '-q', '-D', 'feat/quote');
    run('update-ref', 'refs/remotes/origin/main', 'main');
    return root;
  }

  it('names the remote feature branch that holds the folder, so the committee can read it there', async () => {
    const root = onItsFeatureBranchOnly();
    const err: string[] = [];
    const code = await main(['prd', '7'], { cwd: root, env: {}, stdout: { write: () => 0 }, stderr: { write: (s) => err.push(s) } });
    expect(code).toBe(1);
    expect(err.join('')).toContain('omni prd: PRD 7 is in neither');
    expect(err.join('')).toContain('its folder is on origin/feat/quote: read it there.');
  });

  it('names no branch when no remote branch holds the folder either', async () => {
    const { root } = makeRepo({ git: true, fetched: true, files: { '.omni-loop/config.yml': config({ enabled: false }) } });
    const err: string[] = [];
    expect(await main(['prd', '7'], { cwd: root, env: {}, stdout: { write: () => 0 }, stderr: { write: (s) => err.push(s) } })).toBe(1);
    expect(err.join('')).not.toContain('its folder is on');
  });
});
