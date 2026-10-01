// The workspace a game script plays for. Every script names one: `--workspace <slug>`, or the
// variable OMNI_LOOP_WORKSPACE (the game workflow sets it); the flag wins. There is no default: with
// neither, the script stops rather than read or write the wrong workspace (spec D11).
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { supabaseFromEnv, loadWorkspace, type SupabaseRest, type Workspace } from '../sources/supabase.ts';

type Env = Readonly<Record<string, string | undefined>>;
/** The GitHub a workspace names. */
export type Github = { org: string; planRepo: string };
/** What a script without arguments of its own takes. */
export type NoArgs = Record<string, never>;
type Options<A> = { usage: string; parse?: ((argv: string[]) => A) | undefined; github?: boolean; argv?: readonly string[]; env?: Env };
/** A workspace opened for a script. */
export type Opened<A, G> = { rest: SupabaseRest; workspace: Workspace; args: A; github: G };

// What a thrown value says.
const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

export const WORKSPACE_VARIABLE = 'OMNI_LOOP_WORKSPACE';

/** Takes `--workspace <slug>` (or `--workspace=<slug>`) out of the arguments: { slug, argv: the rest, in order }. */
export function workspaceArg(argv: readonly string[], env: Env = {}): { slug: string; argv: string[] } {
  let flag: string | null = null;
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    let value: string | undefined;
    if (a === '--workspace') value = argv[++i];
    else if (a.startsWith('--workspace=')) value = a.slice('--workspace='.length);
    else { rest.push(a); continue; }
    if (!value || value.startsWith('--')) throw new Error('--workspace needs a slug');
    if (flag !== null) throw new Error(`--workspace is given twice ("${flag}" and "${value}")`);
    flag = value;
  }
  const slug = flag ?? (env[WORKSPACE_VARIABLE]?.trim() || null);
  if (!slug) throw new Error(`no workspace named: pass --workspace <slug>, or set ${WORKSPACE_VARIABLE}`);
  return { slug, argv: rest };
}

/** The GitHub a workspace names, for the scripts that read it (game:project, game:banner). */
export function githubOf(workspace: Pick<Workspace, 'slug' | 'github_org' | 'plan_repo'>): Github {
  const { github_org: org, plan_repo: planRepo } = workspace;
  if (!org) throw new Error(`workspace "${workspace.slug}" has no github_org: set it before reading its GitHub`);
  if (!planRepo) throw new Error(`workspace "${workspace.slug}" has no plan_repo: set it before reading its GitHub`);
  return { org, planRepo };
}

/** Whether the script at `url` (its `import.meta.url`) is the one node was run with, not an import of it. */
export function runByPath(url: string, argv: readonly string[] = process.argv): boolean {
  try {
    return realpathSync(argv[1] ?? '') === realpathSync(fileURLToPath(url));
  } catch {
    return false;
  }
}

/** A script that takes no argument of its own. */
export function noArgs(argv: readonly string[]): NoArgs {
  if (argv.length) throw new Error(`unexpected argument "${argv[0]}"`);
  return {};
}

function stop(message: string, code: number): never {
  console.error(message);
  process.exit(code);
}

/**
 * Opens the workspace a script names, before it reads or writes anything else. `parse` reads the
 * script's own arguments. A usage mistake prints `usage` and exits 2; a workspace that cannot be
 * read (unknown, or without the GitHub `github` asks for) exits 1, saying why.
 * Returns { rest: the Supabase client, workspace, args, github: { org, planRepo } | null }.
 */
export async function openWorkspace<A>(options: Options<A> & { parse: (argv: string[]) => A; github: true }): Promise<Opened<A, Github>>;
export async function openWorkspace<A>(options: Options<A> & { parse: (argv: string[]) => A; github?: false }): Promise<Opened<A, null>>;
export async function openWorkspace(options: Options<NoArgs> & { parse?: undefined; github: true }): Promise<Opened<NoArgs, Github>>;
export async function openWorkspace(options: Options<NoArgs> & { parse?: undefined; github?: false }): Promise<Opened<NoArgs, null>>;
export async function openWorkspace(
  { usage, parse = noArgs, github = false, argv = process.argv.slice(2), env = process.env }: Options<unknown>,
): Promise<Opened<unknown, Github | null>> {
  let slug: string, args: unknown;
  try {
    const named = workspaceArg(argv, env);
    slug = named.slug;
    args = parse(named.argv);
  } catch (err) {
    stop(`${messageOf(err)}\nusage: ${usage}`, 2);
  }
  try {
    const rest = supabaseFromEnv(env);
    const workspace = await loadWorkspace(rest, slug);
    return { rest, workspace, args, github: github ? githubOf(workspace) : null };
  } catch (err) {
    stop(messageOf(err), 1);
  }
}
