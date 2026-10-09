// `omni approval <n> [--json]` (PRD 1299, s4), through `main()` on a fixture repository with the
// approval route stubbed: each state, its line and its exit code (0 on approved, 1 otherwise),
// pairing by kind after the folder moved, and `content` against `whitespace only`.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { main } from '../omni.ts';
import type { Tokens } from '../../lib/ask/schema.ts';

const HOST = 'omni.test';
const LINK = 'https://omni.test/prd/acme/widgets/1299';
const IN = '.omni-loop/delivery/inbox/1299-server-approval';
const SHIPPED = '.omni-loop/delivery/shipped/1299-server-approval';
const SPEC = '---\nprd: 1299\ntitle: A\nblocked-by: none\nspec: file\nphase0: server\n---\n\n# A\n';
const PLAN = '# Plan\n';
const PAGE = '<html></html>\n';

const hash = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const pin = (kind: string, name: string, text: string, content?: string) =>
  ({ kind, path: `${IN}/${name}`, sha256: hash(text), versionId: `v-${kind}`, ...(content === undefined ? {} : { content }) });
const FILES = [pin('spec', 'spec.md', SPEC), pin('plan', 'plan.md', PLAN), pin('before-after', 'before-after.html', PAGE)];
const approval = (over: Record<string, unknown> = {}) =>
  ({ url: LINK, approval: { approver: { login: 'ada', member: true }, approvedAt: '2026-10-09T10:00:00Z', files: FILES, ...over } });

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out: () => out.join(''), err: () => err.join(''), stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
}

const memoryTokens = (entries: Record<string, Tokens>) =>
  ({ read: (host: string) => entries[host] ?? null, write: (host: string, tokens: Tokens) => { entries[host] = tokens; } });

const config = (url: string | null, slug = 'acme/widgets') => `kit: 1\nrepo:\n  slug: ${slug}\nask:\n  url: ${url ?? 'null'}\n`;

function checkout({ dir = IN, files = {}, url = 'https://omni.test', slug }: { dir?: string; files?: Record<string, string>; url?: string | null; slug?: string } = {}) {
  return makeRepo({
    git: true,
    files: { '.omni-loop/config.yml': config(url, slug), [`${dir}/spec.md`]: SPEC, [`${dir}/plan.md`]: PLAN, [`${dir}/before-after.html`]: PAGE, ...files },
  }).root;
}

/** Answers every call with `status` and `body`, recording each URL. */
function stub(status: number, body: unknown) {
  const urls: string[] = [];
  const fetch = (url: string) => {
    urls.push(url);
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  };
  return { urls, fetch };
}

async function approvalOf(root: string, args: string[], fetch: unknown, signedIn = true) {
  const s = io();
  const tokens = memoryTokens(signedIn ? { [HOST]: { access_token: 'a', refresh_token: 'r' } } : {});
  const code = await main(['approval', ...args], { cwd: root, ...s, tokens, env: {}, fetch });
  return { code, out: s.out(), err: s.err() };
}

describe('omni approval', () => {
  it('prints who approved and when, and exits 0, after one call with the repository and the number', async () => {
    const server = stub(200, approval());
    expect(await approvalOf(checkout(), ['1299'], server.fetch)).toEqual({ code: 0, out: 'approved by ada · 2026-10-09T10:00:00Z\n', err: '' });
    expect(server.urls).toEqual(['https://omni.test/api/dossiers/approval?repo=acme%2Fwidgets&prd=1299']);
  });

  it('still matches once omni ship moved the folder, files paired by kind', async () => {
    expect((await approvalOf(checkout({ dir: SHIPPED }), ['1299'], stub(200, approval()).fetch)).code).toBe(0);
  });

  it('says the PRD waits for approval, with its dossier link, and exits 1', async () => {
    expect(await approvalOf(checkout(), ['1299'], stub(200, { url: LINK, approval: null }).fetch)).toEqual({
      code: 1, out: `PRD 1299 waits for approval: ${LINK}\n`, err: '',
    });
  });

  it('refuses a changed plan as content, and one changed only in spacing as whitespace only', async () => {
    const changed = await approvalOf(checkout({ files: { [`${IN}/plan.md`]: '# Another plan\n' } }), ['1299'], stub(200, approval()).fetch);
    expect(changed).toEqual({ code: 1, out: `≠ plan.md · content · ✗ refuse · restore it, or approve again: ${LINK}\n`, err: '' });
    const files = [pin('plan', 'plan.md', PLAN, PLAN)];
    const spaced = await approvalOf(checkout({ files: { [`${IN}/plan.md`]: '#  Plan\n\n' } }), ['1299'], stub(200, approval({ files })).fetch);
    expect(spaced).toEqual({ code: 1, out: `≠ plan.md · whitespace only · ✗ refuse · restore it, or approve again: ${LINK}\n`, err: '' });
  });

  it('refuses an approver who left the workspace', async () => {
    const run = await approvalOf(checkout(), ['1299'], stub(200, approval({ approver: { login: 'ada', member: false } })).fetch);
    expect(run).toEqual({ code: 1, out: 'approver ada is not a workspace member\n', err: '' });
  });

  it('refuses an error the page answered, naming its status', async () => {
    expect(await approvalOf(checkout(), ['1299'], stub(500, { error: 'boom' }).fetch)).toEqual({ code: 1, out: 'refused (500)\n', err: '' });
  });

  it('holds the PRD when the server cannot be reached', async () => {
    const down = () => Promise.reject(new TypeError('fetch failed'));
    expect(await approvalOf(checkout(), ['1299'], down)).toEqual({ code: 1, out: 'server unreachable · held, not failed\n', err: '' });
  });

  it('holds the PRD with no sign-in, saying why on stderr, and calls nothing', async () => {
    const server = stub(200, approval());
    const run = await approvalOf(checkout(), ['1299'], server.fetch, false);
    expect(run).toEqual({ code: 1, out: 'server unreachable · held, not failed\n', err: 'omni approval: no sign-in (omni signin)\n' });
    expect(server.urls).toEqual([]);
  });

  it('prints --json as the state, who, when, the pinned files and what drifted', async () => {
    const run = await approvalOf(checkout({ files: { [`${IN}/plan.md`]: 'x' } }), ['1299', '--json'], stub(200, approval()).fetch);
    expect(run.code).toBe(1);
    expect(JSON.parse(run.out)).toEqual({
      prd: 1299, state: 'drifted', approver: 'ada', member: true, at: '2026-10-09T10:00:00Z', url: LINK,
      files: FILES, drift: [{ kind: 'plan', file: `${IN}/plan.md`, how: 'content' }],
      lines: [`≠ plan.md · content · ✗ refuse · restore it, or approve again: ${LINK}`],
    });
  });

  it('prints --json with no approver while it waits', async () => {
    const run = await approvalOf(checkout(), ['1299', '--json'], stub(200, { url: LINK, approval: null }).fetch);
    expect(JSON.parse(run.out)).toMatchObject({ prd: 1299, state: 'pending', approver: null, member: null, at: null, files: [], drift: [] });
  });

  it('says a PRD no folder holds is not there, and exits 1', async () => {
    const server = stub(200, approval());
    const run = await approvalOf(checkout(), ['42'], server.fetch);
    expect(run.code).toBe(1);
    expect(run.err).toMatch(/PRD 42 is in neither/);
    expect(server.urls).toEqual([]);
  });

  it('is a usage error without one number, or without a repository slug', async () => {
    expect((await approvalOf(checkout(), [], stub(200, {}).fetch)).code).toBe(2);
    expect((await approvalOf(checkout(), ['1299', '7'], stub(200, {}).fetch)).code).toBe(2);
    expect((await approvalOf(checkout({ slug: 'null' }), ['1299'], stub(200, {}).fetch)).code).toBe(2);
  });
});

describe('omni approval flag', () => {
  it('prints the flag the page answers, after one call with the repository, and exits 0', async () => {
    const { urls, fetch } = stub(200, { phase0: 'server' });
    const { code, out } = await approvalOf(checkout(), ['flag'], fetch);
    expect(code).toBe(0);
    expect(out).toBe('phase 0: server\n');
    expect(urls).toEqual(['https://omni.test/api/repositories/phase0?repo=acme%2Fwidgets']);
  });

  it('falls back to pr, saying why, when the page refuses, and exits 1', async () => {
    const { fetch } = stub(403, { error: 'not a member' });
    const { code, out } = await approvalOf(checkout(), ['flag'], fetch);
    expect(code).toBe(1);
    expect(out).toBe('phase 0: pr · the flag could not be read: refused (403)\n');
  });

  it('falls back to pr with no sign-in, and calls nothing', async () => {
    const { urls, fetch } = stub(200, { phase0: 'server' });
    const { code, out } = await approvalOf(checkout(), ['flag'], fetch, false);
    expect(code).toBe(1);
    expect(out).toBe('phase 0: pr · the flag could not be read: no sign-in (omni signin)\n');
    expect(urls).toEqual([]);
  });

  it('prints --json as the flag and why', async () => {
    const { fetch } = stub(200, { phase0: 'pr' });
    const { out } = await approvalOf(checkout(), ['flag', '--json'], fetch);
    expect(JSON.parse(out)).toEqual({ flag: 'pr', why: null });
  });
});
