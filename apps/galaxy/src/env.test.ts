import { describe, expect, it, vi } from 'vitest';
import { EnvError } from 'vertuo-omni-plan/kit/lib/env/group.ts';
import { readEnv } from './env';

vi.mock('server-only', () => ({}));

const FAKE_SECRET = 'sk-fake-do-not-print-0123456789';

const thrown = (source: Record<string, string>): EnvError => {
  try {
    readEnv(source);
  } catch (error) {
    if (error instanceof EnvError) return error;
    throw error;
  }
  throw new Error('readEnv did not throw');
};

describe('readEnv, the arcade server\'s environment', () => {
  it('with nothing set: development serves the demo, production is closed, and every feature is off', () => {
    const development = readEnv({ NODE_ENV: 'development' });
    expect(development.mode).toBe('demo');
    expect(readEnv({ NODE_ENV: 'production' }).mode).toBe('closed');
    expect(development).toEqual({
      production: false, building: false, mode: 'demo',
      supabase: null, serviceRole: null, githubApp: null, githubAppSlug: null, githubOAuth: null, openrouter: null,
      stagesSyncSecret: null, stageEventSecret: null, secretsMasterKey: null, constituentJudgeSecret: null,
      businessRecheckSecret: null, demo: null, galaxyUrl: null,
    });
  });

  it('gives each complete group typed, and the supabase mode', () => {
    const env = readEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_SUPABASE_URL: 'https://ref.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_x',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
      GITHUB_APP_ID: ' 42 ',
      GITHUB_APP_PRIVATE_KEY: 'line one\\nline two',
      GITHUB_APP_SLUG: 'omni-loop',
      OPENROUTER_API_KEY: 'or',
      STAGES_SYNC_SECRET: 'sync',
    });
    expect(env.mode).toBe('supabase');
    expect(env.supabase).toEqual({ url: 'https://ref.supabase.co', key: 'sb_publishable_x' });
    expect(env.serviceRole).toEqual({ key: 'service' });
    expect(env.githubApp).toEqual({ id: '42', privateKey: 'line one\nline two' });
    expect(env.githubAppSlug).toBe('omni-loop');
    expect(env.openrouter).toEqual({ key: 'or' });
    expect(env.stagesSyncSecret).toBe('sync');
  });

  it('reads a blank value as unset', () => {
    expect(readEnv({ OPENROUTER_API_KEY: '   ', SECRETS_MASTER_KEY: '' }).openrouter).toBeNull();
  });

  it('marks a production build while Next prerenders', () => {
    expect(readEnv({ NODE_ENV: 'production', NEXT_PHASE: 'phase-production-build' }).building).toBe(true);
  });

  it('refuses a half-set pair, naming both variables', () => {
    const error = thrown({ NEXT_PUBLIC_SUPABASE_URL: 'https://ref.supabase.co' });
    expect(error.problems.map((problem) => problem.variables)).toEqual([['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']]);
    expect(error.message).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set while NEXT_PUBLIC_SUPABASE_URL is');
    expect(thrown({ GITHUB_APP_CLIENT_ID: 'Iv1' }).message).toContain('GITHUB_APP_CLIENT_SECRET is not set');
    expect(thrown({ GITHUB_APP_PRIVATE_KEY: FAKE_SECRET }).message).toContain('GITHUB_APP_ID is not set');
  });

  it('refuses a malformed value, naming it', () => {
    expect(thrown({ NEXT_PUBLIC_SUPABASE_URL: 'not a url', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k' }).problems[0]?.variables).toEqual(['NEXT_PUBLIC_SUPABASE_URL']);
    expect(thrown({ GITHUB_APP_ID: 'one', GITHUB_APP_PRIVATE_KEY: 'k' }).problems[0]?.variables).toEqual(['GITHUB_APP_ID']);
    expect(thrown({ GALAXY_URL: 'localhost' }).problems[0]?.variables).toEqual(['GALAXY_URL']);
  });

  it('carries every problem in one error, and never a value', () => {
    const error = thrown({ SUPABASE_URL: 'https://ref.supabase.co', GITHUB_APP_ID: FAKE_SECRET, GITHUB_APP_PRIVATE_KEY: FAKE_SECRET });
    expect(error.problems.map((problem) => problem.variables)).toEqual([['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'], ['GITHUB_APP_ID']]);
    expect(error.message).not.toContain(FAKE_SECRET);
    expect(JSON.stringify(error.problems)).not.toContain(FAKE_SECRET);
  });

  it('keeps the arcade\'s mode rule: a build that asks for the demo by name gets it', () => {
    expect(readEnv({ NODE_ENV: 'production', OMNI_LOOP_DEMO: '1' }).mode).toBe('demo');
    expect(readEnv({ NODE_ENV: 'production', OMNI_LOOP_DEMO: 'true' }).mode).toBe('closed');
  });
});
