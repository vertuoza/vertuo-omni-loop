import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvError } from 'vertuo-omni-plan/kit/lib/env/group.ts';

// The arcade's startup (../instrumentation.ts): register() parses the server's environment, so a
// broken one stops the server before it answers a request. The environment is a passed object: the
// test hands register() what `process.env` would hold, through the env module's one read.
const started = vi.hoisted(() => ({ source: {} as Record<string, string>, runtime: 'nodejs' as string | undefined }));

vi.mock('./env', async (actual) => {
  const env = await actual<typeof import('./env')>();
  return { ...env, serverEnv: () => env.readEnv(started.source), nextRuntime: () => started.runtime };
});

const { register } = await import('../instrumentation');

beforeEach(() => {
  started.source = {};
  started.runtime = 'nodejs';
});

describe('register(), the arcade\'s startup', () => {
  it('starts with nothing set', () => {
    expect(() => register()).not.toThrow();
  });

  it('throws the named error on a broken environment, with no value in it', () => {
    started.source = { NEXT_PUBLIC_SUPABASE_URL: 'https://ref.supabase.co', GITHUB_APP_ID: 'sk-fake-value', GITHUB_APP_PRIVATE_KEY: 'k' };
    expect(() => register()).toThrow(EnvError);
    expect(() => register()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY is not set while NEXT_PUBLIC_SUPABASE_URL is.*GITHUB_APP_ID is not valid/);
    expect(() => register()).not.toThrow(/sk-fake-value/);
  });

  it('leaves the edge runtime alone', () => {
    started.source = { NEXT_PUBLIC_SUPABASE_URL: 'https://ref.supabase.co' };
    started.runtime = 'edge';
    expect(() => register()).not.toThrow();
  });
});
