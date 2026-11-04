// `omni approval tech request <n> [--to <login>]` and the Tech Approval in `omni approval <n>` and
// `omni prd <n>` (PRD 2608, s3), through `main()` on a fixture repository with the page stubbed: the
// request sent, the members printed one per line, a refusal in the database's own words, the line naming
// who the PRD waits on with the state `pending` and the stage `prd`, and an older reply with no `tech`
// reading as it always did.
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import type { Tokens } from '../../lib/ask/schema.ts';
import { sha256 } from '../../lib/dossier/folder.ts';
import { main } from '../omni.ts';

const HOST = 'omni.test';
const LINK = 'https://omni.test/prd/11111111-1111-4111-8111-111111111111';
const IN = '.omni-loop/delivery/inbox/2608-tech-approval';
const SPEC = '---\nprd: 2608\ntitle: A\nblocked-by: none\nspec: file\nphase0: server\n---\n\n# A\n';
const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: https://omni.test\n';

function checkout() {
  const entries: Record<string, Tokens> = { [HOST]: { access_token: 'a', refresh_token: 'r' } };
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': CONFIG, [`${IN}/spec.md`]: SPEC } });
  return { root, tokens: { read: (host: string) => entries[host] ?? null, write: () => {} } };
}

type Call = { method: string; url: string; body: unknown };

/** The page, stubbed: what the tech route and the approval route answer. */
function page({ tech = Response.json({}), approval = { url: LINK, approval: null } }: { tech?: Response | Error; approval?: unknown } = {}) {
  const calls: Call[] = [];
  const fetch = (url: string, init: RequestInit) => {
    calls.push({ method: init.method ?? 'GET', url, body: typeof init.body === 'string' ? JSON.parse(init.body) as unknown : null });
    const { pathname } = new URL(url);
    if (pathname === '/api/dossiers/approval/tech') return tech instanceof Error ? Promise.reject(tech) : Promise.resolve(tech);
    return Promise.resolve(pathname === '/api/dossiers/approval' ? Response.json(approval) : new Response('{}', { status: 404 }));
  };
  return { calls, fetch };
}

async function omni(args: string[], { root, tokens }: ReturnType<typeof checkout>, fetch: unknown, { signedIn = true }: { signedIn?: boolean } = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(args, {
    cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) }, env: {}, fetch,
    tokens: signedIn ? tokens : { read: () => null, write: () => {} },
  });
  return { code, out: out.join(''), err: err.join('') };
}

describe('omni approval tech request', () => {
  it('requests it from the person named, and says who the PRD now waits on', async () => {
    const stub = page({ tech: Response.json({ login: 'irisa', state: 'asked', url: LINK }) });
    expect(await omni(['approval', 'tech', 'request', '2608', '--to', 'irisa'], checkout(), stub.fetch)).toEqual({
      code: 0, err: '', out: `PRD 2608 · waiting for irisa's tech approval: ${LINK}\n`,
    });
    expect(stub.calls).toEqual([{
      method: 'POST', url: 'https://omni.test/api/dossiers/approval/tech', body: { repo: 'acme/widgets', prd: 2608, login: 'irisa' },
    }]);
  });

  it('prints the workspace members one per line with no --to, and requests nothing', async () => {
    const stub = page({ tech: Response.json({ members: [{ login: 'ada', name: 'Ada' }, { login: 'irisa', name: null }] }) });
    expect(await omni(['approval', 'tech', 'request', '2608'], checkout(), stub.fetch)).toEqual({ code: 0, err: '', out: 'ada\nirisa\n' });
    expect(stub.calls).toEqual([{ method: 'GET', url: 'https://omni.test/api/dossiers/approval/tech?repo=acme%2Fwidgets&prd=2608', body: null }]);
  });

  it("carries a refusal from the database to the terminal in its own words, and exits 1", async () => {
    for (const [status, words] of [
      [400, "PRD #2608 already waits for irisa's Tech Approval: nobody withdraws it or names another person."],
      [403, 'Only the author of PRD #2608 requests its Tech Approval.'],
    ] as const) {
      const stub = page({ tech: Response.json({ error: words }, { status }) });
      expect(await omni(['approval', 'tech', 'request', '2608', '--to', 'irisa'], checkout(), stub.fetch)).toEqual({
        code: 1, out: '', err: `omni approval: ${words}\n`,
      });
    }
  });

  it('holds on no sign-in, an unreachable page and a reply out of shape, exit 1', async () => {
    const signedOut = page();
    expect(await omni(['approval', 'tech', 'request', '2608', '--to', 'irisa'], checkout(), signedOut.fetch, { signedIn: false })).toEqual({
      code: 1, out: '', err: 'omni approval: no sign-in (omni signin) · held\n',
    });
    expect(signedOut.calls).toEqual([]);
    expect(await omni(['approval', 'tech', 'request', '2608'], checkout(), page({ tech: new TypeError('fetch failed') }).fetch)).toEqual({
      code: 1, out: '', err: 'omni approval: server unreachable · held, not failed\n',
    });
    expect(await omni(['approval', 'tech', 'request', '2608', '--to', 'irisa'], checkout(), page({ tech: Response.json({ nope: true }) }).fetch)).toEqual({
      code: 1, out: '', err: 'omni approval: refused (malformed reply)\n',
    });
    expect(await omni(['approval', 'tech', 'request', '2608'], checkout(), page({ tech: new Response('{}', { status: 500 }) }).fetch)).toEqual({
      code: 1, out: '', err: 'omni approval: refused (500)\n',
    });
  });

  it('refuses a usage it does not know, and a PRD no folder holds', async () => {
    const repo = checkout();
    for (const args of [['approval', 'tech'], ['approval', 'tech', 'request'], ['approval', 'tech', 'give', '2608'], ['approval', 'tech', 'request', '2608', 'x']]) {
      expect((await omni(args, repo, page().fetch)).code).toBe(2);
    }
    expect(await omni(['approval', 'tech', 'request', '42', '--to', 'irisa'], repo, page().fetch)).toMatchObject({ code: 1, err: expect.stringContaining('PRD 42 is in neither') as string });
  });

  it('is named by omni help approval', async () => {
    const out = await omni(['help', 'approval'], checkout(), page().fetch);
    expect(out.out).toContain('omni approval tech request <n> [--to <login>]');
  });
});

describe('the Tech Approval, read', () => {
  const tech = (state: string) => ({ login: 'irisa', state });

  it('reads pending in omni approval <n>, naming who it waits on, while it is asked or voided', async () => {
    for (const state of ['asked', 'voided']) {
      const stub = page({ approval: { url: LINK, approval: null, tech: tech(state) } });
      expect(await omni(['approval', '2608'], checkout(), stub.fetch)).toEqual({ code: 1, err: '', out: `PRD 2608 · waiting for irisa's tech approval: ${LINK}\n` });
      const json = await omni(['approval', '2608', '--json'], checkout(), stub.fetch);
      expect(JSON.parse(json.out)).toMatchObject({ state: 'pending', tech: tech(state) });
    }
  });

  it('reads as waiting for the approvers once the tech approval is given', async () => {
    const stub = page({ approval: { url: LINK, approval: null, tech: tech('approved') } });
    expect(await omni(['approval', '2608'], checkout(), stub.fetch)).toEqual({ code: 1, err: '', out: `PRD 2608 waits for approval: ${LINK}\n` });
  });

  it('adds who approves first to a voided approval, drifted as ever', async () => {
    const voided = {
      approver: { login: 'paul', member: true }, approvedAt: 't',
      files: [{ kind: 'spec', path: `${IN}/spec.md`, sha256: sha256(SPEC), versionId: 'v1' }],
      voids: [{ pusher: 'ada', kind: 'spec', from: 'a'.repeat(64), to: 'b'.repeat(64), voidedAt: 't' }],
    };
    const run = await omni(['approval', '2608'], checkout(), page({ approval: { url: LINK, approval: voided, tech: tech('voided') } }).fetch);
    expect(run.code).toBe(1);
    expect(run.out.trim().split('\n')).toEqual([
      `≠ spec.md · voided by ada's push aaaaaaa→bbbbbbb · ✗ refuse · approve again: ${LINK}`,
      `PRD 2608 · waiting for irisa's tech approval: ${LINK}`,
    ]);
  });

  it('prints the waiting line in omni prd <n>, with the stage prd', async () => {
    const stub = page({ approval: { url: LINK, approval: null, tech: tech('asked') } });
    const run = await omni(['prd', '2608'], checkout(), stub.fetch);
    expect(run.out).toContain('state: prd');
    expect(run.out).toContain(`approval: PRD 2608 · waiting for irisa's tech approval: ${LINK}`);
  });

  it('reads an older reply with no tech as today, the JSON naming none', async () => {
    const stub = page();
    expect(await omni(['approval', '2608'], checkout(), stub.fetch)).toEqual({ code: 1, err: '', out: `PRD 2608 waits for approval: ${LINK}\n` });
    const json = await omni(['approval', '2608', '--json'], checkout(), stub.fetch);
    expect(JSON.parse(json.out)).not.toHaveProperty('tech');
  });

  it('never lets a tech part it cannot read refuse the approval', async () => {
    const stub = page({ approval: { url: LINK, approval: null, tech: { login: 'irisa', state: 'dreaming' } } });
    expect(await omni(['approval', '2608'], checkout(), stub.fetch)).toEqual({ code: 1, err: '', out: `PRD 2608 waits for approval: ${LINK}\n` });
  });
});
