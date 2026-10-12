import { describe, expect, it } from 'vitest';
import { DEFAULT_GALAXY_URL, EnvError, readEnv } from './env.ts';

const SECRET = 'sk-fake-secret-0123456789';
const PEM = '-----BEGIN RSA PRIVATE KEY-----\\nabc\\n-----END RSA PRIVATE KEY-----';

/** What `readEnv(source)` threw: the EnvError, or the test fails. */
function thrown(source: Record<string, string | undefined>): EnvError {
  try {
    readEnv(source);
  } catch (error) {
    if (error instanceof EnvError) return error;
    throw error;
  }
  throw new Error('readEnv did not throw');
}

describe('readEnv — the GitHub App', () => {
  it('gives every group null, galaxy its default, and is not production, when nothing is set', () => {
    expect(readEnv({})).toEqual({
      production: false,
      webhook: null,
      githubApp: null,
      supabase: null,
      openrouter: null,
      stageEvents: null,
      constituentJudge: null,
      lawJudge: null,
      galaxyUrl: DEFAULT_GALAXY_URL,
    });
  });

  it('gives each group typed when its variables are set, the private key with its literal \\n read as new lines', () => {
    const env = readEnv({
      VERCEL_ENV: 'production',
      GITHUB_WEBHOOK_SECRET: SECRET,
      GITHUB_APP_ID: '123',
      GITHUB_APP_PRIVATE_KEY: PEM,
      SUPABASE_URL: 'https://db.example',
      SUPABASE_SERVICE_ROLE_KEY: SECRET,
      OPENROUTER_API_KEY: SECRET,
      OPENROUTER_MODEL: 'anthropic/claude-sonnet-5',
      STAGE_EVENT_SECRET: 'stage',
      CONSTITUENT_JUDGE_SECRET: 'judge',
      LAW_JUDGE_SECRET: 'laws',
      GALAXY_URL: 'https://galaxy.example/',
    });
    expect(env).toEqual({
      production: true,
      webhook: { secret: SECRET },
      githubApp: { id: '123', privateKey: '-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----' },
      supabase: { url: 'https://db.example', key: SECRET },
      openrouter: { key: SECRET, model: 'anthropic/claude-sonnet-5' },
      stageEvents: { secret: 'stage' },
      constituentJudge: { secret: 'judge' },
      lawJudge: { secret: 'laws' },
      galaxyUrl: 'https://galaxy.example',
    });
  });

  it('requires the webhook secret and the GitHub App in production, naming each variable', () => {
    const error = thrown({ VERCEL_ENV: 'production' });
    expect(error.problems.map((problem) => problem.variables)).toEqual([
      ['GITHUB_WEBHOOK_SECRET'],
      ['GITHUB_APP_ID', 'GITHUB_APP_PRIVATE_KEY'],
    ]);
    expect(error.message).toContain('must be set in production');
  });

  it('requires nothing on a preview, in development or in a test: VERCEL_ENV alone says production', () => {
    for (const name of ['preview', 'development', undefined]) expect(readEnv({ VERCEL_ENV: name, NODE_ENV: 'production' }).production).toBe(false);
  });

  it('throws one EnvError naming every half-set or malformed group, never a value', () => {
    const error = thrown({
      GITHUB_APP_ID: 'not-a-number',
      GITHUB_APP_PRIVATE_KEY: SECRET,
      SUPABASE_URL: SECRET,
      SUPABASE_SERVICE_ROLE_KEY: SECRET,
      OPENROUTER_MODEL: SECRET,
      GALAXY_URL: SECRET,
    });
    expect(error.problems.map((problem) => problem.variables)).toEqual([
      ['GITHUB_APP_ID'],
      ['SUPABASE_URL'],
      ['OPENROUTER_MODEL', 'OPENROUTER_API_KEY'],
      ['GALAXY_URL'],
    ]);
    expect(error.message).not.toContain(SECRET);
    expect(error.message).not.toContain('not-a-number');
  });

  it('names the half of the GitHub App that is missing', () => {
    expect(thrown({ GITHUB_APP_ID: '1' }).message).toContain('GITHUB_APP_PRIVATE_KEY is not set while GITHUB_APP_ID is');
  });
});
