// The arcade's health query (PRD 1723, s3): one read-only query, as nobody, that brings back no row.
import { describe, expect, it } from 'vitest';
import { healthRepository } from './health.repository';

type Call = { table: string; columns: string; options: unknown; limit: number };

/** A stub client that records the one query asked and answers `error`. */
function stub(error: { message: string } | null) {
  const calls: Call[] = [];
  const connected: { url: string; key: string; options: unknown }[] = [];
  const connect = (url: string, key: string, options: unknown) => {
    connected.push({ url, key, options });
    return {
      from: (table: string) => ({
        select: (columns: string, options: unknown) => ({
          limit: (limit: number) => {
            calls.push({ table, columns, options, limit });
            return Promise.resolve({ data: null, error });
          },
        }),
      }),
    };
  };
  return { calls, connected, connect };
}

const ENV = { url: 'https://db.example', key: 'anon-key' };

describe('healthRepository, the arcade\'s Supabase probe', () => {
  it('asks one head-only query of public.releases, with the publishable key and no session', async () => {
    const { calls, connected, connect } = stub(null);
    await healthRepository(ENV, connect).ping();
    expect(calls).toEqual([{ table: 'releases', columns: 'prd', options: { head: true }, limit: 1 }]);
    expect(connected).toEqual([{
      url: ENV.url, key: ENV.key,
      options: { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    }]);
  });

  it('throws when the database refuses', async () => {
    const { connect } = stub({ message: 'permission denied' });
    await expect(healthRepository(ENV, connect).ping()).rejects.toThrow();
  });

  it('throws when this deployment has no Supabase', async () => {
    const { calls, connect } = stub(null);
    await expect(healthRepository(null, connect).ping()).rejects.toThrow();
    expect(calls).toEqual([]);
  });
});
