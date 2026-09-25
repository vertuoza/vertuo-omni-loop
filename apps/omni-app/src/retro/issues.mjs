// The retro issues (PRD 72, decision 4): one issue per finding, worst first, at most
// `ISSUES_PER_RUN` per run, labelled `labels.retro` and never `labels.prd`, found again by its marker
// (an open one rewritten, a closed one left closed), its body ending with the YAML block
// `/omni:retro-apply` reads. Slice s7 builds it.
//
// Until then it publishes none, and `retro.md` lists its findings without issue links.
//
// The contract the function and `render` rely on:
//   in:  octokit, { owner, repo, config, sheet, prose, retroPath }
//   out: { [findingId]: { number, url, state: 'open' | 'closed' } } for each finding with an issue.
//   It runs in the step before the branch, the files and the pull request are published, so
//   `retro.md` can link each issue.

/**
 * @param {{ request: Function }} _octokit
 * @param {{ owner: string, repo: string, config: object, sheet: object, prose: object | null, retroPath: string }} _input
 * @returns {Promise<Record<string, { number: number, url: string, state: 'open' | 'closed' }>>}
 */
export async function publishIssues(_octokit, _input) {
  return {};
}
