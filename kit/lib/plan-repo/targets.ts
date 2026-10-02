// A plan repository's targets, as `omni targets` reports them (PRD 522, s1). Each target of the
// config's `plan.targets` is read through `gh api` only, never cloned, and gets one row:
// `{ repo, role, knowledge, loop, state, detail }`.
//
// - `loop`: the kit version the target's default branch runs (the marker its `.omni-loop/bin/omni.mjs`
//   carries, as `omni update` reads it), `installed` when that cannot be read, `not installed` when
//   the target has no `.omni-loop/config.yml`, `—` when the repository cannot be read at all.
// - `state`, the worst that applies: `unreachable` (gh cannot read it), `drifted` (the config says
//   own and the target lacks the loop or a filled form; it says imported or none and the target has
//   both), `stale` (imported only: the default branch moved past `readAt` and changed at least one
//   evidence file of the copy), else `ok`. `detail` says why, and is `null` for `ok`.
//
// "A filled form" is a Markdown file under the target's `paths.playbook` (read from its own config,
// the kit's default layout when unset) whose front matter says `state: filled` (playbook/filled.ts).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { z } from 'zod';
import type { Context, ExecRaw } from '../context.ts';
import { isFilled, playbookOf } from '../playbook/filled.ts';
import { at, defined, propertyOf, textOf } from '../narrow.ts';
import { parseForm } from '../playbook/forms.ts';
import { bundleVersion } from '../update/installed.ts';
import { firstIssue, GhCompareSchema, GhContentEntrySchema, GhRepositorySchema } from './gh-schema.ts';
import type { GhCompare, GhContentEntry, GhRepository } from './gh-schema.ts';

/** One target of a config's `plan.targets`, as the reader needs it. */
export type Target = { repo: string; role: string; knowledge: string; readAt?: string | null };

/** The kinds of row a target can read as. */
export type TargetState = 'ok' | 'drifted' | 'stale' | 'unreachable';

/** One target's row, as `omni targets` prints it. */
export type TargetRow = {
  repo: string;
  role: string;
  knowledge: string;
  loop: string;
  state: TargetState;
  detail: string | null;
};

/** The `gh api` readings one target needs (`ghReader`). */
export type GhReader = {
  repository(repo: string): GhRepository;
  file(repo: string, path: string, ref: string): string | null;
  dir(repo: string, path: string, ref: string): GhContentEntry[] | null;
  compare(repo: string, base: string, head: string): GhCompare | null;
};

/** What a failed `gh` call carries: its stderr, when it ran. */
/** What `gh` said, as whatever it threw carries it: its stderr, then its message. */
const ghText = (error: unknown): string => `${textOf(propertyOf(error, 'stderr'))}\n${textOf(propertyOf(error, 'message'))}`;

const CONFIG_PATH = '.omni-loop/config.yml';
const BIN_PATH = '.omni-loop/bin/omni.mjs';

/** The error `gh` raised, as its one telling line. */
function ghLine(error: unknown): string {
  const text = ghText(error);
  const line = text.split('\n').map((l) => l.trim()).find((l) => l.startsWith('gh:')) ?? text.split('\n').map((l) => l.trim()).find(Boolean);
  return line ?? 'gh could not read it';
}

const isNotFound = (error: unknown): boolean => /HTTP 404/.test(ghText(error));

export class Unreachable extends Error {}

/** The `gh api` readings one target needs. A missing file or directory is `null`; any other failure throws
 * `Unreachable`. Shared with `omni plan moved` (`./moved.ts`). */
export function ghReader({ exec, env }: { exec: ExecRaw; env?: NodeJS.ProcessEnv | undefined }): GhReader {
  const api = (args: string[]): string => String(exec('gh', ['api', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...(env ? { env } : {}) }));
  const call = (args: string[]): string | null => {
    try {
      return api(args);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw new Unreachable(ghLine(error));
    }
  };
  const contents = (repo: string, path: string, ref: string): string => `repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`;
  return {
    // The repository itself: any failure, a 404 included, means gh cannot read it.
    repository(repo) {
      let answer: unknown;
      try {
        answer = JSON.parse(api([`repos/${repo}`]));
      } catch (error) {
        throw new Unreachable(ghLine(error));
      }
      return answerOf(GhRepositorySchema, answer, `repos/${repo}`);
    },
    file: (repo, path, ref) => call(['-H', 'Accept: application/vnd.github.raw', contents(repo, path, ref)]),
    dir(repo, path, ref) {
      const out = call([contents(repo, path, ref)]);
      if (out === null) return null;
      const listed: unknown = JSON.parse(out);
      return Array.isArray(listed) ? answerOf(GhContentEntrySchema.array(), listed, `${repo}:${path}`) : null;
    },
    compare(repo, base, head) {
      const out = call([`repos/${repo}/compare/${base}...${encodeURIComponent(head)}`]);
      return out === null ? null : answerOf(GhCompareSchema, JSON.parse(out), `${repo} compare ${base}...${head}`);
    },
  };
}

/** A `gh api` answer read through its schema: one it refuses makes the target unreachable, naming the field. */
function answerOf<S extends z.ZodType>(schema: S, answer: unknown, what: string): z.infer<S> {
  const parsed = schema.safeParse(answer);
  if (!parsed.success) throw new Unreachable(`gh answered ${what} without what it needs — ${firstIssue(parsed.error)}`);
  return parsed.data;
}

function hasFilledForm(gh: GhReader, repo: string, playbook: string, ref: string): boolean {
  const listed = gh.dir(repo, playbook, ref) ?? [];
  return listed
    .filter((entry) => entry.type === 'file' && entry.name.endsWith('.md'))
    .some((entry) => isFilled(gh.file(repo, entry.path, ref)));
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

function staleness(gh: GhReader, { repo, readAt }: { repo: string; readAt: string }, branch: string, evidence: ReadonlySet<string>): string | null {
  const compared = gh.compare(repo, readAt, branch);
  if (compared === null) return `readAt ${readAt.slice(0, 7)} cannot be compared with the default branch`;
  const ahead = compared.ahead_by ?? 0;
  if (ahead === 0) return null;
  const touched = new Set((compared.files ?? []).flatMap((f) => [f.filename, f.previous_filename].filter(Boolean)));
  const changed = [...evidence].filter((path) => touched.has(path)).length;
  if (changed === 0) return null;
  return `${plural(ahead, 'commit', 'commits')}, ${plural(changed, 'evidence file', 'evidence files')} changed`;
}

/**
 * One target's row. `evidence` is the set of target paths the imported copy was drawn from (empty
 * for any other target). Never throws for what GitHub answers: a repository it cannot read is a row.
 */
export function readTarget(
  target: Target,
  {
    exec = execFileSync,
    env,
    evidence = new Set(),
  }: { exec?: ExecRaw; env?: NodeJS.ProcessEnv | undefined; evidence?: ReadonlySet<string> } = {},
): TargetRow {
  const { repo, role, knowledge } = target;
  const row = (loop: string, state: TargetState, detail: string | null = null): TargetRow => ({ repo, role, knowledge, loop, state, detail });
  const gh = ghReader({ exec, env });
  try {
    const branch = gh.repository(repo).default_branch;
    const config = gh.file(repo, CONFIG_PATH, branch);
    const installed = config !== null;
    const version = installed ? bundleVersion(gh.file(repo, BIN_PATH, branch) ?? '') : null;
    const loop = installed ? (version ? `v${version}` : 'installed') : 'not installed';
    const filled = installed && hasFilledForm(gh, repo, playbookOf(config), branch);

    if (knowledge === 'own') {
      if (!installed) return row(loop, 'drifted', 'the config says own, but the loop is not installed');
      if (!filled) return row(loop, 'drifted', 'the config says own, but no form is filled');
      return row(loop, 'ok');
    }
    if (installed && filled) return row(loop, 'drifted', `the config says ${knowledge}, but it has the loop and a filled form`);
    if (knowledge === 'imported') {
      const stale = staleness(gh, { repo, readAt: defined(target.readAt, `the readAt of ${repo}`) }, branch, evidence); // an imported target always has a readAt (the config refuses one without)
      if (stale) return row(loop, 'stale', stale);
    }
    return row(loop, 'ok');
  } catch (error) {
    if (error instanceof Unreachable) return row('—', 'unreachable', error.message);
    throw error;
  }
}

/** The folder holding a target's imported copy: `<paths.knowledge>/repos/<name>`. */
export function copyFolder(repo: string, { ctx }: { ctx: { config: { paths: { knowledge: string } } } }): string {
  return join(ctx.config.paths.knowledge, 'repos', at(repo.split('/'), 1, `the name of ${repo}`)); // a target's repo is an owner/name slug (the config checks it)
}

/** Every target path the evidence of a copy's forms names; empty when the target has no copy. */
export function copyEvidence(repo: string, { ctx }: { ctx: Pick<Context, 'root' | 'config'> }): Set<string> {
  const dir = join(ctx.root, copyFolder(repo, { ctx }), 'playbook');
  const paths = new Set<string>();
  if (!existsSync(dir)) return paths;
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.md')).sort()) {
    const parsed = parseForm(readFileSync(join(dir, name), 'utf8'), { file: name });
    if (!parsed.ok) continue;
    for (const { path } of parsed.form.evidence) paths.add(path);
  }
  return paths;
}

/** Every target's row, in config order. */
export function readTargets(
  targets: readonly Target[],
  { ctx, exec = execFileSync, env }: { ctx: Pick<Context, 'root' | 'config'>; exec?: ExecRaw; env?: NodeJS.ProcessEnv | undefined },
): TargetRow[] {
  return targets.map((target) =>
    readTarget(target, { exec, env, evidence: target.knowledge === 'imported' ? copyEvidence(target.repo, { ctx }) : new Set() }),
  );
}

const COLUMNS = ['repo', 'role', 'knowledge', 'loop', 'state'];

/** The rows as the lines of a table, a header first; a state that is not ok carries its detail. */
export function targetsTable(rows: readonly TargetRow[]): string[] {
  const cells: string[][] = [COLUMNS, ...rows.map((r) => [r.repo, r.role, r.knowledge, r.loop, r.detail ? `${r.state} (${r.detail})` : r.state])];
  const widths = COLUMNS.map((_, i) => Math.max(...cells.map((line) => (line[i] ?? '').length)));
  return cells.map((line) => line.map((cell, i) => (i === line.length - 1 ? cell : cell.padEnd(widths[i] ?? 0))).join('  '));
}
