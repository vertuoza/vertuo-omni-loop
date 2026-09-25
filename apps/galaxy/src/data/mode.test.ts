import { describe, it, expect } from 'vitest';
import { arcadeMode } from './mode';

const SUPABASE = { NEXT_PUBLIC_SUPABASE_URL: 'https://ref.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_x' };

describe('arcadeMode', () => {
  it('lets people in only through Supabase when it is configured', () => {
    expect(arcadeMode({ ...SUPABASE, NODE_ENV: 'production' })).toBe('supabase');
    expect(arcadeMode({ ...SUPABASE, NODE_ENV: 'development', OMNI_LOOP_DEMO: '1' })).toBe('supabase');
  });

  it('closes a production build without Supabase: no simulated sign-in', () => {
    expect(arcadeMode({ NODE_ENV: 'production' })).toBe('closed');
    expect(arcadeMode({ NODE_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: 'https://ref.supabase.co' })).toBe('closed');
    expect(arcadeMode({ NODE_ENV: 'production', OMNI_LOOP_DEMO: 'true' })).toBe('closed');
  });

  it('plays the demo locally, or when a build asks for it by name', () => {
    expect(arcadeMode({ NODE_ENV: 'development' })).toBe('demo');
    expect(arcadeMode({ NODE_ENV: 'test' })).toBe('demo');
    expect(arcadeMode({ NODE_ENV: 'production', OMNI_LOOP_DEMO: '1' })).toBe('demo');
  });
});
