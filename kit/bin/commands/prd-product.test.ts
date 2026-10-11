// `omni prd <key>-<n> [--show <kind>]` (PRD 1548 s2), through `main()` on a fixture repository, against a
// stubbed fetch following the dossier routes' contract for a product PRD (`apps/galaxy/src/dossier/api.ts`):
// the lookup answers `{id, url, prdId, title, product, approval}`, the get the latest version of one kind.
import { describe, expect, it } from 'vitest';
import type { Tokens } from '../../lib/ask/schema.ts';
import { sha256 } from '../../lib/dossier/folder.ts';
import { makeRepo } from '../../test/fixture.ts';
import { main } from '../omni.ts';

const BASE = 'https://omni.example';
const HOST = 'omni.example';
const LINK = `${BASE}/prd/d-12`;
const SPEC = '---\ntitle: Offline photo upload\n---\n\n# Offline photo upload\n';

const config = (enabled = true) => `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${BASE}\ndossier:\n  enabled: ${enabled}\n`;

function memoryTokens(entries: Record<string, Tokens> = {}) {
  const store: Record<string, Tokens> = { ...entries };
  return { read: (host: string) => store[host] ?? null, write: (host: string, tokens: Tokens) => { store[host] = tokens; } };
}
const signedIn = () => memoryTokens({ [HOST]: { access_token: 'access-1', refresh_token: 'refresh-1' } });
const json = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });
const down = (): Response => { throw new TypeError('fetch failed'); };

const OFF_LINE: unknown = expect.stringMatching(/^omni prd: a product PRD lives on the Omni page, and dossiers are off here/);
const FOUND = { id: 'd-12', url: LINK, prdId: 'mobile-12', title: 'Offline photo upload', product: 'Mobile', approval: null };
const APPROVAL = { approver: { login: 'ada', member: true }, approvedAt: '2026-10-11T09:30:00.000Z', files: [{ kind: 'spec', path: 'spec.md', sha256: sha256(SPEC), versionId: 'v1' }] };
const LATEST = { id: 'd-12', prdId: 'mobile-12', url: LINK, kind: 'spec', version: 2, sha256: sha256(SPEC), content: SPEC, createdAt: '2026-10-11T09:00:00.000Z' };

async function prd(args: string[], { reply, enabled, tokens = signedIn(), root, at = '2026-10-11T12:00:00.000Z', files = {} }: {
  reply: (url: string) => Response; enabled?: boolean; tokens?: ReturnType<typeof memoryTokens>; root?: string; at?: string; files?: Record<string, string>;
}) {
  const cwd = root ?? makeRepo({ git: true, files: { '.omni-loop/config.yml': config(enabled), ...files } }).root;
  const urls: string[] = [];
  const fetch = (url: string) => {
    urls.push(url);
    return new Promise<Response>((resolve) => { resolve(reply(url)); });
  };
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['prd', ...args], {
    cwd, tokens, env: {}, fetch, now: () => Date.parse(at), stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) },
  });
  return { code, out: out.join(''), err: err.join(''), urls, root: cwd };
}

describe('omni prd <key>-<n>: a product PRD, read from the Omni page', () => {
  it('prints its title, its stage read from its approval, birthplace server, its approval lines, its page and its product', async () => {
    const run = await prd(['mobile-12'], { reply: () => json(200, FOUND) });
    expect(run).toMatchObject({ code: 0, err: '' });
    expect(run.out).toBe([
      'PRD mobile-12 — Offline photo upload', 'state: prd', 'birthplace: server', `approval: PRD mobile-12 waits for approval: ${LINK}`,
      `page: ${LINK}`, 'product: Mobile', '',
    ].join('\n'));
    expect(run.urls).toEqual([`${BASE}/api/dossiers?product=mobile&prd=12&repo=acme%2Fwidgets`]);
  });

  it('reads inbox once approved, drifted once a push voided it', async () => {
    expect((await prd(['mobile-12'], { reply: () => json(200, { ...FOUND, approval: APPROVAL }) })).out).toContain('state: inbox\nbirthplace: server\napproval: approved by ada · 2026-10-11T09:30:00.000Z\n');
    const voided = { ...APPROVAL, voids: [{ pusher: 'bob', kind: 'spec', from: 'a'.repeat(64), to: 'b'.repeat(64), voidedAt: '2026-10-11T10:00:00.000Z' }] };
    expect((await prd(['mobile-12'], { reply: () => json(200, { ...FOUND, approval: voided }) })).out).toContain('state: drifted\n');
  });

  it('holds while the server is down, saying so; says none for a PRD the page has not', async () => {
    const run = await prd(['mobile-12'], { reply: down });
    expect(run).toMatchObject({ code: 0, out: 'PRD mobile-12\nstate: unreachable\nbirthplace: server\napproval: server unreachable · held, not failed\n' });
    expect(await prd(['mobile-12'], { reply: () => json(404, { error: 'No PRD mobile-12.' }) })).toMatchObject({ code: 1, out: '', err: 'omni prd: no PRD mobile-12 on the Omni page.\n' });
  });

  it('needs dossiers on and a sign-in, saying which is missing', async () => {
    expect(await prd(['mobile-12'], { reply: () => json(200, FOUND), enabled: false })).toMatchObject({ code: 1, err: OFF_LINE });
    expect(await prd(['mobile-12'], { reply: () => json(200, FOUND), tokens: memoryTokens() })).toMatchObject({ code: 1, err: 'omni prd: no sign-in (omni signin)\n' });
  });

  it('omni prd 12 still reads the repository\'s own PRD 12, and calls nothing', async () => {
    const run = await prd(['12'], { reply: () => json(200, FOUND), enabled: false, files: { '.omni-loop/delivery/inbox/0012-quote/spec.md': '# quote\n' } });
    expect(run.code).toBe(0);
    expect(run.out.split('\n')[0]).toBe('PRD 12 — 0012-quote');
    expect(run.urls).toEqual([]);
  });

  it.each(['mobile', '12-mobile', 'Mobile-12'])('refuses %s by name', async (id) => {
    const run = await prd([id], { reply: () => json(200, FOUND) });
    expect(run.code).toBe(2);
    expect(run.err).toContain(`PRD "${id}": a PRD is its number (12) or its product's key and its number (mobile-12)`);
    expect(run.urls).toEqual([]);
  });
});

describe('omni prd <key>-<n> --show <kind>: the latest version, read-only, as of when it was read', () => {
  it('prints it under one line naming its kind, its version and as of when', async () => {
    const run = await prd(['mobile-12', '--show', 'spec'], { reply: () => json(200, LATEST) });
    expect(run).toMatchObject({ code: 0, err: '', out: `spec of PRD mobile-12 · v2 · as of 2026-10-11T12:00:00.000Z\n\n${SPEC}` });
    expect(run.urls).toEqual([`${BASE}/api/dossiers/get?product=mobile&prd=12&kind=spec&repo=acme%2Fwidgets`]);
  });

  it('with the server down, prints the last-read copy, marked as of its earlier time', async () => {
    const first = await prd(['mobile-12', '--show', 'spec'], { reply: () => json(200, LATEST), at: '2026-10-11T08:00:00.000Z' });
    const later = await prd(['mobile-12', '--show', 'spec'], { reply: down, root: first.root });
    expect(later).toMatchObject({ code: 0, out: `spec of PRD mobile-12 · v2 · as of 2026-10-11T08:00:00.000Z · last-read copy, server unreachable\n\n${SPEC}` });
  });

  it('with the server down and no copy, holds, exit 1; none for a kind with no version', async () => {
    expect(await prd(['mobile-12', '--show', 'plan'], { reply: down })).toMatchObject({ code: 1, out: '', err: 'omni prd: held · server unreachable · no last-read copy of plan\n' });
    expect(await prd(['mobile-12', '--show', 'plan'], { reply: () => json(404, { error: 'PRD mobile-12 has no plan yet.' }) })).toMatchObject({ code: 1, err: 'omni prd: PRD mobile-12 has no plan on the Omni page.\n' });
  });

  it('refuses --show on a repository\'s PRD, or a kind a PRD has not', async () => {
    expect((await prd(['12', '--show', 'spec'], { reply: () => json(200, LATEST) })).code).toBe(2);
    expect((await prd(['mobile-12', '--show', 'bug-record'], { reply: () => json(200, LATEST) })).code).toBe(2);
  });
});
