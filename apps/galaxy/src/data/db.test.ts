import { beforeEach, describe, expect, it, vi } from 'vitest';

// The database module (PRD 1318): the signed-in person's client comes from the request's cookies,
// and the service role's from its key, at its own address when set.

vi.mock('server-only', () => ({}));

const env = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const createClient = vi.fn((url: string, key: string, options: unknown) => ({ url, key, options }));
const supabaseServer = vi.fn(async () => ({ as: 'the signed-in person' }));
vi.mock('@supabase/supabase-js', () => ({ createClient }));
vi.mock('./supabase-server', () => ({ supabaseServer }));
vi.mock('../env', () => ({ serverEnv: () => env.current }));

const { serviceRoleDb, userDb } = await import('./db');

const PUBLIC = { url: 'https://public.example', key: 'anon' };

describe('the database module', () => {
  beforeEach(() => {
    createClient.mockClear();
    supabaseServer.mockClear();
  });

  it("builds the signed-in person's client from the request's cookies", async () => {
    expect(await userDb()).toEqual({ as: 'the signed-in person' });
    expect(supabaseServer).toHaveBeenCalledTimes(1);
  });

  it("builds the service role's client at the public pair's address, keeping no session", () => {
    env.current = { supabase: PUBLIC, serviceRole: { key: 'service' } };
    expect(serviceRoleDb()).toEqual({
      url: 'https://public.example',
      key: 'service',
      options: { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    });
  });

  it("uses the service role's own address when it has one", () => {
    env.current = { supabase: PUBLIC, serviceRole: { key: 'service', url: 'https://service.example' } };
    expect(serviceRoleDb()).toMatchObject({ url: 'https://service.example', key: 'service' });
    env.current = { supabase: null, serviceRole: { key: 'service', url: 'https://service.example' } };
    expect(serviceRoleDb()).toMatchObject({ url: 'https://service.example' });
  });

  it('refuses without a service role key or without an address', () => {
    env.current = { supabase: PUBLIC, serviceRole: null };
    expect(() => serviceRoleDb()).toThrow('SUPABASE_SERVICE_ROLE_KEY is not set on this deployment');
    env.current = { supabase: null, serviceRole: { key: 'service' } };
    expect(() => serviceRoleDb()).toThrow('SUPABASE_SERVICE_ROLE_KEY is not set on this deployment');
    expect(createClient).not.toHaveBeenCalled();
  });
});
