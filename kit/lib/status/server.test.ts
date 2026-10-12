// PRD 1299, slice s5: the ◆ PRDs `omni status` and `omni next` read through `prdState()` from the
// checkout, and `omni status` through `main()` with the approval route stubbed.
import { describe, expect, it } from 'vitest';
import { main } from '../../bin/omni.ts';
import { makeRepo } from '../../test/fixture.ts';
import type { ApprovalReading } from '../approval/approval.ts';
import type { PrdNumber } from '../ids.ts';
import { serverPrds } from './server.ts';

const IN = '.omni-loop/delivery/inbox';
const spec = (prd: number, server: boolean) => `---\nprd: ${prd}\ntitle: A\nblocked-by: none\nspec: file\n${server ? 'phase0: server\n' : ''}---\n\n# A\n`;
const reading = (state: ApprovalReading['state'], lines = [`${state} line`]): ApprovalReading => ({ state, lines, url: 'L', approval: null, drift: [] });

describe('serverPrds', () => {
  const files = {
    [`${IN}/0005-five/spec.md`]: spec(5, true),
    [`${IN}/0006-six/spec.md`]: spec(6, false),
    [`${IN}/0007-seven/spec.md`]: spec(7, true),
    [`${IN}/0008-eight/spec.md`]: spec(8, true),
  };

  it("reads each ◆ PRD of the checkout's inbox through its approval, skips the ◇ and the shipped ones, and calls nothing for them", async () => {
    const { ctx } = makeRepo({ files });
    const asked: number[] = [];
    const approval = (prd: PrdNumber) => {
      asked.push(prd);
      return Promise.resolve(prd === 5 ? reading('pending') : reading('approved'));
    };
    const read = await serverPrds(ctx, new Set([8]), approval);
    expect(read).toEqual([
      { prd: 5, topic: 'five', stage: 'prd', lines: ['pending line'] },
      { prd: 7, topic: 'seven', stage: 'inbox', lines: ['approved line'] },
    ]);
    expect(asked).toEqual([5, 7]);
  });

  it('is empty with no inbox folder', async () => {
    expect(await serverPrds(makeRepo().ctx, new Set(), () => Promise.reject(new Error('never')))).toEqual([]);
  });
});

describe('omni status — a ◆ PRD (PRD 1299)', () => {
  const LINK = 'https://omni.test/prd/acme/widgets/5';
  const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: https://omni.test\n';

  async function statusOf(files: Record<string, string>, body: unknown) {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': CONFIG, ...files } });
    const urls: string[] = [];
    const fetch = (url: string) => {
      urls.push(url);
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    };
    const out: string[] = [];
    const tokens = { read: () => ({ access_token: 'a', refresh_token: 'r' }), write: () => undefined };
    const code = await main(['status'], { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: () => undefined }, env: {}, tokens, fetch });
    return { code, text: out.join(''), urls };
  }

  it('counts a ◆ PRD waiting for approval at PRD, not in the inbox', async () => {
    const run = await statusOf({ [`${IN}/0005-five/spec.md`]: spec(5, true) }, { url: LINK, approval: null });
    expect(run.code).toBe(0);
    expect(run.text).toMatch(/PRD 1 {5}INBOX 0/);
    expect(run.urls).toHaveLength(1);
  });

  it('holds a ◆ PRD whose approval is refused, with its line', async () => {
    const approval = { approver: { login: 'ada', member: false }, approvedAt: '2026-10-09T10:00:00Z', files: [] };
    const run = await statusOf({ [`${IN}/0005-five/spec.md`]: spec(5, true) }, { url: LINK, approval });
    expect(run.text).toMatch(/^ {2}held +#5 five\n +approver ada is not a workspace member$/m);
  });

  it('reads a ◇ PRD as before, and never calls the server', async () => {
    const run = await statusOf({ [`${IN}/0005-five/spec.md`]: spec(5, false) }, { url: LINK, approval: null });
    expect(run.text).toMatch(/PRD 0 {5}INBOX 1/);
    expect(run.urls).toEqual([]);
  });
});
