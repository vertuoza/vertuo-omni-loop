// The install pull request `omni init` opens (PRD 420): it switches to `chore/install-omni-loop`
// before writing anything, then commits only the paths it wrote, pushes that branch and opens (or
// finds) its pull request into the default branch. Nothing here throws: a step git or gh cannot do
// is reported, every step after it is skipped, and `installLines` prints the exact commands left to
// type. Nothing is ever committed on another branch, and nothing but the install branch is pushed.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ExecText } from '../context.ts';
import { GhPullRequestsSchema } from './schema.ts';

const QUIET: ExecFileSyncOptionsWithStringEncoding = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };

/** What `switchToInstallBranch` did. */
export type BranchStep = { outcome: 'created' | 'switched' | 'stayed' | 'failed'; branch: string };

/** The install pull request, found open or just opened. */
export type InstallPr = { url: string; number: number | null; already: boolean };

/** What `openInstallPr` did, step by step. */
export type InstallResult = {
  branch: BranchStep;
  commit: 'committed' | 'nothing' | 'failed' | 'skipped';
  push: 'pushed' | 'failed' | null;
  pr: InstallPr | null;
};

type Attempt<T> = { ok: true; value: T } | { ok: false; value: null };

/** Fixed, not a config key: init runs before any config exists. */
export const INSTALL_BRANCH = 'chore/install-omni-loop';
export const INSTALL_COMMIT = 'chore: install the Omni Loop';
const PR_BODY = [
  'Installs the Omni Loop, as written by `omni init`: its config and pinned bin in `.omni-loop/`,',
  'the blank knowledge forms, and the status line in `.claude/settings.json`.',
].join('\n');
const GITHUB = 'https://github.com';

function attempt<T>(fn: () => T): Attempt<T> {
  try {
    return { ok: true, value: fn() };
  } catch {
    return { ok: false, value: null };
  }
}

function currentBranch(root: string, exec: ExecText): string | null {
  const { value } = attempt(() => exec('git', ['branch', '--show-current'], { cwd: root, ...QUIET }));
  return typeof value === 'string' ? value.trim() : null;
}

/**
 * Puts the repository at `root` on the install branch: stays when already on it, switches to it when
 * a previous run left it, creates it from HEAD otherwise.
 */
export function switchToInstallBranch(root: string, { exec }: { exec: ExecText }): BranchStep {
  const branch = INSTALL_BRANCH;
  if (currentBranch(root, exec) === branch) return { outcome: 'stayed', branch };
  const exists = attempt(() => exec('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: root, ...QUIET })).ok;
  const args = exists ? ['switch', branch] : ['switch', '-c', branch];
  if (!attempt(() => exec('git', args, { cwd: root, ...QUIET })).ok) return { outcome: 'failed', branch };
  return { outcome: exists ? 'switched' : 'created', branch };
}

/** The open pull request whose head is the install branch, `null` when there is none, `undefined` when gh cannot say. */
function findPr(root: string, exec: ExecText): InstallPr | null | undefined {
  const listed = attempt(() => GhPullRequestsSchema.parse(JSON.parse(exec('gh', ['pr', 'list', '--head', INSTALL_BRANCH, '--state', 'open', '--json', 'url,number'], { cwd: root, ...QUIET }))));
  if (!listed.ok) return undefined;
  const [pr] = listed.value;
  return pr?.url ? { url: pr.url, number: Number(pr.number) || null, already: true } : null;
}

const prNumber = (url: string): number | null => Number(/\/pull\/(\d+)/.exec(url)?.[1]) || null;

/**
 * Commits `paths` on the install branch, pushes it to `remote` and opens its pull request into `base`.
 * `paths` are the paths init wrote: nothing else is staged or committed. `base` is the default
 * branch the pull request targets; `branch` is what switchToInstallBranch did, when it ran.
 */
export function openInstallPr(
  root: string,
  { exec, paths: wanted, remote, base, branch }: { exec: ExecText; paths: string[]; remote: string; base: string; branch?: BranchStep },
): InstallResult {
  // A path that is not there (no settings file, say) would make git refuse the whole commit.
  const paths = wanted.filter((path) => existsSync(join(root, path)));
  const on = currentBranch(root, exec) === INSTALL_BRANCH;
  const result: InstallResult = {
    branch: branch ?? { outcome: on ? 'stayed' : 'failed', branch: INSTALL_BRANCH },
    commit: 'skipped',
    push: null,
    pr: null,
  };
  if (!on) {
    result.branch = { ...result.branch, outcome: 'failed' };
    return result;
  }

  const changed = attempt(() => exec('git', ['status', '--porcelain', '--untracked-files=all', '--', ...paths], { cwd: root, ...QUIET }));
  if (changed.ok && !changed.value.trim()) {
    result.commit = 'nothing';
  } else {
    const committed = attempt(() => {
      exec('git', ['add', '--', ...paths], { cwd: root, ...QUIET });
      // A pathspec commits those paths only: whatever else the person staged stays staged.
      return exec('git', ['commit', '-q', '-m', INSTALL_COMMIT, '--', ...paths], { cwd: root, ...QUIET });
    });
    result.commit = committed.ok ? 'committed' : 'failed';
    if (!committed.ok) return result;
  }

  result.push = attempt(() => exec('git', ['push', '-u', remote, INSTALL_BRANCH], { cwd: root, ...QUIET })).ok ? 'pushed' : 'failed';
  if (result.push === 'failed') return result;

  const found = findPr(root, exec);
  if (found) {
    result.pr = found;
    return result;
  }
  if (found === undefined) return result;
  const created = attempt(() => exec('gh', ['pr', 'create', '--base', base, '--head', INSTALL_BRANCH, '--title', INSTALL_COMMIT, '--body', PR_BODY], { cwd: root, ...QUIET }));
  const url = created.ok ? created.value.trim().split('\n').pop() : null;
  if (url?.startsWith('http')) result.pr = { url, number: prNumber(url), already: false };
  else result.pr = findPr(root, exec) ?? null;
  return result;
}

const BRANCH_LINE: Record<Exclude<BranchStep['outcome'], 'failed'>, (b: string) => string> = {
  created: (b) => `  branch  created ${b}`,
  switched: (b) => `  branch  switched to ${b}`,
  stayed: (b) => `  branch  on ${b} already`,
};

/**
 * The status lines of the install pull request, then — for every step not done — the exact commands
 * to type, in order.
 */
export function installLines(
  { branch, commit, push, pr }: InstallResult,
  { paths, remote, base, slug }: { paths: string[]; remote: string; base: string; slug: string | null },
): string[] {
  const lines: string[] = [];
  const todo: string[] = [];
  const b = INSTALL_BRANCH;
  const ghLine = `gh pr create --base ${base} --head ${b} --title "${INSTALL_COMMIT}" --fill`;
  const prTodo = () => {
    todo.push(ghLine);
    if (slug) todo.push(`or open ${GITHUB}/${slug}/compare/${base}...${b}?expand=1`);
  };

  if (branch.outcome === 'failed') {
    lines.push(`  branch  could not switch to ${b}`);
    todo.push(`git switch -c ${b}`);
  } else {
    lines.push(BRANCH_LINE[branch.outcome](b));
  }
  if (commit === 'committed') lines.push(`  commit  ${INSTALL_COMMIT}`);
  if (commit === 'nothing') lines.push(`  commit  nothing new to commit, already committed`);
  if (commit === 'failed') lines.push('  commit  git refused the commit');
  if (commit === 'failed' || commit === 'skipped') {
    todo.push(`git add -- ${paths.join(' ')}`, `git commit -m "${INSTALL_COMMIT}" -- ${paths.join(' ')}`);
  }
  if (push === 'pushed') lines.push(`  pushed  ${b} to ${remote}`);
  if (push === 'failed') lines.push(`  push    ${remote} refused the push`);
  if (push !== 'pushed') {
    todo.push(`git push -u ${remote} ${b}`);
    prTodo();
  } else if (pr) {
    lines.push(pr.already ? `  PR      already open: ${pr.url}` : `  PR      opened ${pr.url}`);
  } else {
    lines.push('  PR      gh could not open the pull request');
    prTodo();
  }
  if (todo.length) lines.push('', 'Type these to finish the install pull request:', ...todo.map((line) => `     ${line}`));
  return lines;
}
