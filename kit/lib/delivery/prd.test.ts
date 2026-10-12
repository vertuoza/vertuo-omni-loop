import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { main } from '../../bin/omni.ts';
import { makeRepo } from '../../test/fixture.ts';
import { whereIs } from './prd.ts';
import { parsePrd } from '../ids.ts';

const D = '.omni-loop/delivery';

describe('whereIs', () => {
  it('describes a PRD in flight', () => {
    const { ctx } = makeRepo({ files: { [`${D}/inbox/0042-a/spec.md`]: 'x', [`${D}/outbox/0042-a/s1-01-x.md`]: 'y' } });
    expect(whereIs(ctx, parsePrd('42'))).toEqual({
      prd: 42, name: '0042-a', state: 'inbox', dir: `${D}/inbox/0042-a`,
      files: [`${D}/inbox/0042-a/spec.md`],
      outboxDir: `${D}/outbox/0042-a`,
      openItems: [`${D}/outbox/0042-a/s1-01-x.md`],
      repos: [],
    });
  });
  it('is null for an unknown PRD', () => {
    expect(whereIs(makeRepo().ctx, parsePrd(1))).toBeNull();
  });
});

// PRD 1299, slice s5: `omni prd <n>` reads a ◆ PRD's stage through `prdState()`, through `main()` on a
// fixture repository with the approval route stubbed; a ◇ PRD reads as today and never calls it.
describe('omni prd — a ◆ PRD (PRD 1299)', () => {
  const HOST = 'omni.test';
  const LINK = 'https://omni.test/prd/acme/widgets/1299';
  const IN = `${D}/inbox/1299-server-approval`;
  const SERVER_SPEC = '---\nprd: 1299\ntitle: A\nblocked-by: none\nspec: file\nphase0: server\n---\n\n# A\n';
  const REPO_SPEC = '---\nprd: 1299\ntitle: A\nblocked-by: none\nspec: file\n---\n\n# A\n';
  const PLAN = '# Plan\n';
  const hash = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
  const pinned = (kind: string, name: string, text: string) => ({ kind, path: `${IN}/${name}`, sha256: hash(text), versionId: `v-${kind}` });
  const approved = (over: Record<string, unknown> = {}) => ({
    url: LINK,
    approval: { approver: { login: 'ada', member: true }, approvedAt: '2026-10-09T10:00:00Z', files: [pinned('spec', 'spec.md', SERVER_SPEC), pinned('plan', 'plan.md', PLAN)], ...over },
  });

  function checkout(spec = SERVER_SPEC, files: Record<string, string> = {}, slug = 'acme/widgets') {
    const config = `kit: 1\nrepo:\n  slug: ${slug}\nask:\n  url: https://omni.test\n`;
    return makeRepo({ git: true, files: { '.omni-loop/config.yml': config, [`${IN}/spec.md`]: spec, [`${IN}/plan.md`]: PLAN, ...files } }).root;
  }

  /** Answers every call with `status` and `body` (or fails it when `body` is an Error), recording each URL. */
  function stub(status: number, body: unknown) {
    const urls: string[] = [];
    const fetch = (url: string) => {
      urls.push(url);
      return body instanceof Error ? Promise.reject(body) : Promise.resolve(new Response(JSON.stringify(body), { status }));
    };
    return { urls, fetch };
  }

  async function prdOf(root: string, fetch: unknown, signedIn = true) {
    const out: string[] = [];
    const err: string[] = [];
    const tokens = { read: (host: string) => (signedIn && host === HOST ? { access_token: 'a', refresh_token: 'r' } : null), write: () => undefined };
    const code = await main(['prd', '1299'], { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) }, env: {}, tokens, fetch });
    return { code, lines: out.join('').trimEnd().split('\n'), err: err.join('') };
  }

  it('a ◇ PRD prints exactly what it printed before, and never calls the server', async () => {
    const server = stub(200, approved());
    const run = await prdOf(checkout(REPO_SPEC), server.fetch);
    expect(run).toEqual({
      code: 0,
      err: '',
      lines: ['PRD 1299 — 1299-server-approval', 'state: inbox', `dir: ${IN}`, 'files:', `  - ${IN}/plan.md`, `  - ${IN}/spec.md`, `outbox: ${D}/outbox/1299-server-approval`, 'open items: none'],
    });
    expect(server.urls).toEqual([]);
  });

  it('a ◆ PRD not yet approved reports stage prd, its birthplace and the line with its dossier link', async () => {
    const run = await prdOf(checkout(), stub(200, { url: LINK, approval: null }).fetch);
    expect(run.code).toBe(0);
    expect(run.lines.slice(0, 5)).toEqual(['PRD 1299 — 1299-server-approval', 'state: prd', 'birthplace: server', `approval: PRD 1299 waits for approval: ${LINK}`, `dir: ${IN}`]);
  });

  it('a ◆ PRD approved reports inbox, with who approved and when', async () => {
    const server = stub(200, approved());
    const run = await prdOf(checkout(), server.fetch);
    expect(run.lines.slice(1, 4)).toEqual(['state: inbox', 'birthplace: server', 'approval: approved by ada · 2026-10-09T10:00:00Z']);
    expect(server.urls).toEqual(['https://omni.test/api/dossiers/approval?repo=acme%2Fwidgets&prd=1299']);
  });

  it.each([
    ['drifted', { [`${IN}/plan.md`]: '# Another\n' }, 200, approved(), `approval: ≠ plan.md · content · ✗ refuse · restore it, or approve again: ${LINK}`],
    ['refused', {}, 200, approved({ approver: { login: 'ada', member: false } }), 'approval: approver ada is not a workspace member'],
    ['refused', {}, 500, { error: 'boom' }, 'approval: refused (500)'],
    ['unreachable', {}, 0, new TypeError('fetch failed'), 'approval: server unreachable · held, not failed'],
  ] as const)('a ◆ PRD %s is not inbox, and prints its line', async (state, files, status, body, line) => {
    const run = await prdOf(checkout(SERVER_SPEC, files), stub(status, body).fetch);
    expect(run.lines.slice(1, 4)).toEqual([`state: ${state}`, 'birthplace: server', line]);
  });

  it('with no sign-in a ◆ PRD is held, says why on stderr, and calls nothing', async () => {
    const server = stub(200, approved());
    const run = await prdOf(checkout(), server.fetch, false);
    expect(run.lines[1]).toBe('state: unreachable');
    expect(run.err).toBe('omni prd: no sign-in (omni signin)\n');
    expect(server.urls).toEqual([]);
  });

  it('with no repository slug a ◆ PRD is held, saying why, and calls nothing', async () => {
    const server = stub(200, approved());
    const run = await prdOf(checkout(SERVER_SPEC, {}, 'null'), server.fetch);
    expect(run.lines[1]).toBe('state: unreachable');
    expect(run.err).toBe('omni prd: no repository slug (repo.slug)\n');
    expect(server.urls).toEqual([]);
  });

  it('a ◆ PRD shipped reads shipped, without a call', async () => {
    const server = stub(200, approved());
    const root = makeRepo({
      git: true,
      files: { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: https://omni.test\n', [`${D}/shipped/1299-server-approval/spec.md`]: SERVER_SPEC },
    }).root;
    const run = await prdOf(root, server.fetch);
    expect(run.lines.slice(1, 3)).toEqual(['state: shipped', 'birthplace: server']);
    expect(server.urls).toEqual([]);
  });
});
