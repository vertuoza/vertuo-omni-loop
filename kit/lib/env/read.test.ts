import { describe, expect, it } from 'vitest';
import { EnvError, GAME_VARIABLES, gitWithoutPrompt, OMNI_TOKEN_PATTERN, PLATFORM_VARIABLES, omniTokenOf, readEnv, requireGroup, SUPABASE, VARIABLES, withGithubToken, withStepVariables, WORKSPACE } from './read.ts';
import { gitConfigVariables, githubAppOf, githubAppVariables, runnerJobOf, runnerJobVariables, runnerSenderVariables, unattendedOf } from './read.ts';

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
      githubApp: null,
      claudeToken: null,
      heartbeat: true,
      ask: null,
    });
  });

  it("reads a runner job's sender only when its runner and one of its two senders are set, and stops nothing when one is missing", () => {
    expect(readEnv({ OMNI_SENT_BY: 'ada', OMNI_RUNNER: 'box-1' }).runnerSender).toEqual({ sentBy: 'ada', sentByKey: null, runner: 'box-1' });
    expect(readEnv({ OMNI_SENT_BY_KEY: 'deploy bot', OMNI_RUNNER: 'box-1' }).runnerSender).toEqual({ sentBy: null, sentByKey: 'deploy bot', runner: 'box-1' });
    expect(readEnv({ OMNI_SENT_BY: 'ada', OMNI_SENT_BY_KEY: 'deploy bot', OMNI_RUNNER: 'box-1' }).runnerSender).toEqual({ sentBy: 'ada', sentByKey: 'deploy bot', runner: 'box-1' });
    expect(readEnv({ OMNI_SENT_BY: 'ada' }).runnerSender).toBeNull();
    expect(readEnv({ OMNI_SENT_BY_KEY: 'deploy bot' }).runnerSender).toBeNull();
    expect(readEnv({ OMNI_RUNNER: 'box-1' }).runnerSender).toBeNull();
    expect(readEnv({ OMNI_SENT_BY: '', OMNI_SENT_BY_KEY: '', OMNI_RUNNER: 'box-1' }).runnerSender).toBeNull();
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
    const CLAUDE_TOKEN = 'fake-claude-oauth-token-0123456789';

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

// PRD 2175 s2: the runner job a session runs, and the variables `omni runner` sets on it.
describe('the runner job (PRD 2175)', () => {
  it('reads OMNI_JOB trimmed, with OMNI_RUNNER when it is set', () => {
    expect(runnerJobOf({ OMNI_JOB: ' job-7 ', OMNI_RUNNER: ' box-1 ' })).toEqual({ job: 'job-7', runner: 'box-1' });
    expect(runnerJobOf({ OMNI_JOB: 'job-7' })).toEqual({ job: 'job-7', runner: null });
    expect(runnerJobOf({ OMNI_JOB: 'job-7', OMNI_RUNNER: '  ' })).toEqual({ job: 'job-7', runner: null });
  });

  it('reads no job outside a runner, or when OMNI_JOB is blank', () => {
    expect(runnerJobOf({})).toBeNull();
    expect(runnerJobOf({ OMNI_RUNNER: 'box-1' })).toBeNull();
    expect(runnerJobOf({ OMNI_JOB: '   ' })).toBeNull();
  });

  it('names the three variables a job session gets, and lists them as the platform\'s', () => {
    expect(runnerJobVariables('job-7', 'box-1')).toEqual({ OMNI_JOB: 'job-7', OMNI_RUNNER: 'box-1', OMNI_UNATTENDED: '1' });
    expect(PLATFORM_VARIABLES).toEqual(expect.arrayContaining(['OMNI_JOB', 'OMNI_RUNNER', 'OMNI_UNATTENDED']));
    expect(VARIABLES).not.toContain('OMNI_JOB');
  });

  it('reads OMNI_UNATTENDED as on unless it is empty, 0, off or false, whatever its case or spaces', () => {
    for (const flag of ['1', 'yes', ' on ', 'TRUE']) expect(unattendedOf({ OMNI_UNATTENDED: flag }), flag).toBe(true);
    for (const flag of ['', '  ', '0', ' 0 ', 'off', 'OFF', 'false', ' False ']) expect(unattendedOf({ OMNI_UNATTENDED: flag }), flag).toBe(false);
    expect(unattendedOf({})).toBe(false);
  });

  it('reads the variables it sets back as the same job, unattended', () => {
    const set = runnerJobVariables('job-7', 'box-1');
    expect(runnerJobOf(set)).toEqual({ job: 'job-7', runner: 'box-1' });
    expect(unattendedOf(set)).toBe(true);
  });
});

// PRD 2433 s2: the GitHub App a key's job runs as, and what the sender of a key's job is called.
describe('the GitHub App a job runs as (PRD 2433)', () => {
  it('reads OMNI_GITHUB_APP trimmed, and none when it is unset or blank', () => {
    expect(githubAppOf({ OMNI_GITHUB_APP: ' acme-fixer[bot] ' })).toBe('acme-fixer[bot]');
    expect(githubAppOf({ OMNI_GITHUB_APP: '   ' })).toBeNull();
    expect(githubAppOf({ OMNI_GITHUB_APP: '' })).toBeNull();
    expect(githubAppOf({})).toBeNull();
    expect(readEnv({ OMNI_GITHUB_APP: 'acme-fixer[bot]' }).githubApp).toBe('acme-fixer[bot]');
    expect(readEnv({ OMNI_GITHUB_APP: ' ' }).githubApp).toBeNull();
  });

  it("names the variables a job running as an app gets: its login and the bot as git's author and committer", () => {
    expect(githubAppVariables({ login: 'acme-fixer[bot]', email: '4242+acme-fixer[bot]@users.noreply.github.com' })).toEqual({
      OMNI_GITHUB_APP: 'acme-fixer[bot]',
      GIT_AUTHOR_NAME: 'acme-fixer[bot]',
      GIT_AUTHOR_EMAIL: '4242+acme-fixer[bot]@users.noreply.github.com',
      GIT_COMMITTER_NAME: 'acme-fixer[bot]',
      GIT_COMMITTER_EMAIL: '4242+acme-fixer[bot]@users.noreply.github.com',
    });
  });

  it("numbers git's configuration passed through the environment, in the order given, and counts it", () => {
    expect(gitConfigVariables([['credential.helper', ''], ['url.https://github.com/.insteadOf', 'git@github.com:']])).toEqual({
      GIT_CONFIG_COUNT: '2',
      GIT_CONFIG_KEY_0: 'credential.helper',
      GIT_CONFIG_VALUE_0: '',
      GIT_CONFIG_KEY_1: 'url.https://github.com/.insteadOf',
      GIT_CONFIG_VALUE_1: 'git@github.com:',
    });
    expect(gitConfigVariables([])).toEqual({ GIT_CONFIG_COUNT: '0' });
  });

  it("names a job's sender as the key's name for a key's job, else as the person's login, else as nothing", () => {
    expect(runnerSenderVariables({ sentBy: 'ada', sentByKey: null }, 'box-1')).toEqual({ OMNI_SENT_BY: 'ada', OMNI_RUNNER: 'box-1' });
    expect(runnerSenderVariables({ sentBy: null, sentByKey: 'deploy bot' }, 'box-1')).toEqual({ OMNI_SENT_BY_KEY: 'deploy bot', OMNI_RUNNER: 'box-1' });
    // A key's job names the key, never the person who made it: the login its sender carries stays off its session.
    expect(runnerSenderVariables({ sentBy: 'API key deploy bot (@ada)', sentByKey: 'deploy bot' }, 'box-1')).toEqual({ OMNI_SENT_BY_KEY: 'deploy bot', OMNI_RUNNER: 'box-1' });
    expect(runnerSenderVariables({ sentBy: null, sentByKey: null }, 'box-1')).toEqual({});
    // A person's name that is empty names no one: the job carries no sender at all.
    expect(runnerSenderVariables({ sentBy: '', sentByKey: null }, 'box-1')).toEqual({});
  });

  it("lists the new variables as the platform's, never one a README names", () => {
    expect(PLATFORM_VARIABLES).toEqual(expect.arrayContaining(['OMNI_GITHUB_APP', 'OMNI_SENT_BY_KEY']));
    expect(VARIABLES).not.toContain('OMNI_GITHUB_APP');
    expect(VARIABLES).not.toContain('OMNI_SENT_BY_KEY');
  });

  it('reads the sender a key job sets back, whole', () => {
    expect(readEnv(runnerSenderVariables({ sentBy: null, sentByKey: 'deploy bot' }, 'box-1')).runnerSender).toEqual({ sentBy: null, sentByKey: 'deploy bot', runner: 'box-1' });
  });
});
