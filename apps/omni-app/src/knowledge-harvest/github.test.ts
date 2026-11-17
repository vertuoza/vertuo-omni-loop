import { loadConfig } from 'omni-loop/kit/lib/config.ts';
import { describe, expect, it } from 'vitest';
import { FEATURE, FILES, K, MERGE_SHA, OWNER, REPO, TIP, fakeFetch, harvestRun } from '../../test/harvest-scenario.ts';
import { replayGitHub } from '../../test/github-replay.ts';
import { readEnv } from '../env.ts';
import { takenElsewhere } from './github.ts';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OTHER_RULE = [
  '# Product rules',
  '',
  '## BR-PRODUCT-47',
  '',
  'Another PRD adds this rule.',
  '',
  'Why: it is true.',
  '',
].join('\n');

/** An open pull request into main, its head `head`, whose branch holds the default branch's files plus BR-PRODUCT-47. */
function openPull(number: number, head: string) {
  return {
    number,
    title: `PR ${number}`,
    state: 'open',
    draft: false,
    html_url: `https://github.com/${OWNER}/${REPO}/pull/${number}`,
    head: { ref: head, sha: `head${number}` },
    base: { ref: 'main', sha: 'base' },
    labels: [],
    merged_at: null,
    merged_by: null,
    merge_commit_sha: null,
  };
}

const OTHER_FILES = { ...FILES, [`${K}/product/rules.md`]: OTHER_RULE };

function github(heads: readonly string[]) {
  const commits: Record<string, Record<string, string>> = { [TIP]: FILES, [MERGE_SHA]: FILES };
  const pulls = heads.map((head, index) => openPull(100 + index, head));
  const double = replayGitHub({ commits: { ...commits, other1: OTHER_FILES }, pulls: [FEATURE, ...pulls] });
  double.state.refs.set('heads/main', TIP);
  for (const head of heads) double.state.refs.set(`heads/${head}`, 'other1');
  return double;
}

function configOf() {
  const root = mkdtempSync(join(tmpdir(), 'omni-taken-config-'));
  try {
    mkdirSync(join(root, '.omni-loop'), { recursive: true });
    writeFileSync(join(root, '.omni-loop/config.yml'), FILES['.omni-loop/config.yml']);
    return loadConfig(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('takenElsewhere — every open pull request into the default branch (PRD 3015)', () => {
  it('reads the ids of an open feature pull request, not only a knowledge branch', async () => {
    const config = configOf();
    const double = github(['feat/other']);
    const taken = await takenElsewhere(double.octokit, { owner: OWNER, repo: REPO, config, own: 'docs/knowledge-widgets' });
    expect(taken.branches).toEqual(['feat/other']);
    expect(taken.ids).toContain('BR-PRODUCT-47');
  });

  it('still leaves out the run’s own branch', async () => {
    const config = configOf();
    const double = github(['docs/knowledge-widgets', 'feat/other']);
    const taken = await takenElsewhere(double.octokit, { owner: OWNER, repo: REPO, config, own: 'docs/knowledge-widgets' });
    expect(taken.branches).toEqual(['feat/other']);
  });

  it('AC-5: a harvest numbers its new rule past an open feature pull request', async () => {
    const double = github(['feat/other']);
    const octokit = {
      request: (route: string, params?: Record<string, unknown>) =>
        route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}/files' ? Promise.resolve({ data: [] }) : double.octokit.request(route, params),
    };
    const deps = { octokitFor: () => octokit, openrouter: readEnv({ OPENROUTER_API_KEY: 'test-key-not-a-secret' }).openrouter, fetch: fakeFetch(), now: () => '2026-09-27' };
    const { error } = await harvestRun(deps).execute();
    expect(error).toBeUndefined();
    const files = double.filesAt('docs/knowledge-widgets', [`${K}/product/rules.md`]);
    expect(files[`${K}/product/rules.md`]).toContain('## BR-PRODUCT-48');
    expect(files[`${K}/product/rules.md`]).not.toContain('## BR-PRODUCT-47');
  });
});
