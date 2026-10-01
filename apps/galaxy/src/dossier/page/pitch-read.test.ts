import { describe, expect, it, vi } from 'vitest';
import type { PitchRunRow } from '../../pitch/store';
import { readPitches, PITCH_LINK_SECONDS } from './pitch-read';

// What /prd/<id> reads for its Pitch tab (PRD 859, s3): the pitches always, and the five files of each
// audience's shown pitch signed on the Pitch tab only.

const D = '00000000-0000-4000-8000-0000000000d1';
const FIVE = ['slide.png', 'slide-square.png', 'pitch.mp4', 'pitch-square.mp4', 'pitch.gif'];
const row = (id: string, audience: 'customers' | 'inside', at: string): PitchRunRow => ({
  id, dossier_id: D, audience, look: 'arcade', commit_sha: 'abc1234', hook: 'h', benefit: 'b', kicker: 'k', closing: 'c',
  files: FIVE, created_by: null, created_at: at,
});
const RUNS = [row('c2', 'customers', '2026-10-01T12:00:00Z'), row('i1', 'inside', '2026-10-01T11:00:00Z'), row('c1', 'customers', '2026-09-30T12:00:00Z')];

function store(runs = RUNS) {
  return {
    runs: vi.fn(async () => runs),
    links: vi.fn(async (paths: string[]) => paths.map((p) => (p.endsWith('pitch.gif') ? null : `https://s.test/${p}`))),
  };
}

describe('readPitches', () => {
  it('signs nothing off the Pitch tab', async () => {
    const s = store();
    expect(await readPitches(s, D, { sign: false, pitch: null })).toEqual({ runs: RUNS, links: {} });
    expect(s.links).not.toHaveBeenCalled();
  });

  it('signs the five files of each audience\'s latest pitch, for an hour', async () => {
    const s = store();
    const read = await readPitches(s, D, { sign: true, pitch: null });
    expect(s.links).toHaveBeenCalledWith([...FIVE.map((n) => `${D}/c2/${n}`), ...FIVE.map((n) => `${D}/i1/${n}`)], PITCH_LINK_SECONDS);
    expect(Object.keys(read!.links)).toEqual(['c2', 'i1']);
    expect(read!.links.c2['slide.png']).toBe(`https://s.test/${D}/c2/slide.png`);
    expect(read!.links.c2['pitch.gif']).toBeNull();
  });

  it('signs the picked pitch in its audience\'s place', async () => {
    const read = await readPitches(store(), D, { sign: true, pitch: 'c1' });
    expect(Object.keys(read!.links)).toEqual(['c1', 'i1']);
  });

  it('reads null when the pitches cannot be read, so the tab hides and the page stays', async () => {
    const failing = { runs: vi.fn(async () => { throw new Error('down'); }), links: vi.fn() };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await readPitches(failing, D, { sign: true, pitch: null })).toBeNull();
  });
});
