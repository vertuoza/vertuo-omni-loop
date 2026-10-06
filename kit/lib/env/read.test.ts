import { describe, expect, it } from 'vitest';
import { EnvError, gitWithoutPrompt, readEnv, requireGroup, SUPABASE, withGithubToken, withStepVariables, WORKSPACE } from './read.ts';

const SECRET = 'sk-fake-secret-0123456789';

describe('readEnv', () => {
  it('gives every group null, and the terminal its defaults, when nothing is set', () => {
    expect(readEnv({})).toEqual({
      claudeSession: null,
      openrouter: null,
      proof: null,
      terminal: { columns: 80, color: true },
      githubActions: null,
      workspace: null,
      supabase: null,
      packageManager: null,
    });
  });

  it('gives each group typed when its variables are set', () => {
    const env = readEnv({
      CLAUDE_CODE_SESSION_ID: 'abc',
      OPENROUTER_API_KEY: SECRET,
      PROOF_URL: 'https://preview.test/x',
      GITHUB_OUTPUT: '/tmp/out',
      OMNI_LOOP_WORKSPACE: ' vertuoza ',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      SUPABASE_SERVICE_ROLE_KEY: SECRET,
      npm_execpath: '/bin/pnpm.cjs',
    });
    expect(env.claudeSession).toEqual({ id: 'abc' });
    expect(env.openrouter).toEqual({ key: SECRET });
    expect(env.proof).toEqual({ url: 'https://preview.test/x' });
    expect(env.githubActions).toEqual({ output: '/tmp/out' });
    expect(env.workspace).toEqual({ slug: 'vertuoza' });
    expect(env.supabase).toEqual({ url: 'http://127.0.0.1:54321', key: SECRET });
    expect(env.packageManager).toEqual({ execPath: '/bin/pnpm.cjs' });
  });

  it('reads the terminal as the status line always has: COLUMNS a positive whole number, else 80; NO_COLOR set, no colour', () => {
    expect(readEnv({ COLUMNS: '120' }).terminal).toEqual({ columns: 120, color: true });
    for (const columns of ['', 'wide', '0', '-4', '12.5', ' ']) expect(readEnv({ COLUMNS: columns }).terminal.columns).toBe(80);
    expect(readEnv({ NO_COLOR: '' }).terminal.color).toBe(true);
    for (const value of ['1', '0', 'false']) expect(readEnv({ NO_COLOR: value }).terminal.color).toBe(false);
  });

  it('throws one EnvError naming every half-set or malformed group, never a value', () => {
    let caught: unknown;
    try {
      readEnv({ SUPABASE_URL: 'https://db.test', OPENROUTER_MODEL: SECRET, PROOF_URL: SECRET });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(EnvError);
    const error = caught instanceof EnvError ? caught : null;
    expect(error?.problems.map((problem) => problem.variables)).toEqual([
      ['OPENROUTER_MODEL', 'OPENROUTER_API_KEY'],
      ['PROOF_URL'],
      ['SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)', 'SUPABASE_SERVICE_ROLE_KEY'],
    ]);
    expect(error?.message).not.toContain(SECRET);
  });

  it('lets a command require what it needs, naming the variables', () => {
    expect(() => requireGroup(readEnv({}).supabase, SUPABASE, 'the import writes the personas')).toThrow(
      'environment: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are not set: the import writes the personas',
    );
    expect(() => requireGroup(readEnv({}).workspace, WORKSPACE, 'pass --workspace <slug>')).toThrow('OMNI_LOOP_WORKSPACE is not set: pass --workspace <slug>');
  });
});

describe('the environment passed on to a child', () => {
  it('adds GH_TOKEN to the environment given, keeping the rest', () => {
    expect(withGithubToken({ PATH: '/bin' }, 't')).toEqual({ PATH: '/bin', GH_TOKEN: 't' });
  });

  it('runs git without a prompt, and a step with its own variables, over this process', () => {
    expect(gitWithoutPrompt()).toMatchObject({ GIT_TERMINAL_PROMPT: '0', PATH: process.env.PATH });
    expect(withStepVariables({ FALLOW_AUDIT_BASE: 'abc' })).toMatchObject({ FALLOW_AUDIT_BASE: 'abc', PATH: process.env.PATH });
  });
});
