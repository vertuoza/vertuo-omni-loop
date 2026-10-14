import { describe, expect, it } from 'vitest';
import { EnvError, GAME_VARIABLES, gitWithoutPrompt, OMNI_TOKEN_PATTERN, PLATFORM_VARIABLES, omniTokenOf, readEnv, requireGroup, SUPABASE, VARIABLES, withGithubToken, withStepVariables, WORKSPACE } from './read.ts';

const SECRET = 'sk-fake-secret-0123456789';
/** A kit token as `omni setup-token` prints it: `omk_` and 43 base64url characters. */
const KIT_TOKEN = 'omk_Zq9xW3vK7pL2mN8bR4tY6uJ1hG5fD0sA_-cE3iO9wQv';

describe('readEnv', () => {
  it('gives every group null, and the terminal its defaults, when nothing is set', () => {
    expect(readEnv({})).toEqual({
      agentSession: null,
      openrouter: null,
      proof: null,
      terminal: { columns: 80, color: true },
      githubActions: null,
      workspace: null,
      supabase: null,
      packageManager: null,
      omniToken: null,
      session: { remote: false, display: false },
      runnerSender: null,
      claudeToken: null,
      heartbeat: true,
      ask: null,
    });
  });

  it("reads a runner job's sender only when both its variables are set, and stops nothing when one is", () => {
    expect(readEnv({ OMNI_SENT_BY: 'ada', OMNI_RUNNER: 'box-1' }).runnerSender).toEqual({ sentBy: 'ada', runner: 'box-1' });
    expect(readEnv({ OMNI_SENT_BY: 'ada' }).runnerSender).toBeNull();
    expect(readEnv({ OMNI_RUNNER: 'box-1' }).runnerSender).toBeNull();
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
    expect(env.agentSession).toEqual({ id: 'abc' });
    expect(env.openrouter).toEqual({ key: SECRET });
    expect(env.proof).toEqual({ url: 'https://preview.test/x' });
    expect(env.githubActions).toEqual({ output: '/tmp/out' });
    expect(env.workspace).toEqual({ slug: 'vertuoza' });
    expect(env.supabase).toEqual({ url: 'http://127.0.0.1:54321', key: SECRET });
    expect(env.packageManager).toEqual({ execPath: '/bin/pnpm.cjs' });
  });

  it('reads the optional members from their own variables', () => {
    const env = readEnv({ PROOF_STORAGE_STATE: '/tmp/state.json', GITHUB_STEP_SUMMARY: '/tmp/summary' });
    expect(env.proof).toEqual({ storageState: '/tmp/state.json' });
    expect(env.githubActions).toEqual({ summary: '/tmp/summary' });
  });

  it('lists the game\'s variables, the workspace and the Supabase pair, for game/README.md', () => {
    expect(GAME_VARIABLES).toEqual(['OMNI_LOOP_WORKSPACE', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  });

  it('names the group a half-set pair belongs to, and why a value is refused', () => {
    const messageOf = (source: Record<string, string>): string => {
      try {
        readEnv(source);
      } catch (error) {
        if (error instanceof EnvError) return error.message;
      }
      return '';
    };
    expect(messageOf({ OPENROUTER_MODEL: 'm' })).toContain('(OpenRouter: set all of them, or none)');
    expect(messageOf({ SUPABASE_SERVICE_ROLE_KEY: SECRET })).toContain('(the Supabase pair: set all of them, or none)');
    expect(messageOf({ OMNI_LOOP_WORKSPACE: '  ' })).toBe('environment: OMNI_LOOP_WORKSPACE is not valid: a workspace slug');
    expect(messageOf({ OMNI_TOKEN: 'omk_short' })).toBe('environment: OMNI_TOKEN is not valid: it is not a kit token: make one with omni setup-token');
  });

  describe('the agent session, any agent\'s (PRD 1739)', () => {
    it('reads OMNI_SESSION_ID first, then CLAUDE_CODE_SESSION_ID, and none when neither is set', () => {
      expect(readEnv({ OMNI_SESSION_ID: 'abc', CLAUDE_CODE_SESSION_ID: 'xyz' }).agentSession).toEqual({ id: 'abc' });
      expect(readEnv({ CLAUDE_CODE_SESSION_ID: 'xyz' }).agentSession).toEqual({ id: 'xyz' });
      expect(readEnv({ OMNI_SESSION_ID: 'abc' }).agentSession).toEqual({ id: 'abc' });
      expect(readEnv({}).agentSession).toBeNull();
      expect(readEnv({ OMNI_SESSION_ID: '', CLAUDE_CODE_SESSION_ID: '' }).agentSession).toBeNull();
    });

    it('trims an id, and passes over one that is blank or longer than 200 characters to the next', () => {
      expect(readEnv({ OMNI_SESSION_ID: '  abc  ' }).agentSession).toEqual({ id: 'abc' });
      expect(readEnv({ OMNI_SESSION_ID: '   ', CLAUDE_CODE_SESSION_ID: 'xyz' }).agentSession).toEqual({ id: 'xyz' });
      expect(readEnv({ OMNI_SESSION_ID: 'a'.repeat(201), CLAUDE_CODE_SESSION_ID: 'xyz' }).agentSession).toEqual({ id: 'xyz' });
      expect(readEnv({ OMNI_SESSION_ID: 'a'.repeat(200) }).agentSession).toEqual({ id: 'a'.repeat(200) });
      expect(readEnv({ OMNI_SESSION_ID: ' a ', CLAUDE_CODE_SESSION_ID: 'xyz' }).agentSession).toEqual({ id: 'a' });
      expect(readEnv({ CLAUDE_CODE_SESSION_ID: 'a'.repeat(201) }).agentSession).toBeNull();
    });

    it('lists OMNI_SESSION_ID for a person to set, and Claude Code\'s as the platform\'s', () => {
      expect(VARIABLES).toContain('OMNI_SESSION_ID');
      expect(VARIABLES).not.toContain('CLAUDE_CODE_SESSION_ID');
      expect(PLATFORM_VARIABLES).toContain('CLAUDE_CODE_SESSION_ID');
      expect(PLATFORM_VARIABLES).not.toContain('OMNI_SESSION_ID');
    });
  });

  describe('OMNI_HEARTBEAT, the switch of the heartbeat any command sends (PRD 1831)', () => {
    it('is on unless OMNI_HEARTBEAT is off or the command runs under vitest', () => {
      expect(readEnv({}).heartbeat).toBe(true);
      expect(readEnv({ OMNI_HEARTBEAT: 'on' }).heartbeat).toBe(true);
      expect(readEnv({ OMNI_HEARTBEAT: '' }).heartbeat).toBe(true);
      expect(readEnv({ OMNI_HEARTBEAT: 'off' }).heartbeat).toBe(false);
      expect(readEnv({ VITEST: 'true' }).heartbeat).toBe(false);
      expect(readEnv({ OMNI_HEARTBEAT: 'on', VITEST: 'true' }).heartbeat).toBe(false);
    });

    it('stops on a value other than on or off, naming the variable', () => {
      expect(() => readEnv({ OMNI_HEARTBEAT: 'no' })).toThrow(EnvError);
      expect(() => readEnv({ OMNI_HEARTBEAT: 'no' })).toThrow(/OMNI_HEARTBEAT/);
    });

    it('lists OMNI_HEARTBEAT for a person to set, and VITEST as the platform\'s', () => {
      expect(VARIABLES).toContain('OMNI_HEARTBEAT');
      expect(PLATFORM_VARIABLES).toContain('VITEST');
      expect(VARIABLES).not.toContain('VITEST');
    });
  });

  describe('OMNI_ASK, ask mode switched with no file (PRD 1831)', () => {
    it('reads on and off, and an unset or empty one as none', () => {
      expect(readEnv({}).ask).toBeNull();
      expect(readEnv({ OMNI_ASK: '' }).ask).toBeNull();
      expect(readEnv({ OMNI_ASK: 'on' }).ask).toBe('on');
      expect(readEnv({ OMNI_ASK: 'off' }).ask).toBe('off');
    });

    it('stops on a value other than on or off, naming the variable', () => {
      expect(() => readEnv({ OMNI_ASK: 'yes' })).toThrow(EnvError);
      expect(() => readEnv({ OMNI_ASK: 'yes' })).toThrow(/OMNI_ASK/);
    });

    it('lists OMNI_ASK for a person to set', () => {
      expect(VARIABLES).toContain('OMNI_ASK');
    });
  });

  describe('OMNI_TOKEN, the kit token a cloud session signs in with (PRD 1628)', () => {
    it('reads a token shaped as omni setup-token prints it, and lists the variable for the README', () => {
      expect(KIT_TOKEN).toMatch(OMNI_TOKEN_PATTERN);
      expect(readEnv({ OMNI_TOKEN: KIT_TOKEN }).omniToken).toEqual({ token: KIT_TOKEN });
      expect(readEnv({ OMNI_TOKEN: '' }).omniToken).toBeNull();
      expect(VARIABLES).toContain('OMNI_TOKEN');
    });

    it('stops on a malformed value with one problem naming the variable, never the value', () => {
      const malformed = [
        `${KIT_TOKEN}x`,
        KIT_TOKEN.slice(0, -1),
        `omb_${KIT_TOKEN.slice(4)}`,
        `OMK_${KIT_TOKEN.slice(4)}`,
        `${KIT_TOKEN.slice(0, -1)}=`,
        `${KIT_TOKEN.slice(0, -1)}.`,
        ` ${KIT_TOKEN}`,
        `${KIT_TOKEN}\n`,
        `x${KIT_TOKEN}`,
      ];
      for (const value of malformed) {
        let caught: unknown;
        try {
          readEnv({ OMNI_TOKEN: value });
        } catch (error) {
          caught = error;
        }
        expect(caught, value).toBeInstanceOf(EnvError);
        const error = caught instanceof EnvError ? caught : null;
        expect(error?.problems.map((problem) => problem.variables)).toEqual([['OMNI_TOKEN']]);
        expect(error?.message.split('\n')).toHaveLength(1);
        expect(error?.message).toContain('OMNI_TOKEN');
        expect(error?.message).not.toContain(KIT_TOKEN.slice(4, 12));
      }
    });

    it('reads the token alone, for the token store a command builds by default', () => {
      expect(omniTokenOf({ OMNI_TOKEN: KIT_TOKEN, PROOF_URL: 'not a url' })).toBe(KIT_TOKEN);
      expect(omniTokenOf({})).toBeNull();
      expect(() => omniTokenOf({ OMNI_TOKEN: 'omk_short' })).toThrow(EnvError);
    });
  });

  describe('CLAUDE_CODE_OAUTH_TOKEN, the Claude token omni runner hands its jobs (PRD 1894)', () => {
    const CLAUDE_TOKEN = 'sk-ant-oat01-fake-0123456789';

    it('reads the token when it is set, and none when it is unset or blank', () => {
      expect(readEnv({ CLAUDE_CODE_OAUTH_TOKEN: CLAUDE_TOKEN }).claudeToken).toBe(CLAUDE_TOKEN);
      expect(readEnv({}).claudeToken).toBeNull();
      expect(readEnv({ CLAUDE_CODE_OAUTH_TOKEN: '' }).claudeToken).toBeNull();
      expect(readEnv({ CLAUDE_CODE_OAUTH_TOKEN: '  \n' }).claudeToken).toBeNull();
    });

    it('lists it as a variable the platform sets, never one the README names', () => {
      expect(PLATFORM_VARIABLES).toContain('CLAUDE_CODE_OAUTH_TOKEN');
      expect(VARIABLES).not.toContain('CLAUDE_CODE_OAUTH_TOKEN');
    });
  });

  describe('the session a sign-in reads to choose its flow (PRD 1660)', () => {
    const REMOTE = ['CLAUDE_CODE_REMOTE', 'SSH_CONNECTION', 'SSH_TTY', 'CODESPACES'];
    const DISPLAYS = ['DISPLAY', 'WAYLAND_DISPLAY'];

    it('reads each remote-session variable on its own as a remote session, and an empty one as unset', () => {
      for (const name of REMOTE) {
        expect(readEnv({ [name]: '1' }).session, name).toEqual({ remote: true, display: false });
        expect(readEnv({ [name]: '' }).session, name).toEqual({ remote: false, display: false });
      }
      expect(readEnv({ SSH_CONNECTION: '10.0.0.1 51000 10.0.0.2 22', SSH_TTY: '/dev/pts/0' }).session).toEqual({ remote: true, display: false });
    });

    it('reads DISPLAY or WAYLAND_DISPLAY as a display, an empty one as none', () => {
      for (const name of DISPLAYS) {
        expect(readEnv({ [name]: ':0' }).session, name).toEqual({ remote: false, display: true });
        expect(readEnv({ [name]: '' }).session, name).toEqual({ remote: false, display: false });
      }
      expect(readEnv({ DISPLAY: ':0', SSH_TTY: '/dev/pts/0' }).session).toEqual({ remote: true, display: true });
    });

    it('lists them as variables the platform sets, never a person', () => {
      expect(PLATFORM_VARIABLES).toEqual(expect.arrayContaining([...REMOTE, ...DISPLAYS]));
      for (const name of [...REMOTE, ...DISPLAYS]) expect(VARIABLES).not.toContain(name);
    });
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
