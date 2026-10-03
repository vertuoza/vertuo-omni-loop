// The read behind /releases (PRD 262): public.releases, as nobody. The publishable key the browser
// already holds, no session kept, no cookie, no sign-in, and never a write. No test reaches Supabase.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ReleaseRow } from './row';
import { readReleases, releasesEnv } from './store';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';

const ROW: ReleaseRow = { prd: parsePrd(262), release: 2, released_at: '2026-09-28T09:12:00+00:00', title: 'Everything we ship, in plain words', description: 'A public page lists every release.' };

/** A client over `rows`, recording how it was made and every call; `refuse` fails the read. */
function recording(rows: unknown[], refuse: { message: string } | null = null) {
  const calls: unknown[][] = [];
  const connect = (url: string, key: string, options: unknown) => {
    calls.push(['connect', url, key, options]);
    return {
      from: (table: string) => ({
        select: (columns: string) => ({
          order: (column: string) => ({
            range: (first: number, last: number) => {
              calls.push(['select', table, columns, column, first, last]);
              return Promise.resolve(refuse ? { data: null, error: refuse } : { data: rows.slice(first, last + 1), error: null });
            },
          }),
        }),
      }),
    } as never;
  };
  return { calls, connect };
}

describe('where the page reads', () => {
  it('is the project the two public variables name: its URL and its publishable key', () => {
    expect(releasesEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://ref.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_x' }))
      .toEqual({ url: 'https://ref.supabase.co', key: 'sb_publishable_x' });
  });

  it('is nowhere while either is unset, and never the service role\'s key', () => {
    expect(releasesEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://ref.supabase.co' })).toBeNull();
    expect(releasesEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k' })).toBeNull();
    expect(releasesEnv({ SUPABASE_URL: 'https://ref.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'secret' })).toBeNull();
  });
});

describe('the read', () => {
  const env = { url: 'https://ref.supabase.co', key: 'sb_publishable_x' };

  it('connects with the publishable key and keeps no session', async () => {
    const { calls, connect } = recording([ROW]);
    await readReleases(env, connect);
    expect(calls[0]).toEqual(['connect', env.url, env.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }]);
  });

  it('reads every row of public.releases, every column, by PRD', async () => {
    const { calls, connect } = recording([ROW]);
    expect(await readReleases(env, connect)).toEqual([ROW]);
    expect(calls.slice(1)).toEqual([['select', 'releases', 'prd,release,released_at,title,description', 'prd', 0, 999]]);
  });

  it('fails when Supabase refuses, or a row is not a release: the page decides what a visitor sees', async () => {
    await expect(readReleases(env, recording([], { message: 'paused' }).connect)).rejects.toThrow(/paused/);
    await expect(readReleases(env, recording([{ ...ROW, release: 0 }]).connect)).rejects.toThrow(/not a release/);
  });

  it('reads no cookie and signs nobody in', () => {
    const source = readFileSync(new URL('./store.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/@supabase\/ssr|next\/headers|cookies\(|supabase-server|sign-in|auth\.getUser|signIn/);
  });
});
