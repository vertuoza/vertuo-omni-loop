import { describe, expect, it } from 'vitest';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import type { RewindFinding } from 'omni-loop/kit/lib/rewind/findings.ts';
import type { FindingView } from './rewind.contract';
import { rewindService, type RewindPorts } from './rewind.service';

// The rewind's rules (PRD 2410, s5), on fake ports: the workspace is the caller's own, a finding is proposed
// once whatever became of it, and a refused push keeps nothing.

const PRD = parsePrd(7);
const finding = (more: Partial<RewindFinding> = {}): RewindFinding => ({
  check: 'ci', origin: 'repository', happened: 'The lint was red and merged.', evidence: ['https://a.test/1'], fix: 'Require the lint.', ...more,
});
const view = (more: Partial<FindingView> = {}): FindingView => ({
  id: 'f1', check: 'ci', origin: 'repository', happened: 'x', evidence: ['https://a.test/1'], fix: 'y', state: 'proposed', reason: null, ...more,
});

function ports(more: Partial<RewindPorts> & { stored?: FindingView[] } = {}) {
  const inserted: RewindFinding[][] = [];
  const fake: RewindPorts = {
    workspaceOf: () => Promise.resolve('w1'),
    mainWatch: () => Promise.resolve({ watches: [], breaks: [] }),
    findings: () => Promise.resolve(more.stored ?? []),
    insert: (_w, _r, _p, found) => { inserted.push([...found]); return Promise.resolve('ok'); },
    ...more,
  };
  return { service: rewindService(fake), inserted };
}

describe('facts', () => {
  it('is empty for a PRD whose watch the caller cannot read', async () => {
    const { service } = ports({ workspaceOf: () => Promise.resolve(null) });
    expect(await service.facts('acme/widgets', PRD)).toEqual({ ok: true, value: { watches: [], breaks: [], findings: [] } });
  });

  it('carries the watch, its breaks and the findings', async () => {
    const stored = [view()];
    const { service } = ports({ stored, mainWatch: () => Promise.resolve({ watches: [], breaks: [] }) });
    expect(await service.facts('acme/widgets', PRD)).toEqual({ ok: true, value: { watches: [], breaks: [], findings: stored } });
  });
});

describe('propose', () => {
  it('inserts the findings once, for the caller\'s workspace', async () => {
    const { service, inserted } = ports();
    expect(await service.propose('acme/widgets', PRD, [finding()])).toEqual({ ok: true, value: { added: 1 } });
    expect(inserted).toEqual([[finding()]]);
  });

  it('answers missing when the caller reads no watch for the PRD, and inserts nothing', async () => {
    const { service, inserted } = ports({ workspaceOf: () => Promise.resolve(null) });
    const done = await service.propose('acme/widgets', PRD, [finding()]);
    expect(done).toMatchObject({ ok: false, kind: 'missing' });
    expect(inserted).toEqual([]);
  });

  it.each(['proposed', 'approved', 'rejected'] as const)('refuses a finding already %s, naming it, and inserts nothing', async (state) => {
    const { service, inserted } = ports({ stored: [view({ state })] });
    const done = await service.propose('acme/widgets', PRD, [finding({ origin: 'knowledge' }), finding({ evidence: ['https://a.test/1'] })]);
    expect(done).toEqual({ ok: false, kind: 'duplicate', error: 'Finding 2 (ci, repository) was already proposed for PRD 7.' });
    expect(inserted).toEqual([]);
  });

  it('reads the same evidence in any order as the same finding', async () => {
    const { service } = ports({ stored: [view({ evidence: ['https://b.test/2', 'https://a.test/1'] })] });
    const done = await service.propose('acme/widgets', PRD, [finding({ evidence: ['https://a.test/1', 'https://b.test/2'] })]);
    expect(done).toMatchObject({ ok: false, kind: 'duplicate' });
  });

  it('refuses a push the database found repeated', async () => {
    const { service } = ports({ insert: () => Promise.resolve('duplicate') });
    expect(await service.propose('acme/widgets', PRD, [finding()])).toMatchObject({ ok: false, kind: 'duplicate' });
  });
});
