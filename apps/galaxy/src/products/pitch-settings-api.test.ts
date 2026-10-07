import { describe, expect, it, vi } from 'vitest';
import { defaultPitchSettings, presetLook } from 'vertuo-omni-plan/kit/lib/pitch/settings.ts';
import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { readPitchLook, readPitchSettings, type PitchSettingsDeps } from './pitch-settings-api';

// GET /api/pitch-settings?repo=<owner/name> (PRD 1108 s1) and its alias GET /api/pitch-look, with a
// stubbed Supabase client: the Pitch settings of a tracked repository's product, filled from its preset
// and the defaults, as pitch_settings_for_repo() answers them stored; the alias answers the preset its
// look was filled from, as PRD 859's kits read it; and each refusal, in plain words.

const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@acme.test', member: true };
const CARL = { id: '00000000-0000-4000-8000-0000000000c1', email: 'carl@other.test', member: false };
const INSTALL = 'https://github.com/apps/omni-loop-invader/installations/new';
const STORED: Record<string, unknown> = {
  'acme/widgets': { look: { preset: 'keynote', colors: { accent: '#3D5AFE' } }, voice: { preset: 'formal', instructions: 'Say worksite.' } },
  'acme/legacy': { look: { preset: 'arcade' } },
};

type Answer = { data: unknown; error: unknown };

function world({ database = true, answer }: { database?: boolean; answer?: Answer } = {}) {
  const calls: Array<{ fn: string; args: unknown }> = [];
  const users: Record<string, typeof ADA> = { 'ada-token': ADA, 'carl-token': CARL };
  const client = (token: string) => ({
    auth: {
      getUser: (jwt: string) => Promise.resolve({ data: { user: users[jwt] ?? null }, error: users[jwt] ? null : { status: 401, message: 'bad jwt' } }),
    },
    rpc: (fn: string, args: { p_repo: string }) => {
      calls.push({ fn, args });
      if (answer) return Promise.resolve(answer);
      if (!users[token]?.member) return Promise.resolve({ data: null, error: { code: '42501', message: 'you are not a member of Acme, which owns acme/widgets' } });
      return Promise.resolve({ data: STORED[args.p_repo.toLowerCase()] ?? {}, error: null });
    },
  });
  const deps: PitchSettingsDeps = { connect: database ? (client as unknown as NonNullable<PitchSettingsDeps['connect']>) : null, installLink: INSTALL };
  const call = async (read: typeof readPitchSettings, path: string, query: string, token: string | null) => {
    const response = await read(new Request(`https://omni.example/api/${path}${query}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }), deps);
    const body: unknown = await response.json();
    return { status: response.status, body, cache: response.headers.get('cache-control') };
  };
  return {
    calls,
    settings: (query: string, token: string | null = 'ada-token') => call(readPitchSettings, 'pitch-settings', query, token),
    look: (query: string, token: string | null = 'ada-token') => call(readPitchLook, 'pitch-look', query, token),
  };
}

describe('GET /api/pitch-settings', () => {
  it("answers the repository's product's settings, filled from its preset and the defaults", async () => {
    const w = world();
    const got = await w.settings('?repo=acme/widgets');
    expect(got.status).toBe(200);
    expect(got.cache).toBe('no-store');
    const settings = propertyOf(got.body, 'settings');
    expect(propertyOf(settings, 'look')).toEqual({ ...presetLook('keynote'), colors: { ...presetLook('keynote').colors, accent: '#3D5AFE' } });
    expect(propertyOf(settings, 'voice')).toEqual({ preset: 'formal', instructions: 'Say worksite.' });
    expect(propertyOf(settings, 'length')).toEqual({ min: 20, max: 40 });
    expect(w.calls).toEqual([{ fn: 'pitch_settings_for_repo', args: { p_repo: 'acme/widgets' } }]);
  });

  it('answers the defaults for a repository with no product', async () => {
    expect((await world().settings('?repo=acme/no-product')).body).toEqual({ settings: defaultPitchSettings() });
  });

  it('refuses a malformed repository, with no database call', async () => {
    const w = world();
    expect(await w.settings('?repo=widgets')).toMatchObject({ status: 400, body: { error: '`repo` must be the repository as owner/name.' } });
    expect(await w.settings('')).toMatchObject({ status: 400 });
    expect(w.calls).toEqual([]);
  });

  it('refuses a call with no valid sign-in', async () => {
    expect((await world().settings('?repo=acme/widgets', null)).status).toBe(401);
    expect((await world().settings('?repo=acme/widgets', 'stale-token')).status).toBe(401);
  });

  it("refuses a repository outside the caller's workspaces with the database's reason and the install link", async () => {
    const got = await world().settings('?repo=acme/widgets', 'carl-token');
    expect(got.status).toBe(403);
    expect(propertyOf(got.body, 'error')).toContain('you are not a member of Acme');
  });

  it("answers 400 with the database's reason for a repository it refuses as out of shape", async () => {
    const got = await world({ answer: { data: null, error: { code: '22023', message: 'Repository: owner/name.' } } }).settings('?repo=acme/widgets');
    expect(got).toMatchObject({ status: 400, body: { error: 'Repository: owner/name.' } });
  });

  it('answers 503 with no database here, and 500 when the database fails or stores settings out of shape', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await world({ database: false }).settings('?repo=acme/widgets')).status).toBe(503);
    const failed = await world({ answer: { data: null, error: { code: 'XX000', message: 'boom' } } }).settings('?repo=acme/widgets');
    expect(failed).toMatchObject({ status: 500, body: { error: 'The Pitch settings could not be read. Try again.' } });
    expect((await world({ answer: { data: { length: { min: 3 } }, error: null } }).settings('?repo=acme/widgets')).status).toBe(500);
    expect(errors).toHaveBeenCalledWith(expect.stringContaining('length.min'));
  });
});

describe('GET /api/pitch-look, the alias', () => {
  it("answers the preset the repository's product's look was filled from", async () => {
    const w = world();
    expect(await w.look('?repo=acme/widgets')).toEqual({ status: 200, body: { look: 'keynote' }, cache: 'no-store' });
    expect((await w.look('?repo=acme/legacy')).body).toEqual({ look: 'arcade' });
    expect(w.calls.map((c) => c.fn)).toEqual(['pitch_settings_for_repo', 'pitch_settings_for_repo']);
  });

  it('answers arcade for a repository with no product', async () => {
    expect((await world().look('?repo=acme/no-product')).body).toEqual({ look: 'arcade' });
  });

  it('refuses as the settings do, naming the pitch look', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await world().look('?repo=widgets')).status).toBe(400);
    expect((await world().look('?repo=acme/widgets', null)).status).toBe(401);
    expect((await world().look('?repo=acme/widgets', 'carl-token')).status).toBe(403);
    expect(await world({ database: false }).look('?repo=acme/widgets')).toMatchObject({
      status: 503,
      body: { error: 'The pitch look is not available here: this deployment has no database.' },
    });
    expect(await world({ answer: { data: { look: { preset: 'neon' } }, error: null } }).look('?repo=acme/widgets')).toMatchObject({
      status: 500,
      body: { error: 'The pitch look could not be read. Try again.' },
    });
  });
});
