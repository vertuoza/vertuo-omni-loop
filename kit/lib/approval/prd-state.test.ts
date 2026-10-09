// `prdState()` (PRD 1299, s4): one table, both birthplaces against the folder's states and the five
// approval states, the server faked behind the approval call. A ◇ PRD reads as today and never calls.
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { parsePrd } from '../ids.ts';
import type { ApprovalReading, ApprovalState } from './approval.ts';
import { approvalReader, birthplaceOf, prdState } from './prd-state.ts';
import type { Tokens } from '../ask/schema.ts';

const PRD = parsePrd(1299);
const spec = (phase0?: string) =>
  `---\nprd: 1299\ntitle: A\nblocked-by: none\nspec: file\n${phase0 === undefined ? '' : `phase0: ${phase0}\n`}---\n\n# A\n`;
const IN = '.omni-loop/delivery/inbox/1299-server-approval';
const SHIPPED = '.omni-loop/delivery/shipped/1299-server-approval';

const reading = (state: ApprovalState): ApprovalReading => ({ state, lines: [`${state} line`], url: 'https://omni.test/d', approval: null, drift: [] });

/** A fake approval call answering `state`, counting its calls. */
function fake(state: ApprovalState) {
  const asked: number[] = [];
  return { asked, approval: (prd: number) => { asked.push(prd); return Promise.resolve(reading(state)); } };
}

describe('birthplaceOf', () => {
  it('is server for a spec saying phase0: server, and repo otherwise', () => {
    expect(birthplaceOf(makeRepo({ files: { [`${IN}/spec.md`]: spec('server') } }).ctx, PRD)).toBe('server');
    expect(birthplaceOf(makeRepo({ files: { [`${IN}/spec.md`]: spec() } }).ctx, PRD)).toBe('repo');
    expect(birthplaceOf(makeRepo({ files: { [`${IN}/spec.md`]: spec('pr') } }).ctx, PRD)).toBe('repo');
    expect(birthplaceOf(makeRepo({ files: { [`${IN}/spec.md`]: '# no front matter\n' } }).ctx, PRD)).toBe('repo');
    expect(birthplaceOf(makeRepo({ files: { [`${IN}/plan.md`]: '# plan\n' } }).ctx, PRD)).toBe('repo');
    expect(birthplaceOf(makeRepo().ctx, PRD)).toBe('repo');
  });
});

describe('prdState', () => {
  const table: [string, string, string | undefined, ApprovalState, string, boolean][] = [
    // birthplace, folder, phase0, approval, state, calls the server
    ['◇', IN, undefined, 'approved', 'inbox', false],
    ['◇', IN, undefined, 'pending', 'inbox', false],
    ['◇', IN, undefined, 'drifted', 'inbox', false],
    ['◇', IN, undefined, 'unreachable', 'inbox', false],
    ['◇', IN, undefined, 'refused', 'inbox', false],
    ['◇', SHIPPED, undefined, 'pending', 'shipped', false],
    ['◆', IN, 'server', 'approved', 'inbox', true],
    ['◆', IN, 'server', 'pending', 'prd', true],
    ['◆', IN, 'server', 'drifted', 'drifted', true],
    ['◆', IN, 'server', 'unreachable', 'unreachable', true],
    ['◆', IN, 'server', 'refused', 'refused', true],
    ['◆', SHIPPED, 'server', 'pending', 'shipped', false],
  ];

  it.each(table)('%s PRD in %s (phase0 %s), approval %s, reads %s', async (mark, dir, phase0, approval, state, calls) => {
    const { ctx } = makeRepo({ files: { [`${dir}/spec.md`]: spec(phase0) } });
    const server = fake(approval);
    const read = await prdState(ctx, PRD, server);
    expect(read).toMatchObject({ prd: 1299, name: '1299-server-approval', dir, birthplace: mark === '◆' ? 'server' : 'repo', state });
    expect(read?.approval).toEqual(calls ? reading(approval) : null);
    expect(server.asked).toEqual(calls ? [1299] : []);
  });

  it('is null for a PRD with no folder, and asks nothing', async () => {
    const server = fake('approved');
    expect(await prdState(makeRepo().ctx, PRD, server)).toBeNull();
    expect(server.asked).toEqual([]);
  });
});

describe('approvalReader', () => {
  const config = (url: string | null) => ({ ask: { url } });
  const signedIn = (host: string): { read: (h: string) => Tokens | null; write: () => void } =>
    ({ read: (h) => (h === host ? { access_token: 'a', refresh_token: 'r' } : null), write: () => {} });

  it('holds a repository with no Omni page set, saying why', async () => {
    const { ctx } = makeRepo({ config: config(null), files: { [`${IN}/spec.md`]: spec('server') } });
    expect(await approvalReader(ctx, { repo: 'acme/widgets' })(PRD)).toMatchObject({
      state: 'unreachable', lines: ['server unreachable · held, not failed'], why: 'no Omni page is set here (ask.url)',
    });
  });

  it('holds a terminal with no sign-in, saying why', async () => {
    const { ctx } = makeRepo({ config: config('https://omni.test'), files: { [`${IN}/spec.md`]: spec('server') } });
    const reader = approvalReader(ctx, { repo: 'acme/widgets', tokens: signedIn('other.test') });
    expect(await reader(PRD)).toMatchObject({ state: 'unreachable', why: 'no sign-in (omni signin)' });
  });

  it('asks the approval route with the sign-in and judges what it answers', async () => {
    const { ctx } = makeRepo({ config: config('https://omni.test'), files: { [`${IN}/spec.md`]: spec('server') } });
    const urls: string[] = [];
    const fetch = (url: string) => {
      urls.push(url);
      return Promise.resolve(new Response(JSON.stringify({ url: 'https://omni.test/d', approval: null }), { status: 200 }));
    };
    const read = await approvalReader(ctx, { repo: 'acme/widgets', tokens: signedIn('omni.test'), fetch })(PRD);
    expect(read).toMatchObject({ state: 'pending', lines: ['PRD 1299 waits for approval: https://omni.test/d'] });
    expect(urls).toEqual(['https://omni.test/api/dossiers/approval?repo=acme%2Fwidgets&prd=1299']);
  });
});
