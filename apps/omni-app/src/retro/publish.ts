// `publish`: the run record and the prose in, the retro branch, its files and the retro PR out (PRD 72,
// "The retro PR"). Through GitHub's Git Data API only: it never clones, never force-pushes, never
// writes to the default branch and never merges.
//
// Idempotent, so a replay or a retry after a half-done publish completes it rather than duplicating
// it: the branch (`branches.retro` with its topic) is cut from the merge SHA only when it does not
// exist; `retro.json` on the branch keeps every run, the record of the same feature PR and run
// replaced; a commit is added on top of the branch's head — a fast-forward — only when `retro.md` or
// `retro.json` changes; the PR is found again by its branch, its title and body rewritten in place,
// and opened only when none is open and the branch holds something its base does not. At most one
// retro PR per PRD is open at a time.
//
// The day-14 run (a record whose `run` is `day-14`) commits to that same branch while its PR is open.
// Once that PR is merged, or closed, it writes to `<branch>-day-14` instead, cut from the default
// branch's head, and opens a PR from there. The records of the runs before it (`earlier`) are written
// again beside its own, so its `retro.md` is the whole retro even when the first PR was never merged.
//
// The branch, the commit and the PR are written through the app's shared writer (`../git-write/`).
import { addCommit, branchHead, pullsFrom, refuseDefault, upsertPull } from '../git-write/git-write.ts';
import { defined } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { mergeRuns, render } from './render.ts';
import { readContent } from './github.ts';
import { RefSchema, parseGitHub } from './github.schema.ts';
import type { Config, FeaturePull, Octokit, Prose, RetroDoc, RunRecord } from './retro.types.ts';

type Repo = { owner: string; repo: string };

const REF = 'GET /repos/{owner}/{repo}/git/ref/{ref}';

/** The run that comes fourteen days after the merge, and the suffix of its own branch. */
const FOLLOW_UP_RUN = 'day-14';
const FOLLOW_UP_SUFFIX = '-day-14';

export type PublishInput = Repo & {
  config: Config;
  prd: { topic: string; folder: string };
  pr: Pick<FeaturePull, 'number' | 'mergeSha'>;
  record: RunRecord;
  prose: Prose | null;
  earlier?: readonly RunRecord[];
};

export type Published = {
  branch: string;
  committed: boolean;
  commit: string;
  pr: { number: number; url: string; created: boolean } | null;
};

export async function publishRetro(octokit: Octokit, { owner, repo, config, prd, pr, record, prose, earlier = [] }: PublishInput): Promise<Published> {
  const base = config.repo.defaultBranch;
  const { branch, from } = await branchFor(octokit, {
    owner,
    repo,
    base,
    first: config.branches.retro.replaceAll('{topic}', prd.topic),
    run: record.run,
    mergeSha: pr.mergeSha,
  });
  refuseDefault(branch, base);

  const head = await branchHead(octokit, { owner, repo, branch, from, defaultBranch: base });
  const paths = { markdown: `${prd.folder}/retro.md`, json: `${prd.folder}/retro.json` };

  const onBranch = {
    json: await readContent(octokit, { owner, repo, ref: branch, path: paths.json }),
    markdown: await readContent(octokit, { owner, repo, ref: branch, path: paths.markdown }),
  };
  const out = render({ doc: withRuns(onBranch.json, [...earlier, record]), featurePr: pr.number, prose });
  const unchanged = onBranch.markdown === out.markdown && onBranch.json === out.json;

  let commit: string = head;
  if (!unchanged) {
    commit = await addCommit(octokit, {
      owner,
      repo,
      branch,
      defaultBranch: base,
      parent: head,
      message: `${out.title}\n\nThe ${record.run} run of #${pr.number}.`,
      files: [
        { path: paths.markdown, content: out.markdown },
        { path: paths.json, content: out.json },
      ],
    });
  }

  // A branch holding nothing beyond where it is cut from has nothing to propose.
  const found = commit === from ? null : await upsertPull(octokit, { owner, repo, branch, base, head: commit, title: out.title, body: out.prBody });
  if (found?.open) {
    await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/labels', {
      owner,
      repo,
      issue_number: found.number,
      labels: [config.labels.retro],
    });
  }
  const retroPr = found ? { number: found.number, url: found.url, created: found.created } : null;
  return { branch, committed: !unchanged, commit, pr: retroPr };
}

/**
 * The branch a run writes to, and the commit it is cut from when it does not exist yet: the retro
 * branch, from the merge SHA; for the day-14 run once the retro branch's PR is merged or closed,
 * `<branch>-day-14`, from the default branch's head.
 */
async function branchFor(
  octokit: Octokit,
  { owner, repo, base, first, run, mergeSha }: Repo & { base: string; first: string; run: string; mergeSha: string },
): Promise<{ branch: string; from: string }> {
  if (run !== FOLLOW_UP_RUN) return { branch: first, from: mergeSha };
  const pulls = await pullsFrom(octokit, { owner, repo, branch: first, base });
  if (pulls.length === 0 || pulls.some((pull: { state: string }) => pull.state === 'open')) return { branch: first, from: mergeSha };
  const { data } = await octokit.request(REF, { owner, repo, ref: `heads/${base}` });
  return { branch: `${first}${FOLLOW_UP_SUFFIX}`, from: parseGitHub(RefSchema, data, REF).object.sha };
}

/** `retro.json`'s content with each record in it, in order (`mergeRuns`). */
function withRuns(existing: string | null, records: readonly RunRecord[]): RetroDoc {
  let text = existing;
  let doc: RetroDoc | null = null;
  for (const record of records) {
    doc = mergeRuns(text, record);
    text = JSON.stringify(doc);
  }
  return defined(doc, 'the retro.json of the records published');
}
