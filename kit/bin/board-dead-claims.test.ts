// PRD 2175, s1: `omni board` on a dead job's claims, through `main()` on a fixture repository. It
// passes the labels and both limits to the board, and reads the last commit of a released draft and
// of a draft quiet on `labels.inProgress` too, so the board can read either as `claimed-stale`. Its own
// file: `board.test.ts` stays as it is.
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';
import { aChange, fakeLoopReads } from '../lib/loop-reads/fake.ts';
import type { FakeLoopState } from '../lib/loop-reads/fake.ts';
import type { LoopChange } from '../lib/loop-reads/contract.ts';
import { parsePr } from '../lib/ids.ts';

const MINUTE_MS = 60_000;
const ago = (minutes: number) => new Date(Date.now() - minutes * MINUTE_MS).toISOString();

const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\n';
const PLAN = ['# A plan', '', '| id | slice | territory | blocked by | wave |', '| --- | --- | --- | --- | --- |', '| s1 | Alpha | `a/` | — | 1 |', ''].join('\n');

/** A draft sub-PR of the feature `widgets`, claimed ten hours ago: old enough for every rule. */
function draft(overrides: Partial<LoopChange> = {}): LoopChange {
  return aChange({ number: parsePr(42), title: 's1', head: 'feat/widgets--s1', base: 'feat/widgets', state: 'draft', createdAt: ago(600), updatedAt: ago(5), ...overrides });
}

/** `omni board 7 --json` of a fixture repository whose config is `config`, read from `state`. */
async function boardOf(state: FakeLoopState, config = CONFIG) {
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config, '.omni-loop/delivery/inbox/0007-widgets/plan.md': PLAN } });
  const exec = (file: string, args: readonly string[]) => {
    if (file === 'git' && args[0] === 'rev-parse') return `${root}\n`;
    throw new Error(`unexpected call ${file} ${args.join(' ')}`);
  };
  const reads = fakeLoopReads(state);
  const out: string[] = [];
  const code = await main(['board', '7', '--json'], { cwd: root, exec, reads, stdout: { write: (s: string) => out.push(s) }, stderr: { write: () => undefined } });
  const payload = JSON.parse(out.join('')) as { slices: { state: string; pr: { headCommitDate?: string | null } | null }[] };
  return { code, state: payload.slices[0]?.state, pr: payload.slices[0]?.pr, changeReads: reads.reads.filter((read) => read.read === 'change') };
}

describe('omni board — a released claim (PRD 2175)', () => {
  it('reads a draft labelled omni:released as claimed-stale, and reads its last commit', async () => {
    const lastCommitAt = ago(2);
    const { code, state, pr, changeReads } = await boardOf({
      changes: { 'acme/widgets': [draft({ labels: ['omni:sub', 'omni:released'], createdAt: ago(10), updatedAt: ago(1) })] },
      details: { 'acme/widgets#42': { lastCommitAt } },
    });
    expect(code).toBe(0);
    expect(state).toBe('claimed-stale');
    expect(changeReads).toEqual([{ read: 'change', repo: 'acme/widgets', number: 42 }]);
    expect(pr?.headCommitDate).toBe(lastCommitAt);
  });

  it('reads the label the config names', async () => {
    const config = `${CONFIG}labels:\n  released: dead-claim\n`;
    const changes = (labels: string[]) => ({ changes: { 'acme/widgets': [draft({ labels, createdAt: ago(10), updatedAt: ago(1) })] }, details: { 'acme/widgets#42': { lastCommitAt: ago(2) } } });
    expect((await boardOf(changes(['dead-claim']), config)).state).toBe('claimed-stale');
    expect((await boardOf(changes(['omni:released']), config)).state).toBe('in-flight');
  });
});

describe('omni board — a quiet claim (PRD 2175)', () => {
  it('reads a draft on omni:in-progress quiet for 241 minutes as claimed-stale', async () => {
    const { state, changeReads } = await boardOf({
      changes: { 'acme/widgets': [draft({ labels: ['omni:in-progress'], updatedAt: ago(241) })] },
      details: { 'acme/widgets#42': { lastCommitAt: ago(241) } },
    });
    expect(state).toBe('claimed-stale');
    expect(changeReads).toHaveLength(1);
  });

  it('reads one quiet for 239 minutes as in-flight', async () => {
    const { state } = await boardOf({
      changes: { 'acme/widgets': [draft({ labels: ['omni:in-progress'], updatedAt: ago(239) })] },
      details: { 'acme/widgets#42': { lastCommitAt: ago(239) } },
    });
    expect(state).toBe('in-flight');
  });

  it('reads one whose last commit cannot be read as in-flight (BR-PRODUCT-2)', async () => {
    const { state, changeReads } = await boardOf({
      changes: { 'acme/widgets': [draft({ labels: ['omni:in-progress'], updatedAt: ago(600) })] },
      details: { 'acme/widgets#42': { lastCommitAt: null } },
    });
    expect(changeReads).toHaveLength(1);
    expect(state).toBe('in-flight');
  });

  it('reads limits.claimDeadMinutes from the config', async () => {
    const config = `${CONFIG}limits:\n  claimDeadMinutes: 90\n`;
    const { state } = await boardOf(
      { changes: { 'acme/widgets': [draft({ labels: ['omni:in-progress'], updatedAt: ago(100) })] }, details: { 'acme/widgets#42': { lastCommitAt: ago(100) } } },
      config,
    );
    expect(state).toBe('claimed-stale');
  });
});

describe('omni board — which drafts it reads a last commit for (PRD 2175)', () => {
  it('never reads one for a fresh draft on omni:in-progress updated within the quiet time', async () => {
    const { state, changeReads } = await boardOf({ changes: { 'acme/widgets': [draft({ labels: ['omni:in-progress'], createdAt: ago(10), updatedAt: ago(239) })] } });
    expect(changeReads).toEqual([]);
    expect(state).toBe('in-flight');
  });

  it('never reads one for a quiet pull request that is no draft, nor for a released one that is closed', async () => {
    const quietReady = await boardOf({ changes: { 'acme/widgets': [draft({ state: 'open', labels: ['omni:in-progress'], createdAt: ago(10), updatedAt: ago(600) })] } });
    expect(quietReady.changeReads).toEqual([]);
    const releasedClosed = await boardOf({ changes: { 'acme/widgets': [draft({ state: 'closed', labels: ['omni:released'], createdAt: ago(10) })] } });
    expect(releasedClosed.changeReads).toEqual([]);
  });

  it('never reads one for a recent draft that carries neither label', async () => {
    const { changeReads } = await boardOf({ changes: { 'acme/widgets': [draft({ labels: ['omni:sub'], createdAt: ago(10), updatedAt: ago(600) })] } });
    expect(changeReads).toEqual([]);
  });
});
