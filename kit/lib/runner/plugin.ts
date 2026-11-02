// What `omni runner` does with the Omni plugin (PRD 2100, s4). A job's skills come from the plugin
// installed on the machine, which only `claude plugin update` moves; a runner that never looked ran
// `/omni:bug-fix` as it read before the PRD that changed it (#6720). So:
//
// - Before a job, once its worktree is made, the plugin's version is compared with the omni the job's
//   repository pins (the version its `.omni-loop/bin/omni.mjs` carries). A plugin as new, or newer,
//   starts nothing. An older one is updated, then read again; still older, the job fails before Claude
//   starts, with the reason. A plugin that is not installed fails the job the same way. A list that
//   does not read lets the job run, and its log's first line says so.
// - The runner's sweep updates the plugin at start and every hour, so it follows the latest release
//   even when no repository needs it.
// - One update runs at a time, across every slot and the sweep, and a slot that waited for its turn
//   reads the version again before it updates: two jobs starting together update the plugin once.
//
// The runner prints a line only when the version changed (`omni plugin v<x> → v<y>`) or an update
// failed (`omni plugin update failed: <its last line>`). Nothing here throws.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { z } from 'zod';
import { skillCopy } from '../agents/write.ts';
import type { ExecText } from '../context.ts';
import { MARKETPLACE, PLUGIN } from '../init/steps.ts';
import { propertyOf } from '../narrow.ts';
import { BIN_FILE } from '../update/apply.ts';
import { installedVersion } from '../update/installed.ts';
import { runPluginUpdate } from '../update/plugin.ts';
import { compareVersions, parseVersion } from '../version/version.ts';

/** The Omni plugin's id, as `claude plugin list` names it. */
const OMNI_PLUGIN_ID = `${PLUGIN}@${MARKETPLACE}`;

/** How long `claude plugin list` may take. */
const LIST_BUDGET_MS = 10_000;

const LIST: ExecFileSyncOptionsWithStringEncoding = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: LIST_BUDGET_MS };

/** `claude plugin list --json`: an array whose entries may be anything but an object. */
const ListSchema = z.array(z.looseObject({ id: z.unknown(), version: z.unknown().optional(), scope: z.unknown().optional() }).nullable().catch(null));

/** The plugin as the list shows it: its version, not installed, or why the list did not read. */
export type PluginRead =
  | { readonly kind: 'version'; readonly version: string }
  | { readonly kind: 'missing' }
  | { readonly kind: 'unread'; readonly why: string };

/** The omni a repository pins: what its bin carries, the running kit's for a shim bin; `null` with no bin. */
export function pinnedOmni({ root, running, bundle }: { root: string; running: { version: string | null }; bundle: string | null }): string | null {
  if (!existsSync(join(root, BIN_FILE))) return null;
  return installedVersion({ root, running, bundle }) ?? running.version;
}

/** Why `claude plugin list` failed, in a few words. */
function whyNotRun(error: unknown): string {
  const code = propertyOf(error, 'code');
  if (code === 'ENOENT') return 'claude not found';
  return code === 'ETIMEDOUT' ? 'timed out' : 'claude plugin list failed';
}

/**
 * The version a job runs on. `claude plugin list` has one entry per scope the plugin is installed
 * at (a person's own, and each project's): a job runs in a worktree of its own, so the user entry
 * is the one that counts, the oldest when there are several. With no user entry, the newest.
 */
function versionOfEntries(entries: readonly { readonly version?: unknown; readonly scope?: unknown }[]): string | null {
  const user = entries.filter((entry) => entry.scope === undefined || entry.scope === 'user');
  const versions = (user.length > 0 ? user : entries).flatMap((entry) => {
    const version = parseVersion(entry.version);
    return version === null ? [] : [version];
  });
  const ordered = versions.toSorted(compareVersions);
  return (user.length > 0 ? ordered.at(0) : ordered.at(-1)) ?? null;
}

/** The Omni plugin as `claude plugin list --json` shows it. */
export function readPlugin(exec: ExecText): PluginRead {
  let text: string;
  try {
    text = exec('claude', ['plugin', 'list', '--json'], LIST);
  } catch (error) {
    return { kind: 'unread', why: whyNotRun(error) };
  }
  let list: z.infer<typeof ListSchema>;
  try {
    list = ListSchema.parse(JSON.parse(text));
  } catch {
    return { kind: 'unread', why: 'claude plugin list was unreadable' };
  }
  const entries = list.filter((entry) => entry?.id === OMNI_PLUGIN_ID);
  if (entries.length === 0) return { kind: 'missing' };
  const version = versionOfEntries(entries.flatMap((entry) => (entry === null ? [] : [entry])));
  return version === null ? { kind: 'unread', why: `${OMNI_PLUGIN_ID} has no version in claude plugin list` } : { kind: 'version', version };
}

// The kit's skills for Codex and OpenCode instances (PRD 2537, s5). Those agents do not read the
// Claude plugin; before a job on one, the runner writes the kit's skills, of the omni the job's
// repository pins, in the instance's own skills folder (`<CODEX_HOME>/skills/omni-*`, OpenCode's
// global `skills` folder). Never in the worktree: no skill file can enter the job's pull request. An
// instance whose agent reads no skills folder outside the repository, whose folder would lie in the
// worktree, or whose runner's omni is older than the repository's, is `unusable · no skills`.

/** What an account reads as unusable when its agent cannot get the kit's skills. */
const NO_SKILLS = 'no skills';

/** The marker a skills folder keeps: which `omni-*` folders the runner owns there, and the version they were written at. */
const SKILLS_MARKER = '.omni-runner-skills.json';

/** Where an instance lives: its agent, its own home folder (`null`: the agent's default under `home`). */
export type InstanceHome = { agent: string; dir: string | null; home: string };

/** The skills folder of an instance, `null` for an agent that reads none outside the repository. */
function instanceSkillsDir({ agent, dir, home }: InstanceHome): string | null {
  if (agent === 'codex') return join(dir ?? join(home, '.codex'), 'skills');
  if (agent === 'opencode') return join(dir ?? join(home, '.config', 'opencode'), 'skills');
  return null;
}

/** Whether `path` is `parent` or lies inside it. */
function inside(parent: string, path: string): boolean {
  const rel = relative(resolve(parent), resolve(path));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/** The kit's skill files as `{ <omni-name/file>: text }`; a `SKILL.md` carries the name `omni-<name>`. */
function renamedSkills(skills: Record<string, string>, version: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const [path, text] of Object.entries(skills)) {
    const [, name, rest] = /^([^/]+)\/(.+)$/.exec(path) ?? [];
    if (name === undefined || rest === undefined) continue;
    out.set(`omni-${name}/${rest}`, rest === 'SKILL.md' ? skillCopy(name, text, version) : text);
  }
  return out;
}

/** The `omni-*` folders the marker of `dir` names; none for a missing or unreadable marker. */
function ownedFolders(dir: string): string[] {
  try {
    const kept: unknown = JSON.parse(readFileSync(join(dir, SKILLS_MARKER), 'utf8'));
    const folders = propertyOf(kept, 'folders');
    return Array.isArray(folders) ? folders.filter((folder): folder is string => typeof folder === 'string' && /^omni-[A-Za-z0-9][A-Za-z0-9._-]*$/.test(folder)) : [];
  } catch {
    return [];
  }
}

/** Writes `text` at `file` whole: another job reading the folder never sees half a file. */
function writeWhole(file: string, text: string): void {
  mkdirSync(dirname(file), { recursive: true });
  const part = `${file}.${String(process.pid)}.part`;
  writeFileSync(part, text);
  renameSync(part, file);
}

/** The result of preparing an instance's skills: ready at `ready` (a version), or unusable with its reason. */
export type InstanceSkills = { readonly ready: string } | { readonly unusable: string };

/**
 * Writes the kit's skills in the instance's folder at the version `worktree` pins. `running` is the
 * runner's own kit, whose `skills` are written: as new as the repository's omni, or the account reads
 * `no skills`. Throws nothing; a folder that cannot be written is `no skills` too.
 */
export function prepareInstanceSkills({ instance, worktree, running, bundle, skills }: {
  instance: InstanceHome;
  worktree: string;
  running: { version: string | null };
  bundle: string | null;
  skills: Record<string, string>;
}): InstanceSkills {
  const dir = instanceSkillsDir(instance);
  if (dir === null || inside(worktree, dir)) return { unusable: NO_SKILLS };
  const pinned = pinnedOmni({ root: worktree, running, bundle });
  const version = running.version;
  if (pinned !== null && (version === null || compareVersions(version, pinned) < 0)) return { unusable: `${NO_SKILLS}: the runner's omni is older than the repository's v${pinned}` };
  const label = version ?? '(unversioned)';
  try {
    const files = renamedSkills(skills, label);
    const folders = new Set([...files.keys()].map((path) => path.slice(0, path.indexOf('/'))));
    for (const old of ownedFolders(dir)) if (!folders.has(old)) rmSync(join(dir, old), { recursive: true, force: true });
    for (const [path, text] of files) {
      const file = join(dir, path);
      if (!existsSync(file) || readFileSync(file, 'utf8') !== text) writeWhole(file, text);
    }
    writeWhole(join(dir, SKILLS_MARKER), `${JSON.stringify({ version: label, folders: [...folders].sort() }, null, 2)}\n`);
  } catch {
    return { unusable: NO_SKILLS };
  }
  return { ready: label };
}

/** What a job is told before it starts: the reason it fails, or the line its log starts with (`null` for none). */
export type JobPluginCheck = { readonly failed: string } | { readonly note: string | null };

/** The runner's care of the plugin: the check before each job, and the update its sweep runs. */
export type PluginKeeper = {
  /** The check for a job whose worktree is made: only the update it needs, one at a time. */
  forJob(worktree: string, repo: string): Promise<JobPluginCheck>;
  /** The sweep's update: at start, then every hour. */
  sweep(): Promise<void>;
};

/** A plugin that is old, at `version`, or what the job is told. */
type Standing = { readonly older: string } | JobPluginCheck;

/** Where the plugin stands against the pinned omni. */
function standing(read: PluginRead, pinned: string): Standing {
  if (read.kind === 'unread') return { note: `omni plugin version not read: ${read.why}` };
  if (read.kind === 'missing') return { failed: `the omni plugin is not installed: claude plugin install ${OMNI_PLUGIN_ID}` };
  return compareVersions(read.version, pinned) >= 0 ? { note: null } : { older: read.version };
}

/** The runner's plugin keeper: `running` is the runner's own kit, `bundle` its file, `print` its output. */
export function pluginKeeper({ exec, running, bundle, print }: { exec: ExecText; running: { version: string | null }; bundle: string | null; print: (line: string) => void }): PluginKeeper {
  let turn: Promise<unknown> = Promise.resolve();
  /** Runs `work` once every earlier one has ended. */
  const inTurn = <T>(work: () => T): Promise<T> => {
    const run = turn.then(work);
    turn = run.catch(() => undefined);
    return run;
  };

  /** Updates the plugin, tells what changed or failed, and answers what it read after and what the update said. */
  const update = (before: PluginRead): { after: PluginRead; said: string } => {
    const done = runPluginUpdate(exec);
    const after = readPlugin(exec);
    if (!done.updated) print(`omni plugin update failed: ${done.said}`);
    else if (before.kind === 'version' && after.kind === 'version' && before.version !== after.version) print(`omni plugin v${before.version} → v${after.version}`);
    return { after, said: done.said };
  };

  /** The update a job needs, in its turn: another slot may have made it while this one waited. */
  const updateFor = (pinned: string, repo: string): JobPluginCheck => {
    const again = readPlugin(exec);
    const before = standing(again, pinned);
    if (!('older' in before)) return before;
    const { after, said } = update(again);
    const now = standing(after, pinned);
    return 'older' in now ? { failed: `omni plugin v${now.older} is older than ${repo}'s omni v${pinned}: claude plugin update failed: ${said}` } : now;
  };

  return {
    forJob(worktree, repo) {
      const pinned = pinnedOmni({ root: worktree, running, bundle });
      if (pinned === null) return Promise.resolve({ note: null });
      const first = standing(readPlugin(exec), pinned);
      if (!('older' in first)) return Promise.resolve(first);
      return inTurn(() => updateFor(pinned, repo));
    },
    sweep() {
      return inTurn(() => {
        update(readPlugin(exec));
      });
    },
  };
}
