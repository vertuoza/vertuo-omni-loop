// Every git call of `omni status`'s overview, and nothing else: it reads the base — the default
// branch as last fetched — and the remote feature and phase-0 branches, who wrote which of their
// commits, the checkout's `user.email` and whether it is a shallow clone, and returns plain data for
// `overview.mjs`. It never reads the working tree, and it touches the network only when asked to
// fetch; the fetch is also the only thing it writes, and a failed one leaves the checkout's
// `FETCH_HEAD` as it found it.
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fillBranch } from '../board.ts';
import { parseFolderName } from '../layout.ts';
import { plainText } from '../outbox/plain-text.ts';
import type { Context, ExecText } from '../context.ts';
import type { PrdNumber } from '../ids.ts';

/** A PRD folder read at a commit: its number, its topic and its name. */
export type FactsFolder = { prd: PrdNumber; topic: string; name: string };

/** One PRD folder an author's commits touched. */
export type Touch = { prd: PrdNumber; email: string };

/** One commit of a log: the email it was authored with and the paths it changed. */
type Commit = { email: string; paths: string[] };

/** The base: the name it was read under and the commit it names. */
type Base = { name: string; commit: string };

/** Where a landing branch sits in its PRD's chain, read from its name (`branches.landing`). */
export type LandingName = { landing: number; landings: number; name: string };

/** A feature branch on the remote, as {@link readFacts} reads it: a landing's branch carries
 * `landing`. */
export type FeatureFacts = {
  branch: string;
  topic: string;
  landing?: LandingName;
  forked: string[];
  differs: string[];
  outbox: string[];
  ships: boolean;
  authors: string[];
  touched: Touch[];
};

/** A phase-0 branch on the remote, as {@link readFacts} reads it. */
export type Phase0Facts = { branch: string; topic: string; inbox: FactsFolder[]; touched: Touch[] };

/** What the overview needs, as {@link readFacts} returns it. */
export type Facts = {
  slug: string | null;
  base: string;
  fetchedAt: number | null;
  email: string | null;
  shallow: boolean;
  shipped: FactsFolder[];
  retro: number[];
  inbox: FactsFolder[];
  touched: Touch[];
  features: FeatureFacts[];
  phase0: Phase0Facts[];
};

/** `FETCH_HEAD` as it was before a fetch: its bytes and times, or `bytes: null` when it was absent. */
type Snapshot = { path: string; bytes: Buffer; atime: Date; mtime: Date } | { path: string; bytes: null };

/** The field `key` of a thrown value, or `undefined` when it has none. */
function fieldOf(error: unknown, key: string): unknown {
  return typeof error === 'object' && error !== null ? Reflect.get(error, key) : undefined;
}

function git(ctx: Context, exec: ExecText, args: readonly string[]): string {
  return exec('git', args, { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** Git's `-z` output, split into its entries. */
const entries = (output: string): string[] => output.split('\0').filter(Boolean);

/** The commit `ref` names, or `null` when it names none. */
function commitOf(ctx: Context, exec: ExecText, ref: string): string | null {
  try {
    return git(ctx, exec, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).trim() || null;
  } catch {
    return null;
  }
}

/** The names the base is read under: `<repo.remote>/<repo.defaultBranch>`, else the local branch. */
export function baseNames(ctx: Context): { remote: string; local: string } {
  const { remote, defaultBranch } = ctx.config.repo;
  return { remote: `${remote}/${defaultBranch}`, local: defaultBranch };
}

/** The base, `{ name, commit }`: the remote-tracking default branch as last fetched, else the local
 * default branch, else `null`. */
function readBase(ctx: Context, exec: ExecText): Base | null {
  const names = baseNames(ctx);
  const remote = commitOf(ctx, exec, `refs/remotes/${names.remote}`);
  if (remote) return { name: names.remote, commit: remote };
  const local = commitOf(ctx, exec, `refs/heads/${names.local}`);
  return local ? { name: names.local, commit: local } : null;
}

/** The file a retro PR adds to a shipped PRD's folder: a folder holding it is at retro (PRD 587). */
const RETRO_FILE = 'retro.md';

/** The PRD folders directly under `dir` at `ref`, as `{ prd, topic, name }`; none when `dir` is not
 * there. */
function foldersAt(ctx: Context, exec: ExecText, ref: string, dir: string): FactsFolder[] {
  return entries(git(ctx, exec, ['ls-tree', '-z', '-d', '--name-only', ref, '--', `${dir}/`]))
    .map((path) => {
      const name = path.slice(path.lastIndexOf('/') + 1);
      const folder = parseFolderName(name);
      return folder && { ...folder, name };
    })
    .filter((folder): folder is FactsFolder => Boolean(folder));
}

/** The PRD numbers whose folder directly under `dir` at `ref` holds `RETRO_FILE`. */
function retroAt(ctx: Context, exec: ExecText, ref: string, dir: string): number[] {
  const out = new Set<number>();
  for (const path of entries(git(ctx, exec, ['ls-tree', '-r', '-z', '--name-only', ref, '--', `${dir}/`]))) {
    const parts = path.slice(dir.length + 1).split('/');
    const folder = parts.length === 2 && parts[1] === RETRO_FILE ? parseFolderName(parts[0] ?? '') : null;
    if (folder) out.add(folder.prd);
  }
  return [...out];
}

/** A path `git rev-parse <args>` prints, made absolute, or `null` when git cannot say. */
function gitPath(ctx: Context, exec: ExecText, args: readonly string[]): string | null {
  try {
    return resolve(ctx.root, git(ctx, exec, ['rev-parse', ...args]).trim());
  } catch {
    return null;
  }
}

/** Where this checkout keeps its `FETCH_HEAD`: a linked worktree keeps its own. */
const fetchHeadPath = (ctx: Context, exec: ExecText): string | null => gitPath(ctx, exec, ['--git-path', 'FETCH_HEAD']);

/** When the `FETCH_HEAD` at `path` says a fetch happened, in ms, or `null`. A failed fetch leaves
 * git's `FETCH_HEAD` empty, stamped with the failure's time, so an empty one tells no fetch time. */
function fetchTime(path: string | null): number | null {
  if (path === null) return null;
  try {
    const stat = statSync(path);
    return stat.size > 0 ? stat.mtimeMs : null;
  } catch {
    return null;
  }
}

/** When the remote branches were last fetched, in ms, or `null` when they never were: the newer of
 * this checkout's `FETCH_HEAD` and the one in the repository's common git folder. Git keeps a
 * `FETCH_HEAD` per worktree but shares the remote branches between them all, so a linked worktree
 * also reads a fetch run in the main checkout. */
function fetchedAt(ctx: Context, exec: ExecText): number | null {
  const common = gitPath(ctx, exec, ['--git-common-dir']);
  const times = [fetchHeadPath(ctx, exec), common && resolve(common, 'FETCH_HEAD')]
    .map(fetchTime)
    .filter((time): time is number => time !== null);
  return times.length ? Math.max(...times) : null;
}

/** `FETCH_HEAD` as it is now, to put back after a failed fetch: its bytes and times, or absent. */
function snapshot(path: string | null): Snapshot | null {
  if (path === null) return null;
  try {
    const stat = statSync(path);
    return { path, bytes: readFileSync(path), atime: stat.atime, mtime: stat.mtime };
  } catch {
    return { path, bytes: null };
  }
}

function putBack(saved: Snapshot | null): void {
  if (saved === null) return;
  try {
    if (saved.bytes === null) {
      rmSync(saved.path, { force: true });
    } else {
      writeFileSync(saved.path, saved.bytes);
      utimesSync(saved.path, saved.atime, saved.mtime);
    }
  } catch {
    // The header then reads the failed fetch's empty FETCH_HEAD, which tells no fetch time.
  }
}

/**
 * `git fetch --prune <repo.remote>`. Returns `null` when it worked, else the first line git gave
 * for its failure. A failed fetch puts `FETCH_HEAD` back as it found it, so the header still says
 * when the last fetch that worked happened.
 */
export function fetchRemote({ ctx, exec = execFileSync }: { ctx: Context; exec?: ExecText }): string | null {
  const saved = snapshot(fetchHeadPath(ctx, exec));
  try {
    git(ctx, exec, ['fetch', '--prune', ctx.config.repo.remote]);
    return null;
  } catch (error) {
    putBack(saved);
    const said = plainText(fieldOf(error, 'stderr')).split('\n').map((line) => line.trim()).find(Boolean);
    const message: unknown = fieldOf(error, 'message') ?? error;
    return said ?? String(message).split('\n')[0] ?? '';
  }
}

/** The remote branches, each name under `<repo.remote>/` mapped to its full ref. */
function remoteBranches(ctx: Context, exec: ExecText): Map<string, string> {
  const prefix = `refs/remotes/${ctx.config.repo.remote}/`;
  const refs = git(ctx, exec, ['for-each-ref', '--format=%(refname)', prefix]).split('\n').filter(Boolean);
  return new Map(refs.map((ref) => [ref.slice(prefix.length), ref]));
}

/** The `{topic}` that `template` was filled with to name `branch`, or `null` when it does not
 * match. */
function topicOf(branch: string, template: string): string | null {
  if (!template.includes('{topic}')) return null;
  // A template holding `{topic}` splits into at least a head and a tail.
  const [head = '', tail = ''] = template.split('{topic}');
  if (branch.length <= head.length + tail.length || !branch.startsWith(head) || !branch.endsWith(tail)) return null;
  return branch.slice(head.length, branch.length - tail.length);
}

/** The paths outside the delivery folder that `git diff --name-only <range>` lists. */
function changedOutside(ctx: Context, exec: ExecText, range: readonly string[]): string[] {
  const delivery = `${ctx.config.paths.delivery}/`;
  return entries(git(ctx, exec, ['diff', '--name-only', '-z', '--no-renames', '--no-ext-diff', ...range, '--']))
    .filter((path) => !path.startsWith(delivery));
}

/** Every file under `dir` at `ref`, named relative to `dir`. */
function filesUnder(ctx: Context, exec: ExecText, ref: string, dir: string): string[] {
  return entries(git(ctx, exec, ['ls-tree', '-r', '-z', '--name-only', ref, '--', `${dir}/`]))
    .map((path) => path.slice(dir.length + 1));
}

/** What `git config user.email` gives in this checkout, or `null` when it gives nothing. */
function userEmail(ctx: Context, exec: ExecText): string | null {
  try {
    return git(ctx, exec, ['config', 'user.email']).trim() || null;
  } catch {
    return null;
  }
}

/** Whether this checkout is a shallow clone, whose history stops short of who wrote what. */
function isShallow(ctx: Context, exec: ExecText): boolean {
  try {
    return git(ctx, exec, ['rev-parse', '--is-shallow-repository']).trim() === 'true';
  } catch {
    return false;
  }
}

/** What starts each commit in `commitsIn`'s log: a byte no email holds. */
const COMMIT_MARK = '\x01';

/** The commits `git log <range> -- <paths>` lists, each as `{ email, paths }`: the email it was
 * authored with and the paths it changed. Every commit is listed, even one whose change the history
 * later undid; a merge lists no path. */
function commitsIn(ctx: Context, exec: ExecText, range: string, paths: readonly string[] = []): Commit[] {
  const log = git(ctx, exec, ['log', '-z', '--name-only', '--no-renames', '--full-history', '--format=%x01%ae', range, '--', ...paths]);
  return log.split(COMMIT_MARK).filter(Boolean).map((commit) => {
    // A non-empty entry always has a first field, the email.
    const [email = '', ...changed] = commit.split('\0');
    return { email, paths: changed.map((path) => path.replace(/^\n/, '')).filter(Boolean) };
  });
}

/** Each author's email once. */
const authorsOf = (commits: readonly Commit[]): string[] => [...new Set(commits.map(({ email }) => email))];

/** The PRD folders `commits` touched under the delivery folder (`<paths.delivery>/<stage>/<prd>-<topic>/…`),
 * as `{ prd, email }`, each pair once. */
function touchedBy(ctx: Context, commits: readonly Commit[]): Touch[] {
  const delivery = `${ctx.config.paths.delivery}/`;
  const seen = new Map<string, Touch>();
  for (const { email, paths } of commits) {
    for (const path of paths) {
      if (!path.startsWith(delivery)) continue;
      const parts = path.slice(delivery.length).split('/');
      const folder = parts.length > 2 ? parseFolderName(parts[1] ?? '') : null;
      if (folder) seen.set(`${folder.prd}\0${email}`, { prd: folder.prd, email });
    }
  }
  return [...seen.values()];
}

/** What `read` returns, or `null` when it throws: a branch that cannot be read is skipped, and the
 * overview never fails because of one. */
function unlessUnreadable<T>(read: () => T): T | null {
  try {
    return read();
  } catch {
    return null;
  }
}

/**
 * The feature branch (`branches.feature` with the folder's topic), and each landing branch
 * (`branches.landing` with that topic, carrying `landing`), of each PRD in the base's inbox that has
 * one on the remote, as `{ branch, topic, forked, differs, outbox, ships, authors,
 * touched }`: `forked` holds the paths outside the delivery folder it changed since it forked from
 * the base, `differs` those that differ from the base now, `outbox` every file under the PRD's
 * outbox folder on it, `ships` whether its shipped folder holds the PRD (the green gate's
 * `omni ship`, done before the feature PR is marked ready), `authors` the emails of its commits
 * beyond the base, and `touched` the PRD folders those commits touched.
 */
function featuresOf(ctx: Context, exec: ExecText, base: string, inbox: readonly FactsFolder[], remote: Map<string, string>): FeatureFacts[] {
  const out: FeatureFacts[] = [];
  for (const { prd, topic, name } of inbox) {
    const feature = fillBranch(ctx.config.branches.feature, { topic });
    const branches: { branch: string; landing?: LandingName }[] = [{ branch: feature }];
    for (const branch of remote.keys()) {
      const landing = landingOf(branch, ctx.config.branches.landing, topic);
      if (landing && branch !== feature) branches.push({ branch, landing });
    }
    for (const { branch, landing } of branches) {
      const ref = remote.get(branch);
      if (!ref) continue;
      const facts = unlessUnreadable(() => {
        const beyond = commitsIn(ctx, exec, `${base}..${ref}`);
        return {
          branch,
          topic,
          ...(landing ? { landing } : {}),
          forked: changedOutside(ctx, exec, [`${base}...${ref}`]),
          differs: changedOutside(ctx, exec, [base, ref]),
          outbox: filesUnder(ctx, exec, ref, `${ctx.layout.dirs.outbox}/${name}`),
          ships: foldersAt(ctx, exec, ref, ctx.layout.dirs.shipped).some((folder) => folder.prd === prd),
          authors: authorsOf(beyond),
          touched: touchedBy(ctx, beyond),
        };
      });
      if (facts) out.push(facts);
    }
  }
  return out;
}

/** `text` as a regular expression matching only itself. */
const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Where `branch` sits in the landing chain of `topic`, when `template` (`branches.landing`) with
 * that topic names it: `{topic}` the topic, `{landing}` and `{landings}` numbers, `{name}` one
 * kebab-case name. `null` otherwise. */
function landingOf(branch: string, template: string, topic: string): LandingName | null {
  const keys: string[] = [];
  const source = template
    .split(/(\{(?:topic|landings|landing|name)\})/)
    .map((part) => {
      if (part === '{topic}') return escaped(topic);
      if (part === '{landing}' || part === '{landings}' || part === '{name}') {
        keys.push(part);
        return part === '{name}' ? '([a-z0-9]+(?:-[a-z0-9]+)*)' : '(\\d+)';
      }
      return escaped(part);
    })
    .join('');
  const match = new RegExp(`^${source}$`).exec(branch);
  if (!match) return null;
  const value = (key: string): string | undefined => match[keys.indexOf(key) + 1];
  const landing = Number(value('{landing}'));
  const landings = Number(value('{landings}'));
  if (!Number.isInteger(landing) || !Number.isInteger(landings) || landing < 1 || landing > landings) return null;
  return { landing, landings, name: value('{name}') ?? `landing-${landing}` };
}

/** Every remote branch shaped like `branches.phase0`, with its topic, the PRD folders in its inbox
 * and those its commits beyond the base touched, as `{ branch, topic, inbox, touched }`. */
function phase0Of(ctx: Context, exec: ExecText, base: string, remote: Map<string, string>): Phase0Facts[] {
  const out: Phase0Facts[] = [];
  for (const [branch, ref] of remote) {
    const topic = topicOf(branch, ctx.config.branches.phase0);
    if (!topic) continue;
    const phase0 = unlessUnreadable(() => ({
      branch,
      topic,
      inbox: foldersAt(ctx, exec, ref, ctx.layout.dirs.inbox),
      touched: touchedBy(ctx, commitsIn(ctx, exec, `${base}..${ref}`, [`${ctx.config.paths.delivery}/`])),
    }));
    if (phase0) out.push(phase0);
  }
  return out;
}

/**
 * What the overview needs: `{ slug, base, fetchedAt, email, shallow, shipped, retro, inbox, touched,
 * features, phase0 }` — `base` the name the base was read under, `email` what `user.email` gives
 * (or `null`), `shallow` whether the clone is, `shipped` and `inbox` the base's PRD folders, `retro`
 * the numbers of the shipped ones holding `RETRO_FILE`,
 * `touched` the PRD folders each author's commits on the base touched, `features` the feature
 * branches of its inbox's PRDs and `phase0` the phase-0 branches, both read on `<repo.remote>`.
 * `null` when neither the remote-tracking default branch nor the local one exists.
 */
export function readFacts({ ctx, exec = execFileSync }: { ctx: Context; exec?: ExecText }): Facts | null {
  const base = readBase(ctx, exec);
  if (!base) return null;
  const { dirs } = ctx.layout;
  const inbox = foldersAt(ctx, exec, base.commit, dirs.inbox);
  const remote = remoteBranches(ctx, exec);
  return {
    slug: ctx.config.repo.slug,
    base: base.name,
    fetchedAt: fetchedAt(ctx, exec),
    email: userEmail(ctx, exec),
    shallow: isShallow(ctx, exec),
    shipped: foldersAt(ctx, exec, base.commit, dirs.shipped),
    retro: retroAt(ctx, exec, base.commit, dirs.shipped),
    inbox,
    touched: touchedBy(ctx, commitsIn(ctx, exec, base.commit, [`${ctx.config.paths.delivery}/`])),
    features: featuresOf(ctx, exec, base.commit, inbox, remote),
    phase0: phase0Of(ctx, exec, base.commit, remote),
  };
}
