import { describe, it, expect, vi } from 'vitest';
import { FakeProofWorld } from '../../proof/store.fake';
import { proofPath } from '../../proof/store';
import { PROOF_LINK_SECONDS, readProofs } from './proof-read';

// What /prd/<id> reads for its Proof tab (PRD 798, s4), as the viewer, on the proof store's fake: the
// runs they may read, and for the shown run only its files' signed links and its scripts' text.

const D = '00000000-0000-4000-8000-0000000000d1';
const OLD = '11111111-1111-4111-8111-111111111111';
const NEW = '22222222-2222-4222-8222-222222222222';

function world() {
  const w = new FakeProofWorld();
  w.account('tok-pierre', 'u-pierre', ['w1']);
  w.account('tok-stranger', 'u-stranger', ['w2']);
  w.dossier({ id: D, workspace: 'w1', repo: 'vertuoza/vertuo-omni-loop', prd: 798 });
  return w;
}

async function seed(w: FakeProofWorld) {
  const store = w.client('tok-pierre').proofs;
  w.put(proofPath(D, OLD, '1-a.webm'));
  await store.register({ id: OLD, dossierId: D, commit: 'aaaaaaa', url: 'https://preview.test', gif: null,
    criteria: [{ text: 'A', verdict: 'fail', note: 'boom', video: '1-a.webm' }] });
  for (const name of ['1-a.webm', '1-a.spec.ts', '2-b.webm']) w.put(proofPath(D, NEW, name));
  await store.register({ id: NEW, dossierId: D, commit: 'bbbbbbb', url: 'https://preview.test', gif: null, criteria: [
    { text: 'A', verdict: 'pass', video: '1-a.webm', script: '1-a.spec.ts' },
    { text: 'B', verdict: 'pass', video: '2-b.webm' },
    { text: 'C', verdict: 'unfilmable', note: 'a log line' },
  ] });
}

describe('the Proof tab read', () => {
  it('reads the runs newest first, and signs and fetches the shown run only', async () => {
    const w = world();
    await seed(w);
    const text = vi.fn(async (url: string) => `// script at ${url}`);
    const read = await readProofs(w.client('tok-pierre').proofs, D, { sign: true, version: null }, text);
    expect(read?.runs.map((r) => r.id)).toEqual([NEW, OLD]);
    expect(read?.shown).toEqual({
      id: NEW,
      links: {
        '1-a.webm': `https://storage.test/sign/${D}/${NEW}/1-a.webm?ttl=${PROOF_LINK_SECONDS}`,
        '1-a.spec.ts': `https://storage.test/sign/${D}/${NEW}/1-a.spec.ts?ttl=${PROOF_LINK_SECONDS}`,
        '2-b.webm': `https://storage.test/sign/${D}/${NEW}/2-b.webm?ttl=${PROOF_LINK_SECONDS}`,
      },
      scripts: { '1-a.spec.ts': `// script at https://storage.test/sign/${D}/${NEW}/1-a.spec.ts?ttl=${PROOF_LINK_SECONDS}` },
    });
    expect(text).toHaveBeenCalledTimes(1);
  });

  it('signs the run the picker names', async () => {
    const w = world();
    await seed(w);
    const read = await readProofs(w.client('tok-pierre').proofs, D, { sign: true, version: 1 }, async () => '');
    expect(read?.shown?.id).toBe(OLD);
    expect(Object.keys(read?.shown?.links ?? {})).toEqual(['1-a.webm']);
  });

  it('signs nothing off the Proof tab', async () => {
    const w = world();
    await seed(w);
    const text = vi.fn(async () => '');
    const read = await readProofs(w.client('tok-pierre').proofs, D, { sign: false, version: null }, text);
    expect(read).toMatchObject({ shown: null });
    expect(read?.runs).toHaveLength(2);
    expect(text).not.toHaveBeenCalled();
  });

  it('keeps a script whose text could not be fetched as null, and the run shown', async () => {
    const w = world();
    await seed(w);
    const read = await readProofs(w.client('tok-pierre').proofs, D, { sign: true, version: null }, async () => {
      throw new Error('offline');
    });
    expect(read?.shown?.scripts).toEqual({ '1-a.spec.ts': null });
    expect(read?.shown?.links['1-a.webm']).toMatch(/^https:/);
  });

  it('reads no run for a viewer of another workspace, and none on a dossier without one', async () => {
    const w = world();
    await seed(w);
    expect(await readProofs(w.client('tok-stranger').proofs, D, { sign: true, version: null }, async () => '')).toEqual({ runs: [], shown: null });
    expect(await readProofs(world().client('tok-pierre').proofs, D, { sign: true, version: null }, async () => '')).toEqual({ runs: [], shown: null });
  });

  it('is null when the runs could not be read, so the tab stays hidden and the page stands', async () => {
    const store = { runs: async () => { throw new Error('down'); }, links: async () => [] };
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await readProofs(store, D, { sign: true, version: null }, async () => '')).toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
