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
import { envGroup, envReader, variablesOf, type EnvSource } from './group.ts';

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
export const VARIABLES: readonly string[] = variablesOf([OPENROUTER, PROOF, WORKSPACE, SUPABASE, OMNI_TOKEN, OMNI_SESSION]);

/** The game's own, a part of {@link VARIABLES}: `game/README.md`'s list names exactly these. */
export const GAME_VARIABLES: readonly string[] = variablesOf([WORKSPACE, SUPABASE]);

/**
 * The variables the platform sets, read here but never set by a person, so no docs list names them:
 * Claude Code's session, the terminal, the GitHub Actions runner, the package manager and the session
 * a sign-in reads.
 */
export const PLATFORM_VARIABLES: readonly string[] = variablesOf([CLAUDE_SESSION, TERMINAL, GITHUB_ACTIONS, PACKAGE_MANAGER, SESSION]);

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
  };
  reader.done();
  return env;
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
