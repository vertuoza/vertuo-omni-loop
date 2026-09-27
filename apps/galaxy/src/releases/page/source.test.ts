// What /releases shows, by the build's mode (src/data/mode.ts, PRD 262): the demo sample in
// development or a demo build, the unavailable line in a closed build, and public.releases with
// Supabase. A failed read never fails the build and never replaces a good page: while building it
// renders the unavailable line; after that it throws, so the last good render stays served.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_RELEASES } from '../demo';
import type { ReleaseRow } from '../row';
import { releasesView } from './source';

const ROWS: ReleaseRow[] = [{ prd: 262, release: 2, released_at: '2026-09-28T09:12:00+00:00', title: 'Everything we ship, in plain words', description: 'A public page lists every release.' }];
const SUPABASE = { NODE_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: 'https://ref.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_x' };
const BUILDING = { NEXT_PHASE: 'phase-production-build' };

let logged: ReturnType<typeof vi.spyOn>;
beforeEach(() => { logged = vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

const reads = (rows: ReleaseRow[]) => vi.fn(async () => rows);
const fails = () => vi.fn(async (): Promise<ReleaseRow[]> => { throw new Error('Supabase refused to read the releases: project paused'); });

describe('in development, or a build that asks for the demo', () => {
  it('shows the demo sample and reads nothing', async () => {
    for (const env of [{ NODE_ENV: 'development' }, { NODE_ENV: 'production', OMNI_LOOP_DEMO: '1' }]) {
      const read = reads(ROWS);
      expect(await releasesView(env, read)).toEqual({ kind: 'releases', rows: DEMO_RELEASES });
      expect(read).not.toHaveBeenCalled();
    }
  });
});

describe('in a build with no Supabase', () => {
  it('is closed: the unavailable line, and nothing read', async () => {
    const read = reads(ROWS);
    expect(await releasesView({ NODE_ENV: 'production' }, read)).toEqual({ kind: 'unavailable' });
    expect(await releasesView({ NODE_ENV: 'production', ...BUILDING }, read)).toEqual({ kind: 'unavailable' });
    expect(read).not.toHaveBeenCalled();
  });
});

describe('with Supabase', () => {
  it('shows what public.releases holds, read with the publishable key', async () => {
    const read = reads(ROWS);
    expect(await releasesView(SUPABASE, read)).toEqual({ kind: 'releases', rows: ROWS });
    expect(read).toHaveBeenCalledWith({ url: SUPABASE.NEXT_PUBLIC_SUPABASE_URL, key: SUPABASE.NEXT_PUBLIC_SUPABASE_ANON_KEY });
  });

  it('shows an empty table as it is: no release yet', async () => {
    expect(await releasesView(SUPABASE, reads([]))).toEqual({ kind: 'releases', rows: [] });
  });

  it('never fails the build on a failed read: the page is built with the unavailable line, and the reason logged', async () => {
    expect(await releasesView({ ...SUPABASE, ...BUILDING }, fails())).toEqual({ kind: 'unavailable' });
    expect(String(logged.mock.calls[0])).toMatch(/project paused/);
  });

  it('never replaces a good page on a failed read after the build: it throws, so the last good render stays', async () => {
    await expect(releasesView(SUPABASE, fails())).rejects.toThrow(/releases could not be read/);
    expect(String(logged.mock.calls[0])).toMatch(/project paused/);
  });
});
