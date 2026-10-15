// The kit check's facts (PRD 1990, spec section 5): the repository's kit, the two plugins and the
// target repositories' kits, each against the kit home's latest release.
//
// - The latest release is asked as `omni version` asks it (5 s). Without it, the versions are still
//   read and the comparison is left not checked.
// - The repository's kit is the version its `.omni-loop/bin/omni.mjs` carries, or the running kit's
//   when the bin carries none (a shim, as in the kit's own repository).
// - The plugins are the two entries of `claude plugin list` (`./setup.ts` reads it once); with no
//   `claude` command this part does not run. An installed plugin whose list gives no version is
//   left out: it is neither behind nor missing.
// - Each target repository (a plan repository's `plan.targets`, else the product's other repositories
//   in the product targets cache) has its bin's `sha` read through `gh api` (5 s); the raw file is
//   read only when the `sha` differs from the one cached beside its version in
//   `.omni-loop/local/sync-targets.json`.
//
// Nothing here throws: what could not be read is a fact `{ notChecked: <why> }`.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { ensureLocalDir } from '../ask/local-state.ts';
import type { ExecText } from '../context.ts';
import { processUnderTest } from '../env/read.ts';
import { runningBundle, runningKit } from '../init/bundle.ts';
import type { RunningKit } from '../init/bundle.ts';
import { messageOf, propertyOf } from '../narrow.ts';
import { PRODUCT_TARGETS_FILE } from '../product/targets.ts';
import { writeJsonAt } from '../statusline/board-cache.ts';
import { BIN_FILE } from '../update/apply.ts';
import { bundleVersion, installedVersion } from '../update/installed.ts';
import { latestRelease } from '../version/version.ts';
import { NOT_CHECKED_YET } from './facts.ts';
import type { Fact, Gatherer, GatherIo, KitFacts, PluginFact, TargetKitFact, Unchecked } from './facts.ts';
import { claudePlugins, HUD_PLUGIN_ID, OMNI_PLUGIN_ID } from './setup.ts';

/** How long one GitHub call may take. */
const GH_BUDGET_MS = 5_000;

/** The largest bin `gh api` may hand back: the bundle is a few megabytes. */
const BIN_MAX_BYTES = 64 * 1024 * 1024;

/** Where the targets' kit versions are kept, beside the other local files. */
export const TARGET_KITS_FILE = join('.omni-loop', 'local', 'sync-targets.json');

const TargetKitsSchema = z.record(z.string(), z.object({ sha: z.string(), version: z.string().nullable() }));
type TargetKits = z.infer<typeof TargetKitsSchema>;

const ProductTargetsCopySchema = z.looseObject({ targets: z.array(z.looseObject({ repo: z.string() })) });

/** The settings a run of this check may be handed besides the gather: tests hand their own. */
export type KitIo = { readonly running?: RunningKit; readonly bundle?: string | null };

/** Why a process failed, in a few words. */
function whyFailed(error: unknown, command: string): string {
  const code = propertyOf(error, 'code');
  if (code === 'ENOENT') return `no ${command}`;
  if (code === 'ETIMEDOUT') return 'timed out';
  const stderr = propertyOf(error, 'stderr');
  if (typeof stderr === 'string' && /auth login|not logged in|authentication/i.test(stderr)) return `no ${command} sign-in`;
  return 'offline';
}

/** Whether a failed `gh api` call said the file is not there. */
function notFound(error: unknown): boolean {
  const stderr = propertyOf(error, 'stderr');
  const text = `${typeof stderr === 'string' ? stderr : ''} ${messageOf(error)}`;
  return /\b404\b|not found/i.test(text);
}

/** The latest release of the kit's home, or why it was not read. */
function latestOf(exec: ExecText, home: string | null): Fact<string> {
  if (home === null) return { notChecked: 'no kit home' };
  let failure: unknown;
  const watched: ExecText = (file, args, options) => {
    try {
      return exec(file, args, options);
    } catch (error) {
      failure = error;
      throw error;
    }
  };
  const latest = latestRelease({ home, exec: watched, timeoutMs: GH_BUDGET_MS });
  if (latest !== null) return latest;
  return { notChecked: failure === undefined ? 'no release' : whyFailed(failure, 'gh') };
}

/** The two plugins of `claude plugin list`; `null` without a `claude` command. */
function pluginsOf(io: GatherIo): Fact<readonly PluginFact[]> | null {
  const list = claudePlugins(io);
  if (list === null || 'notChecked' in list) return list;
  const wanted = [
    { name: OMNI_PLUGIN_ID, label: 'plugin' },
    { name: HUD_PLUGIN_ID, label: 'HUD plugin' },
  ];
  return wanted.flatMap(({ name, label }): PluginFact[] => {
    const fix = `/plugin install ${name}`;
    if (!list.installed.has(name)) return [{ name, label, version: null, fix }];
    const version = list.installed.get(name) ?? null;
    return version === null ? [] : [{ name, label, version, fix }];
  });
}

/** The repositories whose kit is checked: a plan repository's targets, else the product's other repositories. */
function targetRepos({ root, config }: Pick<GatherIo, 'root' | 'config'>): string[] {
  const planned = config.plan?.targets ?? [];
  if (planned.length > 0) return planned.map((target) => target.repo);
  try {
    const copy = ProductTargetsCopySchema.parse(JSON.parse(readFileSync(join(root, PRODUCT_TARGETS_FILE), 'utf8')));
    return copy.targets.map((target) => target.repo).filter((repo) => repo !== config.repo.slug);
  } catch {
    return [];
  }
}

function readTargetKits(root: string): TargetKits {
  try {
    return TargetKitsSchema.parse(JSON.parse(readFileSync(join(root, TARGET_KITS_FILE), 'utf8')));
  } catch {
    return {};
  }
}

/** One target's kit: its bin's `sha` first, the raw file only when the `sha` changed. */
function targetKit(io: GatherIo, repo: string, kept: TargetKits, found: TargetKits): TargetKitFact {
  const path = `repos/${repo}/contents/${BIN_FILE}`;
  const base: ExecFileSyncOptionsWithStringEncoding = { cwd: io.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: GH_BUDGET_MS, maxBuffer: BIN_MAX_BYTES };
  try {
    const sha = io.exec('gh', ['api', path, '--jq', '.sha'], base).trim();
    const known = kept[repo];
    if (known?.sha === sha) {
      found[repo] = known;
      return { repo, version: known.version };
    }
    const raw = io.exec('gh', ['api', '-H', 'Accept: application/vnd.github.raw', path], base);
    const version = bundleVersion(raw);
    found[repo] = { sha, version };
    return { repo, version };
  } catch (error) {
    return notFound(error) ? { repo, version: null } : { repo, notChecked: whyFailed(error, 'gh') };
  }
}

/** The target repositories' kits. */
function targetsOf(io: GatherIo): TargetKitFact[] {
  const repos = targetRepos(io);
  if (repos.length === 0) return [];
  const kept = readTargetKits(io.root);
  const found: TargetKits = {};
  const facts = repos.map((repo) => targetKit(io, repo, kept, found));
  try {
    ensureLocalDir(io.root);
    writeJsonAt(join(io.root, TARGET_KITS_FILE), found);
  } catch {
    // A cache that cannot be written costs the next run one more read, nothing more.
  }
  return facts;
}

/** The kit check's facts for the repository at `io.root`. */
export function kitFactsOf(io: GatherIo, { running = runningKit({ exec: io.exec }), bundle = runningBundle() }: KitIo = {}): KitFacts | Unchecked {
  const latest = latestOf(io.exec, running.home);
  const installed = installedVersion({ root: io.root, running, bundle });
  return { latest, repo: installed ?? running.version, plugins: pluginsOf(io), targets: targetsOf(io) };
}

/** The kit check's gatherer. Under vitest it starts no `gh` or `claude`: a test of the whole command reads `n/a`. */
export const kitFacts: Gatherer<KitFacts> = (io) => Promise.resolve(processUnderTest() ? { na: NOT_CHECKED_YET } : kitFactsOf(io));
