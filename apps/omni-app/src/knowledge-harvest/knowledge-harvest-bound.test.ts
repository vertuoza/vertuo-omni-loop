// Issue 2400: a repository whose delivery history passes the snapshot's 20 MB bound still gets its
// knowledge PR. The harvest of PRD 42 reads PRD 42's own folders; another PRD's shipped folder is
// listed, never fetched, and never counted against the bound.
import { InngestTestEngine } from '@inngest/test';
import { describe, expect, it } from 'vitest';
import { inngest } from '../inngest-client.ts';
import { readEnv } from '../env.ts';
import { D, FILES, KEY, fakeFetch, harvestEvent, harvestScenario } from '../../test/harvest-scenario.ts';
import { createKnowledgeHarvest } from './knowledge-harvest.ts';
import type { RequestOctokit } from './github.ts';
import { MAX_BYTES } from '../snapshot/snapshot.ts';

/** Another PRD's before/after page, larger than the whole snapshot bound on its own. */
const HISTORY = `${D}/shipped/0007-old-history/before-after.html`;
const BIG = `<!doctype html>${'x'.repeat(MAX_BYTES + 1024)}`;

/** The merged pull request changed no file this test reads: its file list is empty. */
const noFiles = (octokit: RequestOctokit): RequestOctokit => ({
  request: async (route, params = {}) => (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}/files' ? { data: [] } : octokit.request(route, params)),
});

function run() {
  const files: Record<string, string> = { ...FILES, [HISTORY]: BIG };
  const github = harvestScenario({ files: files as typeof FILES });
  const fn = createKnowledgeHarvest({ client: inngest, octokitFor: () => noFiles(github.octokit), openrouter: readEnv({ OPENROUTER_API_KEY: KEY }).openrouter, fetch: fakeFetch(), now: () => '2026-09-27' });
  return { github, engine: new InngestTestEngine({ function: fn, events: [harvestEvent()] }) };
}

describe('knowledge-harvest — a delivery history past the snapshot bound (issue 2400)', () => {
  it('still opens the knowledge PR of the merged PRD', async () => {
    const { github, engine } = run();
    const { result, error } = await engine.execute();
    expect(error).toBeUndefined();
    expect(result).toMatchObject({ published: { committed: true } });
    expect(github.state.pulls.some((pull) => pull.head.ref === 'docs/knowledge-widgets')).toBe(true);
  });

  it('never fetches another PRD’s files', async () => {
    const { github, engine } = run();
    await engine.execute();
    const fetched = github.state.requests.filter((request) => request.route === 'GET /repos/{owner}/{repo}/git/blobs/{file_sha}');
    expect(fetched.map((request) => JSON.stringify(request))).not.toContainEqual(expect.stringContaining('0007-old-history'));
  });
});
