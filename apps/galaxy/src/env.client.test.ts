import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EnvError } from 'vertuo-omni-plan/kit/lib/env/group.ts';
import { readClientEnv } from './env.client';

describe('readClientEnv, the browser\'s public pair', () => {
  it('is null when neither value is set, or both are blank', () => {
    expect(readClientEnv({})).toEqual({ supabase: null });
    expect(readClientEnv({ NEXT_PUBLIC_SUPABASE_URL: ' ', NEXT_PUBLIC_SUPABASE_ANON_KEY: '' })).toEqual({ supabase: null });
  });

  it('gives the pair when both are set', () => {
    expect(readClientEnv({ NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon' }))
      .toEqual({ supabase: { url: 'http://127.0.0.1:54321', key: 'anon' } });
  });

  it('refuses one without the other, and an address that is not a URL, naming the variables and no value', () => {
    expect(() => readClientEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_fake' })).toThrow(EnvError);
    expect(() => readClientEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_fake' })).toThrow(/NEXT_PUBLIC_SUPABASE_URL is not set while NEXT_PUBLIC_SUPABASE_ANON_KEY is/);
    expect(() => readClientEnv({ NEXT_PUBLIC_SUPABASE_URL: 'nowhere', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_fake' })).toThrow(/^environment: NEXT_PUBLIC_SUPABASE_URL is not valid: a URL$/);
  });

  it('reads each public value literally, the one form Next inlines into the browser', () => {
    const source = readFileSync(new URL('./env.client.ts', import.meta.url), 'utf8');
    expect(source).toContain('NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,');
    expect(source).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,');
  });
});
