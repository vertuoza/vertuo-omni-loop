/**
 * **The environment of the kit, the game and the scripts** (PRD 1059): the one module of this package
 * that reads `process.env`. `readEnv(source)` gives its feature groups, each complete or `null`; a
 * command's entry reads them once and hands each on, and a command that cannot run without one
 * requires it there with `requireGroup`, before any work.
 *
 * The process's environment is also passed on whole to the processes a command runs (`gh`, `git`,
 * `pnpm`): a child needs `PATH`, `HOME` and its own login, none of which is ours to parse. Each way it
 * is passed on is below, with its reason.
 */
import { z } from 'zod';
import { envGroup, envReader, variablesOf, type EnvNames, type EnvSource } from './group.ts';

export { EnvError, requireGroup, type EnvSource } from './group.ts';

/**
 * The session a person names for any agent (PRD 1739), set in a wrapper script: it wins over the
 * agent's own. The status line, `omni now` and the dossier record it.
 */
const OMNI_SESSION = envGroup({
  label: 'the agent session',
  schema: z.object({ id: z.string() }),
  variables: { id: 'OMNI_SESSION_ID' },
});

/** The Claude Code session a command runs in, read when `OMNI_SESSION_ID` gives none. */
const CLAUDE_SESSION = envGroup({
  label: 'the Claude session',
  schema: z.object({ id: z.string() }),
  variables: { id: 'CLAUDE_CODE_SESSION_ID' },
});

/** The longest session id a command takes. */
const SESSION_ID_MAX = 200;

/** The agent session a command runs in. */
export type AgentSession = { id: string };

/**
 * The first of `sessions` whose id could be a real one, trimmed: 1 to 200 characters once trimmed.
 * `OMNI_SESSION_ID`, then `CLAUDE_CODE_SESSION_ID`; `null` when neither gives one.
 */
function agentSessionOf(...sessions: ({ id: string } | null)[]): AgentSession | null {
  for (const session of sessions) {
    const id = session?.id.trim() ?? '';
    if (id.length >= 1 && id.length <= SESSION_ID_MAX) return { id };
  }
  return null;
}

/** OpenRouter, which `omni harvest` asks where each decision belongs; the model has a default. */
const OPENROUTER = envGroup({
  label: 'OpenRouter',
  schema: z.object({ key: z.string(), model: z.string().optional() }),
  variables: { key: 'OPENROUTER_API_KEY', model: 'OPENROUTER_MODEL' },
});

/** The proof's address and the file its sign-in is written to (`omni proof session`). */
const PROOF = envGroup({
  label: 'the proof',
  schema: z.object({ url: z.url().optional(), storageState: z.string().optional() }),
  variables: { url: 'PROOF_URL', storageState: 'PROOF_STORAGE_STATE' },
});

/**
 * The terminal the status line is drawn in. `COLUMNS` is the terminal's, not a person's setting: one
 * that is not a positive whole number is read as 80, never refused, so the status line always draws.
 */
const TERMINAL = envGroup({
  label: 'the terminal',
  schema: z.object({ columns: z.string().optional(), noColor: z.string().optional() }),
  variables: { columns: 'COLUMNS', noColor: 'NO_COLOR' },
});

/** The files a GitHub Actions runner gives a step for its outputs and its summary. */
const GITHUB_ACTIONS = envGroup({
  label: 'the GitHub Actions step',
  schema: z.object({ output: z.string().optional(), summary: z.string().optional() }),
  variables: { output: 'GITHUB_OUTPUT', summary: 'GITHUB_STEP_SUMMARY' },
});

/** The workspace a game script plays for, when `--workspace` names none (the game workflow sets it). */
export const WORKSPACE = envGroup({
  label: 'the workspace',
  schema: z.object({ slug: z.string().trim().min(1, 'a workspace slug') }),
  variables: { slug: 'OMNI_LOOP_WORKSPACE' },
});

/** The game's database: its address (the arcade's public one will do) and the service role's key. */
export const SUPABASE = envGroup({
  label: 'the Supabase pair',
  schema: z.object({ url: z.url(), key: z.string() }),
  variables: { url: ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'], key: 'SUPABASE_SERVICE_ROLE_KEY' },
});

/** A kit token's shape (PRD 1628): `omk_` and 32 random bytes in base64url, as `omni setup-token` prints it. */
export const OMNI_TOKEN_PATTERN = /^omk_[A-Za-z0-9_-]{43}$/;

/**
 * The kit token a cloud session signs in with (PRD 1628): set, it wins over the sign-in kept in
 * `~/.config/omni/credentials.json`. A value of another shape stops the command, naming the variable
 * and never the value.
 */
const OMNI_TOKEN = envGroup({
  label: 'the kit token',
  schema: z.object({ token: z.string().regex(OMNI_TOKEN_PATTERN, 'it is not a kit token: make one with omni setup-token') }),
  variables: { token: 'OMNI_TOKEN' },
});

/**
 * The session a command runs in, which `omni signin` reads to choose its flow (PRD 1660): the markers
 * of a terminal on another machine than the person's browser (a Claude Code cloud session, an SSH
 * login, a Codespace), and the display a browser could open on.
 */
const SESSION = envGroup({
  label: 'the session',
  schema: z.object({
    claudeCodeRemote: z.string().optional(),
    sshConnection: z.string().optional(),
    sshTty: z.string().optional(),
    codespaces: z.string().optional(),
    display: z.string().optional(),
    waylandDisplay: z.string().optional(),
  }),
  variables: {
    claudeCodeRemote: 'CLAUDE_CODE_REMOTE',
    sshConnection: 'SSH_CONNECTION',
    sshTty: 'SSH_TTY',
    codespaces: 'CODESPACES',
    display: 'DISPLAY',
    waylandDisplay: 'WAYLAND_DISPLAY',
  },
});

/**
 * Who sent the job a runner runs (PRD 1830): `omni runner` sets them on each job's session, and
 * `omni runner sender` reads them for `/omni:pr`'s body: the person's login (`OMNI_SENT_BY`), or, for
 * a job an API key sent (PRD 2433), the key's name (`OMNI_SENT_BY_KEY`), never both. Each may be
 * missing: a runner with no sender writes no line, and stops no command.
 */
const RUNNER_SENDER = envGroup({
  label: "the runner job's sender",
  schema: z.object({ sentBy: z.string().optional(), sentByKey: z.string().optional(), runner: z.string().optional() }),
  variables: { sentBy: 'OMNI_SENT_BY', sentByKey: 'OMNI_SENT_BY_KEY', runner: 'OMNI_RUNNER' },
});

/**
 * The GitHub App a job runs as (PRD 2433): `omni runner` sets `OMNI_GITHUB_APP` to the app's bot login
 * (`<slug>[bot]`) on the session of a job an API key with an app sent. While it is set, everything the
 * job writes on GitHub is that bot's, and the kit's own GitHub calls use the job's token, never a
 * person's login.
 */
const GITHUB_APP = envGroup({
  label: 'the GitHub App a job runs as',
  schema: z.object({ login: z.string() }),
  variables: { login: 'OMNI_GITHUB_APP' },
});

/**
 * The Claude token a headless server signs in with (PRD 1894): `claude setup-token` prints it, and
 * `omni runner` hands it to each job's session, which takes no other variable from the runner. Never
 * printed. `ANTHROPIC_API_KEY` is never read: a job must not bill an API key nobody chose for it.
 */
const CLAUDE_TOKEN = envGroup({
  label: 'the Claude token',
  schema: z.object({ token: z.string() }),
  variables: { token: 'CLAUDE_CODE_OAUTH_TOKEN' },
});

/** The Claude token, trimmed, or `null` when it is unset or blank. */
function claudeTokenOf(group: z.output<typeof CLAUDE_TOKEN.schema> | null): string | null {
  const token = group?.token.trim() ?? '';
  return token === '' ? null : token;
}

/**
 * The heartbeat any `omni` command sends (PRD 1831): `off` turns it off. `omni heartbeat` itself, which
 * Claude Code's hook runs, does not read it.
 */
const HEARTBEAT = envGroup({
  label: 'the heartbeat',
  schema: z.object({ switch: z.enum(['on', 'off'], 'on or off') }),
  variables: { switch: 'OMNI_HEARTBEAT' },
});

/**
 * Ask mode switched with no file (PRD 1831): `on` turns it on in a checkout with no `ask.json` (a cloud
 * session's fresh clone), `off` turns it off whatever the file says. Unset, the file decides.
 */
const ASK = envGroup({
  label: 'ask mode',
  schema: z.object({ switch: z.enum(['on', 'off'], 'on or off') }),
  variables: { switch: 'OMNI_ASK' },
});

/** How `OMNI_ASK` switches ask mode: `on`, `off`, or `null` when it is unset and `ask.json` decides. */
export type AskSwitch = 'on' | 'off' | null;

/**
 * An unattended run (PRD 2175): `omni runner` sets `OMNI_UNATTENDED=1` on each job's session, where
 * nobody is there to answer. Set to anything but empty, `0`, `off` or `false`, a skill asks no one.
 */
const UNATTENDED = envGroup({
  label: 'an unattended run',
  schema: z.object({ flag: z.string() }),
  variables: { flag: 'OMNI_UNATTENDED' },
});

/**
 * The runner job a session runs (PRD 2175): `omni runner` sets `OMNI_JOB` to the job's id on each job's
 * session, beside `OMNI_RUNNER` (the sender's pair, above) and `OMNI_UNATTENDED`. `/omni:pr`'s Claim
 * mode writes it in a claim's status comment, so the runner can release the claims a dead job held.
 */
const RUNNER_JOB = envGroup({
  label: 'the runner job',
  schema: z.object({ job: z.string() }),
  variables: { job: 'OMNI_JOB' },
});

/** Whether the run is unattended: `OMNI_UNATTENDED` set to something other than empty, `0`, `off` or `false`. */
function flagIsOn(group: z.output<typeof UNATTENDED.schema> | null): boolean {
  const flag = group?.flag.trim().toLowerCase() ?? '';
  return flag !== '' && flag !== '0' && flag !== 'off' && flag !== 'false';
}

/** The test runner a command runs under: vitest sets `VITEST`, and no heartbeat leaves a test. */
const TEST_RUNNER = envGroup({
  label: 'the test runner',
  schema: z.object({ vitest: z.string() }),
  variables: { vitest: 'VITEST' },
});

/** Whether a command sends the heartbeat: unless `OMNI_HEARTBEAT` is `off`, or under vitest. */
function heartbeatOf(group: z.output<typeof HEARTBEAT.schema> | null, runner: z.output<typeof TEST_RUNNER.schema> | null): boolean {
  return group?.switch !== 'off' && runner === null;
}

/** The package manager that runs a script, which `pnpm check:changed` runs its steps with. */
const PACKAGE_MANAGER = envGroup({
  label: 'the package manager',
  schema: z.object({ execPath: z.string() }),
  variables: { execPath: 'npm_execpath' },
});

/**
 * The variables a person sets for the kit, the game and the scripts: the root README's list names
 * exactly these (`scripts/env-docs.test.ts`).
 */
export const VARIABLES: readonly string[] = variablesOf([OPENROUTER, PROOF, WORKSPACE, SUPABASE, OMNI_TOKEN, OMNI_SESSION, HEARTBEAT, ASK]);

/** The game's own, a part of {@link VARIABLES}: `game/README.md`'s list names exactly these. */
export const GAME_VARIABLES: readonly string[] = variablesOf([WORKSPACE, SUPABASE]);

/**
 * The variables the platform sets, read here but never set by a person, so no docs list names them:
 * Claude Code's session, the terminal, the GitHub Actions runner, the package manager, the session
 * a sign-in reads, the test runner, the sender `omni runner` sets on each job, and the Claude token
 * it hands them.
 */
export const PLATFORM_VARIABLES: readonly string[] = variablesOf([CLAUDE_SESSION, TERMINAL, GITHUB_ACTIONS, PACKAGE_MANAGER, SESSION, TEST_RUNNER, RUNNER_SENDER, GITHUB_APP, CLAUDE_TOKEN, UNATTENDED, RUNNER_JOB]);

const DEFAULT_COLUMNS = 80;

/** The terminal's width and whether colour is on, as the status line draws. */
export type Terminal = { columns: number; color: boolean };

/** `COLUMNS` when it is a positive whole number, else 80; colour unless `NO_COLOR` is set. */
function terminalOf(group: z.output<typeof TERMINAL.schema> | null): Terminal {
  // Unset is NaN, and blank is 0: neither is a positive whole number.
  const columns = Number(group?.columns);
  return { columns: Number.isInteger(columns) && columns > 0 ? columns : DEFAULT_COLUMNS, color: group?.noColor === undefined };
}

/** Where the terminal runs: on another machine than the person's browser (`remote`), and whether a
 * browser could open on a display here (`display`). */
export type Session = { remote: boolean; display: boolean };

/** `remote` when any of the remote-session variables is set, `display` when either display is. */
function sessionOf(group: z.output<typeof SESSION.schema> | null): Session {
  const remote = [group?.claudeCodeRemote, group?.sshConnection, group?.sshTty, group?.codespaces].some((value) => value !== undefined);
  const display = [group?.display, group?.waylandDisplay].some((value) => value !== undefined);
  return { remote, display };
}

/** Who sent a runner's job (PRD 2433): the person's login, or the API key's name, and the runner it runs on. */
type RunnerSender = { sentBy: string | null; sentByKey: string | null; runner: string };

/** Who sent a runner's job, when its runner and its person or its key are set; a blank variable is unset. */
function senderOf(group: z.output<typeof RUNNER_SENDER.schema> | null): RunnerSender | null {
  const sentBy = group?.sentBy || null;
  const sentByKey = group?.sentByKey || null;
  return group?.runner && (sentBy !== null || sentByKey !== null) ? { sentBy, sentByKey, runner: group.runner } : null;
}

/** The app's bot login, trimmed, or `null` when `OMNI_GITHUB_APP` is unset or blank. */
function githubAppOfGroup(group: z.output<typeof GITHUB_APP.schema> | null): string | null {
  const login = group?.login.trim() ?? '';
  return login === '' ? null : login;
}

/** Every group of the kit, the game and the scripts, read from `source`; throws one `EnvError` naming every problem. */
export function readEnv(source: EnvSource) {
  const reader = envReader(source);
  const env = {
    agentSession: agentSessionOf(reader.group(OMNI_SESSION), reader.group(CLAUDE_SESSION)),
    openrouter: reader.group(OPENROUTER),
    proof: reader.group(PROOF),
    terminal: terminalOf(reader.group(TERMINAL)),
    githubActions: reader.group(GITHUB_ACTIONS),
    workspace: reader.group(WORKSPACE),
    supabase: reader.group(SUPABASE),
    packageManager: reader.group(PACKAGE_MANAGER),
    omniToken: reader.group(OMNI_TOKEN),
    session: sessionOf(reader.group(SESSION)),
    runnerSender: senderOf(reader.group(RUNNER_SENDER)),
    githubApp: githubAppOfGroup(reader.group(GITHUB_APP)),
    claudeToken: claudeTokenOf(reader.group(CLAUDE_TOKEN)),
    heartbeat: heartbeatOf(reader.group(HEARTBEAT), reader.group(TEST_RUNNER)),
    ask: (reader.group(ASK)?.switch ?? null) satisfies AskSwitch,
  };
  reader.done();
  return env;
}

/** Whether `source` marks the run unattended, read alone: a runner job's session has nobody to answer. */
export function unattendedOf(source: EnvSource): boolean {
  const reader = envReader(source);
  const on = flagIsOn(reader.group(UNATTENDED));
  reader.done();
  return on;
}

/** The runner job a session runs: its id and its runner's name, or `null` outside a runner's job. */
export type RunnerJobEnv = { job: string; runner: string | null };

/**
 * The runner job `source` names, read alone: `OMNI_JOB` trimmed, with `OMNI_RUNNER` when it is set;
 * `null` when `OMNI_JOB` is unset or blank, as in a session a person started.
 */
export function runnerJobOf(source: EnvSource): RunnerJobEnv | null {
  const reader = envReader(source);
  const job = reader.group(RUNNER_JOB)?.job.trim() ?? '';
  const runner = reader.group(RUNNER_SENDER)?.runner?.trim() ?? '';
  reader.done();
  return job === '' ? null : { job, runner: runner === '' ? null : runner };
}

/**
 * The variables `omni runner` sets on a job's session (PRD 2175), named here as every variable is
 * (ADR-0057): the job's id, the runner's name, and the mark of an unattended run.
 */
export function runnerJobVariables(job: string, runner: string): Record<string, string> {
  return { [setName(RUNNER_JOB.variables.job)]: job, [setName(RUNNER_SENDER.variables.runner)]: runner, [setName(UNATTENDED.variables.flag)]: '1' };
}

/**
 * The sender variables `omni runner` sets on a job's session: a key's job (PRD 2433) names the key
 * (`OMNI_SENT_BY_KEY`) and never the person who made it, whose login its `sentBy` may carry; any other
 * job names its sender's login (`OMNI_SENT_BY`); a job with neither sets none. The runner's name goes
 * with either.
 */
export function runnerSenderVariables(job: { sentBy: string | null; sentByKey: string | null }, runner: string): Record<string, string> {
  const runnerName = setName(RUNNER_SENDER.variables.runner);
  if (job.sentByKey !== null) return { [setName(RUNNER_SENDER.variables.sentByKey)]: job.sentByKey, [runnerName]: runner };
  if (job.sentBy !== null && job.sentBy !== '') return { [setName(RUNNER_SENDER.variables.sentBy)]: job.sentBy, [runnerName]: runner };
  return {};
}

/** The app's bot login `source` names, read alone: `OMNI_GITHUB_APP` trimmed, or `null` when it is unset or blank. */
export function githubAppOf(source: EnvSource): string | null {
  const reader = envReader(source);
  const login = githubAppOfGroup(reader.group(GITHUB_APP));
  reader.done();
  return login;
}

/**
 * The variables a job running as a GitHub App gets (PRD 2433): `OMNI_GITHUB_APP`, and the bot as the
 * author and the committer of every commit the job makes.
 */
export function githubAppVariables(bot: { login: string; email: string }): Record<string, string> {
  return {
    [setName(GITHUB_APP.variables.login)]: bot.login,
    GIT_AUTHOR_NAME: bot.login,
    GIT_AUTHOR_EMAIL: bot.email,
    GIT_COMMITTER_NAME: bot.login,
    GIT_COMMITTER_EMAIL: bot.email,
  };
}

/**
 * Git's configuration given through the environment, entry by entry in the order given (`GIT_CONFIG_COUNT`,
 * `GIT_CONFIG_KEY_<n>`, `GIT_CONFIG_VALUE_<n>`): it outranks every file, and an entry with an empty value
 * for a `credential.<url>.helper` key first drops the helpers the files name for that url.
 */
export function gitConfigVariables(entries: readonly (readonly [key: string, value: string])[]): Record<string, string> {
  const variables: Record<string, string> = { GIT_CONFIG_COUNT: String(entries.length) };
  entries.forEach(([key, value], n) => {
    variables[`GIT_CONFIG_KEY_${String(n)}`] = key;
    variables[`GIT_CONFIG_VALUE_${String(n)}`] = value;
  });
  return variables;
}

/** The variable a member is set under: its first name, the one the kit writes. */
function setName(names: EnvNames): string {
  return typeof names === 'string' ? names : names[0];
}

/**
 * The kit token `source` holds, or `null`, read alone: what the token store a command builds by
 * default signs in with. A malformed one throws the `EnvError` `readEnv` would.
 */
export function omniTokenOf(source: EnvSource): string | null {
  const reader = envReader(source);
  const group = reader.group(OMNI_TOKEN);
  reader.done();
  return group?.token ?? null;
}

/** The kit token this process was started with, or `null`: {@link omniTokenOf} the process's environment. */
export function processOmniToken(): string | null {
  return omniTokenOf(processEnv());
}

/**
 * Whether this process runs under vitest: the guard a default that starts a real process reads, so
 * that a test handing a command its own environment never starts one.
 */
export function processUnderTest(): boolean {
  return Boolean(processEnv().VITEST);
}

/** The kit's, the game's and the scripts' groups, as `readEnv` gives them. */
export type KitEnv = ReturnType<typeof readEnv>;
/** The Supabase pair. */
export type SupabaseEnv = z.output<typeof SUPABASE.schema>;

/** An environment a child process is started with. */
export type ChildEnv = Record<string, string | undefined>;

/** The environment this process was started with: the one read of `process.env`, at a program's entry. */
export function processEnv(): ChildEnv {
  return process.env;
}

/**
 * The environment `gh` runs with under another login: `env` plus `GH_TOKEN`. `gh` takes the token
 * from its environment, so it is never written into an argument or a shell string.
 */
export function withGithubToken(env: EnvSource, token: string): ChildEnv {
  return { ...env, GH_TOKEN: token };
}

/**
 * The environment `git` runs with when nobody can answer it: this process's, with
 * `GIT_TERMINAL_PROMPT=0`, so a remote that wants credentials is a failed fetch, never a hung command.
 */
export function gitWithoutPrompt(): ChildEnv {
  return { ...process.env, GIT_TERMINAL_PROMPT: '0' };
}

/**
 * The environment a check step runs with: this process's, which carries the package manager and the
 * PATH, plus the step's own variables (the fallow audit's `FALLOW_AUDIT_BASE`, its merge-base).
 */
export function withStepVariables(variables: Readonly<Record<string, string>>): ChildEnv {
  return { ...process.env, ...variables };
}
