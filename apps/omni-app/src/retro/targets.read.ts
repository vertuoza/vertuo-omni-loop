// The GitHub reads of a multi-repository PRD's targets (PRD 1130), each in the retro's saved steps:
//
//   step "target-<name>"         the App's own call `GET /repos/{owner}/{repo}/installation`, on the
//                                App's budget; then, as that installation, the target's feature PRs
//                                (one per landing) and the sub-PRs into each
//   steps "gather-<kind>-<name>" each kind of the merge run, with a scope for that target
//
// A target the retro cannot read (not in the config, the App not installed there, a read refused) is
// `read: false` with its reason, and the retro goes on with the others; any other failure is thrown,
// so the step is retried.
import { savedStep, type StepRun } from '../saved-step.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { listPullsFrom, listPullsInto, readPull } from './github.ts';
import { InstallationSchema, parseGitHub } from './github.schema.ts';
import type { Kind } from './kinds/index.ts';
import { TargetReadSchema } from './retro.schema.ts';
import type { FeaturePull, Octokit, PullInto, Scope, TargetRead } from './retro.types.ts';
import { planTargets, type PlanTarget } from './targets.ts';

const INSTALLATION = 'GET /repos/{owner}/{repo}/installation';

/** The App's own client, signed with its JWT: what looks up its installation on a target. */
export type AppOctokit = () => Promise<Octokit> | Octokit;

/** What reading the targets takes: the step tools, both GitHub clients, the plan repository and its PRD. */
type TargetsInput = {
  step: StepRun;
  appOctokit: AppOctokit | null;
  octokitFor: OctokitFor<Octokit>;
  planSlug: string;
  scope: Pick<Scope, 'config' | 'prd'>;
};

/** Each target of the PRD, read in its own step, in `## Repositories` order; `[]` for a PRD of one repository. */
export async function readTargets({ step, appOctokit, octokitFor, planSlug, scope }: TargetsInput): Promise<TargetRead[]> {
  const targets = planTargets({ config: scope.config, plan: scope.prd.plan, planSlug, topic: scope.prd.topic });
  const read: TargetRead[] = [];
  for (const target of targets) {
    read.push(await savedStep(step, `target-${target.name}`, TargetReadSchema, () => readTarget({ appOctokit, octokitFor }, target)));
  }
  return read;
}

/** A target that could not be read, and why. */
const notRead = (target: PlanTarget, reason: string): TargetRead => ({ name: target.name, repo: target.slug ?? target.name, read: false, reason });

/** One target: its installation looked up as the App, then its pull requests read as that installation. */
export async function readTarget(
  { appOctokit, octokitFor }: Pick<TargetsInput, 'appOctokit' | 'octokitFor'>,
  target: PlanTarget,
): Promise<TargetRead> {
  if (target.slug === null) return notRead(target, 'not a target in the plan section of the config');
  if (appOctokit === null) return notRead(target, 'the App cannot look up its installations here');
  const [owner = '', repo = ''] = target.slug.split('/');
  const installation = await refusedAs(async () => (await appOctokit()).request(INSTALLATION, { owner, repo }));
  if ('status' in installation) {
    return notRead(target, installation.status === 404 ? 'the App is not installed there' : `GitHub refused the App's lookup (${installation.status})`);
  }
  const installationId = parseGitHub(InstallationSchema, installation.value.data, INSTALLATION).id;
  const pulls = await refusedAs(async () => featurePulls(await octokitFor(installationId), { owner, repo, branches: target.branches }));
  if ('status' in pulls) return notRead(target, `GitHub refused the read (${pulls.status})`);
  if (pulls.value.featurePrs.length === 0) return notRead(target, `no pull request from \`${target.branches.join('`, `')}\``);
  return { name: target.name, repo: target.slug, read: true, installationId, ...pulls.value };
}

/** Each landing's feature PR (the merged one, else the newest), and every sub-PR into the landings, oldest first. */
async function featurePulls(octokit: Octokit, { owner, repo, branches }: { owner: string; repo: string; branches: string[] }) {
  const featurePrs: FeaturePull[] = [];
  const pulls: PullInto[] = [];
  for (const branch of branches) {
    const [number] = await listPullsFrom(octokit, { owner, repo, branch });
    if (number === undefined) continue;
    const pull = await readPull(octokit, { owner, repo, prNumber: number });
    featurePrs.push({ ...pull, mergeSha: pull.mergeSha ?? pull.headSha });
    pulls.push(...(await listPullsInto(octokit, { owner, repo, base: branch })));
  }
  pulls.sort((a, b) => a.openedAt.localeCompare(b.openedAt) || a.number - b.number);
  return { featurePrs, pulls };
}

/** A read's value, or the status GitHub refused it with (401, 403 or 404); anything else is thrown. */
async function refusedAs<T>(read: () => Promise<T>): Promise<{ value: T } | { status: number }> {
  try {
    return { value: await read() };
  } catch (error) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
    if (status === 401 || status === 403 || status === 404) return { status };
    throw error;
  }
}

/**
 * A read target's scope for the kinds: its repository, its last landing's feature PR and merge, and
 * every sub-PR into its landings. The plan repository's decisions are read once, from there: the
 * target's scope carries no settled file.
 */
export function targetScope(target: Extract<TargetRead, { read: true }>, scope: Scope): Scope {
  const [owner = '', repo = ''] = target.repo.split('/');
  const pr = target.featurePrs.at(-1) ?? scope.pr;
  return { owner, repo, mergeSha: pr.mergeSha, mergedAt: pr.mergedAt, pr, prd: { ...scope.prd, settled: null }, config: scope.config, pulls: target.pulls };
}

/** One target's records, each kind in its own step "gather-<kind>-<name>", read as the target's installation. */
export async function gatherTarget(
  { step, octokitFor, kinds, scope }: { step: StepRun; octokitFor: OctokitFor<Octokit>; kinds: readonly Kind[]; scope: Scope },
  target: Extract<TargetRead, { read: true }>,
): Promise<Record<string, unknown>> {
  const own = targetScope(target, scope);
  const records: Record<string, unknown> = {};
  for (const kind of kinds) {
    records[kind.id] = await savedStep(step, `gather-${kind.id}-${target.name}`, kind.records.nullable(), async () =>
      (await kind.gather(await octokitFor(target.installationId), own)) ?? null,
    );
  }
  return records;
}
