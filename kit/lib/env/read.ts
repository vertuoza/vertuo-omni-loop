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
import { envGroup, envReader, type EnvSource } from './group.ts';

export { EnvError, requireGroup, type EnvSource } from './group.ts';

/** The Claude Code session a command runs in: the status line and the dossier record it. */
const CLAUDE_SESSION = envGroup({
  label: 'the Claude session',
  schema: z.object({ id: z.string() }),
  variables: { id: 'CLAUDE_CODE_SESSION_ID' },
});

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

/** The package manager that runs a script, which `pnpm check:changed` runs its steps with. */
const PACKAGE_MANAGER = envGroup({
  label: 'the package manager',
  schema: z.object({ execPath: z.string() }),
  variables: { execPath: 'npm_execpath' },
});

const DEFAULT_COLUMNS = 80;

/** The terminal's width and whether colour is on, as the status line draws. */
export type Terminal = { columns: number; color: boolean };

/** `COLUMNS` when it is a positive whole number, else 80; colour unless `NO_COLOR` is set. */
function terminalOf(group: z.output<typeof TERMINAL.schema> | null): Terminal {
  const raw = group?.columns;
  const columns = raw !== undefined && raw.trim() !== '' ? Number(raw) : Number.NaN;
  return { columns: Number.isInteger(columns) && columns > 0 ? columns : DEFAULT_COLUMNS, color: group?.noColor === undefined };
}

/** Every group of the kit, the game and the scripts, read from `source`; throws one `EnvError` naming every problem. */
export function readEnv(source: EnvSource) {
  const reader = envReader(source);
  const env = {
    claudeSession: reader.group(CLAUDE_SESSION),
    openrouter: reader.group(OPENROUTER),
    proof: reader.group(PROOF),
    terminal: terminalOf(reader.group(TERMINAL)),
    githubActions: reader.group(GITHUB_ACTIONS),
    workspace: reader.group(WORKSPACE),
    supabase: reader.group(SUPABASE),
    packageManager: reader.group(PACKAGE_MANAGER),
  };
  reader.done();
  return env;
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
