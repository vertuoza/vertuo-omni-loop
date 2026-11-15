// A landing, as the knowledge harvest qualifies it (PRD 2896 s6, spec "One knowledge pull request per landing", criterion 10): a
// mission pull request, from a branch named by `branches.mission` into `repo.defaultBranch`, merged by a person. Its commits are
// its PRDs, one squash each, titled `<title> (#<feature pull request>)` (../missions/join.ts). Each feature pull request's head
// names its PRD's topic, and the PRD's folder at the merge its number and title, as for a feature PR (../retro/qualify.ts).
//
// The config is read at the merge, never at the head, as for a feature PR. A pull request that is not a mission pull request
// is no landing (null): the harvest says why it is no feature PR either.
import { z } from 'zod';
import { foldersLayout } from 'omni-loop/kit/lib/layout.ts';
import type { PrdNumber, PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { prOfTitle } from '../missions/landing.ts';
import { paginate, PER_PAGE, readFiles, readPull } from '../retro/github.ts';
import { configAt, prdFolder, specTitle, topicOf } from '../retro/qualify.ts';
import type { Config, Octokit, Pull } from '../retro/retro.types.ts';
import { ListSchema } from '../retro/github.schema.ts';
import { parsedOr } from './schema.ts';

/** One PRD a landing carried: its number, topic and title, and the feature pull request that joined it to the mission branch. */
export type LandingPrd = { number: PrdNumber; topic: string; title: string; pr: PrNumber };

/** A landing the harvest covers: the config at the merge, the mission branch, and its PRDs in the order they landed. */
export type QualifiedLanding = { skip: null; config: Config; branch: string; prds: LandingPrd[] } | { skip: string };

type Repo = { owner: string; repo: string };

/** `GET /repos/{owner}/{repo}/pulls/{pull_number}/commits`: each commit's message. */
const CommitsSchema = z.array(z.looseObject({ commit: z.looseObject({ message: z.string() }) }));

/** A regular expression's own text, every character it gives a meaning taken literally. */
const literal = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whether `head` is a mission branch by `template` (`branches.mission`: `{number}` an issue's number, `{topic}` a slug). */
function isMissionBranch(head: string, template: string): boolean {
  const pattern = template
    .split(/(\{number\}|\{topic\})/)
    .map((part) => (part === '{number}' ? '[1-9][0-9]*' : part === '{topic}' ? '[a-z0-9][a-z0-9-]*' : literal(part)))
    .join('');
  return template.includes('{number}') && new RegExp(`^${pattern}$`).test(head);
}

/** The feature pull requests a mission pull request's commits name, in order, once each. */
async function carried(octokit: Octokit, { owner, repo, prNumber }: Repo & { prNumber: PrNumber }): Promise<PrNumber[]> {
  const commits = await paginate((page: number) =>
    octokit
      .request('GET /repos/{owner}/{repo}/pulls/{pull_number}/commits', { owner, repo, pull_number: prNumber, per_page: PER_PAGE, page })
      .then(({ data }) => parsedOr(ListSchema, data, `GitHub answered the commits of #${String(prNumber)} unexpectedly`)),
  );
  const prs = parsedOr(CommitsSchema, commits, `GitHub answered the commits of #${String(prNumber)} unexpectedly`).flatMap(({ commit }) => {
    const pr = prOfTitle(commit.message);
    return pr === null ? [] : [pr];
  });
  return [...new Set(prs)];
}

/** The PRD feature pull request `pr` delivered, at the merge `mergeSha`; null when its head or folder names none. */
async function prdOf(octokit: Octokit, { owner, repo, pr, mergeSha, config }: Repo & { pr: PrNumber; mergeSha: string; config: Config }): Promise<LandingPrd | null> {
  const feature = await readPull(octokit, { owner, repo, prNumber: pr });
  const topic = topicOf(feature.headRef, config.branches.feature);
  if (topic === null) return null;
  const dirs = foldersLayout('', config.paths).dirs;
  const found = await prdFolder(octokit, { owner, repo, sha: mergeSha, dirs, topic });
  if (!found) return null;
  const spec = `${dirs[found.state]}/${found.name}/spec.md`;
  const files = await readFiles(octokit, { owner, repo, ref: mergeSha, paths: [spec] });
  return { number: found.prd, topic, title: specTitle(files[spec] ?? '') ?? topic, pr };
}

/**
 * The landing merged pull request `pr` is, at its merge `mergeSha`: its PRDs, or why it covers none; `otherwise` (why it is no
 * feature PR) when it is no mission pull request (none read, not into the default branch, its head no mission branch, or no
 * config at the merge).
 */
export async function qualifyLanding(
  octokit: Octokit,
  { owner, repo, pr, mergeSha, otherwise }: Repo & { pr: Pull | null; mergeSha: string; otherwise: string },
): Promise<QualifiedLanding> {
  const none = { skip: otherwise };
  if (pr === null || !pr.merged) return none;
  const { config, error } = await configAt(octokit, { owner, repo, sha: mergeSha });
  if (error) throw error;
  if (!config || pr.baseRef !== config.repo.defaultBranch || !isMissionBranch(pr.headRef, config.branches.mission)) return none;
  const prds: LandingPrd[] = [];
  for (const feature of await carried(octokit, { owner, repo, prNumber: pr.number })) {
    const prd = await prdOf(octokit, { owner, repo, pr: feature, mergeSha, config });
    if (prd !== null && !prds.some((one) => one.number === prd.number)) prds.push(prd);
  }
  if (prds.length === 0) return { skip: `The landing #${String(pr.number)} carried no PRD of this repository.` };
  return { skip: null, config, branch: pr.headRef, prds };
}
