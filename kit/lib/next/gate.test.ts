// PRD 1299, slice s5: `omni next <prd>` reads a ◆ PRD's approval through `prdState()` first, through
// `main()` on a fixture repository, with GitHub stubbed empty and the approval route stubbed.
import type { ExecFileSyncOptions } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { main } from '../../bin/omni.ts';
import { makeRepo, realExec } from '../../test/fixture.ts';
import { WAKE_HINTS } from './decide.ts';

const LINK = 'https://omni.test/prd/acme/widgets/7';
const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: https://omni.test\n';
const DIR = '.omni-loop/delivery/inbox/0007-widgets';
const PLAN = ['# A plan', '', '| id | slice | territory | blocked by | wave |', '| --- | --- | --- | --- | --- |', '| s1 | Alpha | `a/` | — | 1 |', ''].join('\n');
const spec = (server: boolean) => `---\nprd: 7\ntitle: A\nblocked-by: none\nspec: file\n${server ? 'phase0: server\n' : ''}---\n\n# A\n`;

/** gh answers every list with nothing (no phase-0 PR, no feature PR, no sub-PR); git runs, fetch aside. */
function exec(file: string, args: readonly string[], options: ExecFileSyncOptions = {}): string {
  if (file === 'git') return args[0] === 'fetch' ? '' : realExec(file, args, options);
  return '[]';
}

async function nextOf(server: boolean, body: unknown) {
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': CONFIG, [`${DIR}/spec.md`]: spec(server), [`${DIR}/plan.md`]: PLAN } });
  const urls: string[] = [];
  const fetch = (url: string) => {
    urls.push(url);
    return body instanceof Error ? Promise.reject(body) : Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  };
  const out: string[] = [];
  const tokens = { read: () => ({ access_token: 'a', refresh_token: 'r' }), write: () => undefined };
  const code = await main(['next', '7', '--json'], { cwd: root, exec, stdout: { write: (s: string) => out.push(s) }, stderr: { write: () => undefined }, env: {}, tokens, fetch });
  const parsed: unknown = JSON.parse(out.join(''));
  return { code, verdict: (parsed as { prds: unknown[] }).prds[0], urls };
}

describe('omni next — a ◆ PRD (PRD 1299)', () => {
  it('a ◆ PRD waiting for approval is parked on a reviewer, naming its dossier link', async () => {
    const run = await nextOf(true, { url: LINK, approval: null });
    expect(run.code).toBe(0);
    expect(run.verdict).toEqual({ prd: 7, verdict: 'park', why: 'waits on a reviewer: the PRD waits for approval on its page', link: LINK });
  });

  it('a ◆ PRD whose server does not answer is held, not failed', async () => {
    const run = await nextOf(true, new TypeError('fetch failed'));
    expect(run.verdict).toEqual({ prd: 7, verdict: 'wait', why: 'server unreachable · held, not failed', wakeHint: WAKE_HINTS.unreadable });
  });

  it('a ◇ PRD reads as before, and never calls the server', async () => {
    const run = await nextOf(false, { url: LINK, approval: null });
    expect(run.verdict).toMatchObject({ prd: 7, verdict: 'act', skill: 'wave' });
    expect(run.urls).toEqual([]);
  });
});
