// The workspace a game script plays for. Every script names one: `--workspace <slug>`, or the
// variable OMNI_LOOP_WORKSPACE (the game workflow sets it); the flag wins. There is no default: with
// neither, the script stops rather than read or write the wrong workspace (spec D11).
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { supabaseFromEnv, loadWorkspace } from '../sources/supabase.mjs';

export const WORKSPACE_VARIABLE = 'OMNI_LOOP_WORKSPACE';

/** Takes `--workspace <slug>` (or `--workspace=<slug>`) out of the arguments: { slug, argv: the rest, in order }. */
export function workspaceArg(argv, env = {}) {
  let flag = null;
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    let value;
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
export function githubOf(workspace) {
  for (const column of ['github_org', 'plan_repo']) {
    if (!workspace[column]) throw new Error(`workspace "${workspace.slug}" has no ${column}: set it before reading its GitHub`);
  }
  return { org: workspace.github_org, planRepo: workspace.plan_repo };
}

/** Whether the script at `url` (its `import.meta.url`) is the one node was run with, not an import of it. */
export function runByPath(url, argv = process.argv) {
  try {
    return realpathSync(argv[1]) === realpathSync(fileURLToPath(url));
  } catch {
    return false;
  }
}

/** A script that takes no argument of its own. */
export function noArgs(argv) {
  if (argv.length) throw new Error(`unexpected argument "${argv[0]}"`);
  return {};
}

function stop(message, code) {
  console.error(message);
  process.exit(code);
}

/**
 * Opens the workspace a script names, before it reads or writes anything else. `parse` reads the
 * script's own arguments. A usage mistake prints `usage` and exits 2; a workspace that cannot be
 * read (unknown, or without the GitHub `github` asks for) exits 1, saying why.
 * Returns { rest: the Supabase client, workspace, args, github: { org, planRepo } | null }.
 */
export async function openWorkspace({ usage, parse = noArgs, github = false, argv = process.argv.slice(2), env = process.env }) {
  let slug, args;
  try {
    const named = workspaceArg(argv, env);
    slug = named.slug;
    args = parse(named.argv);
  } catch (err) {
    stop(`${err.message}\nusage: ${usage}`, 2);
  }
  try {
    const rest = supabaseFromEnv(env);
    const workspace = await loadWorkspace(rest, slug);
    return { rest, workspace, args, github: github ? githubOf(workspace) : null };
  } catch (err) {
    stop(err.message, 1);
  }
}
