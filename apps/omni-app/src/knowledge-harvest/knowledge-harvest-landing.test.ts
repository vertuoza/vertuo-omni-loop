// One knowledge pull request per landing (PRD 2896 s6, criterion 10): a mission pull request merged into the default branch carries
// several PRDs, and its one harvest covers every one of them, numbering each new id once. The scenario's PRD 42 (widgets, #43) and
// PRD 44 (gadgets, #45) joined `mission/12-faster-quotes`, and #60 landed both.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { FILES, K, KEY, MERGE_SHA, MERGED_AT, MERGER, fakeFetch, harvestRun, harvestScenario } from '../../test/harvest-scenario.ts';
import { readEnv } from '../env.ts';
import type { RequestOctokit } from './github.ts';

const MISSION = 'mission/12-faster-quotes';
const BRANCH = 'docs/knowledge-landing-60';
const TODAY = '2026-09-27';

const pull = (number: number, head: string, base: string, title: string, merged = true) => ({
  number,
  title,
  state: 'closed',
  draft: false,
  merged,
  html_url: `https://github.com/acme/widgets/pull/${String(number)}`,
  head: { ref: head, sha: `head${String(number)}` },
  base: { ref: base, sha: `base${String(number)}` },
  labels: [],
  created_at: '2026-09-25T09:00:00Z',
  closed_at: MERGED_AT,
  merged_at: MERGED_AT,
  merged_by: { login: merged ? MERGER : 'nobody' },
  merge_commit_sha: MERGE_SHA,
});

const WIDGETS = pull(43, 'feat/widgets', MISSION, 'feat(widgets): widgets that remember (PRD 42)');
const GADGETS = pull(45, 'feat/gadgets', MISSION, 'feat(gadgets): gadgets (PRD 44)');
const LANDING = pull(60, MISSION, 'main', 'Mission #12: Faster quotes');

/** The mission pull request's commits, one squash per PRD: the route the replayed GitHub has no recording of. */
const COMMITS = [
  { sha: 'c43', commit: { message: 'feat(widgets): widgets that remember (PRD 42) (#43)' } },
  { sha: 'c45', commit: { message: 'feat(gadgets): gadgets (PRD 44) (#45)' } },
];

function landingGitHub({ commits = COMMITS } = {}) {
  const github = harvestScenario({ files: FILES, pulls: [WIDGETS, GADGETS, LANDING] });
  const octokit: RequestOctokit = {
    async request(route, params = {}) {
      if (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}/commits') return { data: Number(params.page ?? 1) === 1 ? structuredClone(commits) : [] };
      if (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}/files') return { data: [] };
      return github.octokit.request(route, params);
    },
  };
  return { github, octokit };
}

const run = (octokit: RequestOctokit, prNumber = 60) =>
  harvestRun({ octokitFor: () => octokit, openrouter: readEnv({ OPENROUTER_API_KEY: KEY }).openrouter, fetch: fakeFetch(), now: () => TODAY }, { prNumber });

const knowledgePulls = (github: ReturnType<typeof harvestScenario>) => github.state.pulls.filter((one) => one.head.ref === BRANCH);

describe('the harvest of a landing (PRD 2896 s6, criterion 10)', () => {
  it('opens one knowledge pull request for every PRD the mission pull request landed', async () => {
    const { github, octokit } = landingGitHub();
    const { error } = await run(octokit).execute();
    expect(error).toBeUndefined();
    const pulls = knowledgePulls(github);
    expect(pulls).toHaveLength(1);
    const [knowledge] = pulls;
    expect(knowledge?.base.ref).toBe('main');
    expect(knowledge?.title).toBe('docs(knowledge): landing #60 — PRD 42, PRD 44');
    const body = z.string().parse(knowledge?.body);
    expect(body).toContain('Refs #42 · Refs #44 · Knowledge from the landing #60');
    expect(body).toContain('### PRD 42 — Widgets that remember');
    expect(body).toContain('### PRD 44 — Gadgets');
  });

  it('numbers each new id once across the PRDs it covers', async () => {
    const { github, octokit } = landingGitHub();
    await run(octokit).execute();
    const files = github.filesAt(BRANCH, [
      `${K}/adr/0002-widgets-are-built-the-simple-way.md`,
      `${K}/adr/0002-gadgets-are-numbered.md`,
      `${K}/adr/0003-gadgets-are-numbered.md`,
      `${K}/product/rules.md`,
      '.omni-loop/delivery/shipped/0042-widgets/spec.md',
    ]);
    expect(files[`${K}/adr/0002-widgets-are-built-the-simple-way.md`]).toContain('# ADR-0002');
    expect(files[`${K}/adr/0002-gadgets-are-numbered.md`]).toBeNull();
    expect(files[`${K}/adr/0003-gadgets-are-numbered.md`]).toContain('# ADR-0003');
    const rules = z.string().parse(files[`${K}/product/rules.md`]);
    expect(rules).toContain('## BR-PRODUCT-1');
    expect(rules).toContain('## BR-PRODUCT-2');
    expect(rules.match(/^## BR-PRODUCT-1$/gm)).toHaveLength(1);
    // PRD 42, still in the inbox at the landing, is shipped by the same commit.
    expect(files['.omni-loop/delivery/shipped/0042-widgets/spec.md']).toContain('Widgets that remember');
  });

  it('commits once and opens nothing again when the job is replayed', async () => {
    const { github, octokit } = landingGitHub();
    const first = run(octokit);
    await first.execute();
    await run(octokit, 60).execute();
    expect(knowledgePulls(github)).toHaveLength(1);
    expect(github.state.requests.filter((one) => one.route === 'POST /repos/{owner}/{repo}/git/commits')).toHaveLength(1);
  });

  it('skips a mission pull request that carried no PRD of the repository', async () => {
    const { octokit } = landingGitHub({ commits: [{ sha: 'c1', commit: { message: 'chore: by hand' } }] });
    const { result, error } = await run(octokit).execute();
    expect(error).toBeUndefined();
    expect(result).toEqual({ skipped: 'The landing #60 carried no PRD of this repository.' });
  });

  it('never harvests a feature pull request merged into the mission branch: only its landing does', async () => {
    const { github, octokit } = landingGitHub();
    const { result } = await run(octokit, 43).execute();
    expect(z.object({ skipped: z.string() }).parse(result).skipped).toContain(`The base \`${MISSION}\` is not the default branch`);
    expect(github.state.requests.filter((one) => !one.route.startsWith('GET '))).toEqual([]);
  });
});
