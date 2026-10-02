import { describe, expect, it } from 'vitest';
import { FEATURE, MERGE_SHA, OWNER, PLAN, REPO, SUB_PULLS, mergeFiles, widgetScenario } from '../../test/retro-scenario.ts';
import { qualify } from './qualify.ts';

type Scenario = ReturnType<typeof widgetScenario>;

const run = (scenario: Scenario) => qualify(scenario.github.octokit, scenario.event.data);

/** `qualify`'s answer for a merge it takes; the test fails, naming why, when it skips the merge. */
async function taken(scenario: Scenario) {
  const out = await run(scenario);
  if (out.skip !== null) throw new Error(`skipped: ${out.skip}`);
  return out;
}

describe('qualify — a merged feature PR', () => {
  it('names the PRD, its shipped folder, its title, its problem, its plan and its settled file', async () => {
    const out = await taken(widgetScenario({ files: mergeFiles({ settled: '# Settled\n' }) }));
    expect(out.skip).toBeNull();
    expect(out.prd).toEqual({
      number: 7,
      topic: 'widget',
      title: 'Widgets that remember their colour',
      problem: 'A widget forgets its colour when the page reloads, so people paint it again.',
      state: 'shipped',
      folder: '.omni-loop/delivery/shipped/0007-widget',
      plan: PLAN,
      settled: '# Settled\n',
    });
    expect(out.pr).toMatchObject({
      number: 12,
      url: `https://github.com/${OWNER}/${REPO}/pull/12`,
      baseRef: 'main',
      headRef: 'feat/widget',
      openedAt: '2026-09-20T09:00:00Z',
      mergedAt: '2026-09-20T12:00:00Z',
      mergeSha: MERGE_SHA,
    });
    expect(out.config.labels.retro).toBe('omni:retro');
    expect(out.config.branches.retro).toBe('docs/retro-{topic}');
  });

  it('finds a PRD merged without being shipped in the inbox, its settled file in the outbox', async () => {
    const out = await taken(widgetScenario({ files: mergeFiles({ state: 'inbox', settled: '# In the outbox\n' }) }));
    expect(out.prd).toMatchObject({
      state: 'inbox',
      folder: '.omni-loop/delivery/inbox/0007-widget',
      settled: '# In the outbox\n',
    });
  });

  it('reads a missing settled file as null', async () => {
    const out = await taken(widgetScenario());
    expect(out.prd.settled).toBeNull();
  });

  it('reads the config and the folder at the merge SHA, and only there', async () => {
    const scenario = widgetScenario();
    await run(scenario);
    const shas = scenario.github.state.requests
      .filter((request: { route: string }) => request.route.includes('/git/'))
      .map((request) => (request.tree_sha ?? request.file_sha ?? '') as string);
    expect(shas.length).toBeGreaterThan(0);
    for (const sha of shas) expect(sha.startsWith(MERGE_SHA)).toBe(true);
  });
});

describe('qualify — what gets no retro', () => {
  it('a merged sub-PR: its base is not the default branch', async () => {
    const sub = { ...SUB_PULLS[0], merge_commit_sha: MERGE_SHA };
    const out = await run(widgetScenario({ feature: sub as never, subPulls: [] }));
    expect(out.skip).toMatch(/not the default branch/);
  });

  it('a merged phase-0 PR: its head does not match the feature branch', async () => {
    const phase0 = { ...FEATURE, head: { ref: 'docs/phase-0-widget', sha: 'p0' } };
    const out = await run(widgetScenario({ feature: phase0 }));
    expect(out.skip).toMatch(/does not match `feat\/\{topic\}`/);
  });

  it('a retro PR itself', async () => {
    const retroPr = { ...FEATURE, head: { ref: 'docs/retro-widget', sha: 'r1' } };
    expect((await run(widgetScenario({ feature: retroPr }))).skip).toMatch(/does not match/);
  });

  it('a repository without config', async () => {
    const out = await run(widgetScenario({ files: mergeFiles({ config: null }) }));
    expect(out.skip).toMatch(/No `\.omni-loop\/config\.yml` at the merge/);
  });

  it('a repository whose config is broken', async () => {
    const out = await run(widgetScenario({ files: mergeFiles({ config: 'kit: 1\nnope: true\n' }) }));
    expect(out.skip).toMatch(/not a valid Omni Loop config/);
  });

  it('a feature branch with no PRD folder for its topic', async () => {
    const other = { ...FEATURE, head: { ref: 'feat/gadget', sha: 'g1' } };
    expect((await run(widgetScenario({ feature: other }))).skip).toMatch(/No PRD folder for the topic `gadget`/);
  });

  it('a pull request that was closed without merging', async () => {
    const closed = { ...FEATURE, merged: false, merged_at: null };
    expect((await run(widgetScenario({ feature: closed }))).skip).toMatch(/not merged/);
  });
});
