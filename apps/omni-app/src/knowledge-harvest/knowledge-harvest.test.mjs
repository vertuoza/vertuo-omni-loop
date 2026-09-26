import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { InngestTestEngine } from '@inngest/test';
import { createContext } from 'vertuo-omni-plan/kit/lib/context.mjs';
import { loadConfig } from 'vertuo-omni-plan/kit/lib/config.mjs';
import { gradeKnowledge } from 'vertuo-omni-plan/kit/lib/knowledge/check-knowledge.mjs';
import { gateResult } from 'vertuo-omni-plan/kit/lib/outbox/status.mjs';
import { makeMarkers } from 'vertuo-omni-plan/kit/lib/markers.mjs';
import { findOutboxViolations } from 'vertuo-omni-plan/kit/lib/outbox/check-outbox.mjs';
import { parseSettledEntries } from 'vertuo-omni-plan/kit/lib/outbox/settle.mjs';
import { afterEach, describe, expect, it } from 'vitest';
import { inngest, HARVEST_EVENT, OUTBOX_CHECK_EVENT, RETRO_EVENT } from '../inngest-client.mjs';
import { failing } from '../../test/github-replay.mjs';
import {
  FEATURE,
  FILES,
  GADGETS_FEATURE,
  INBOX,
  K,
  KEY,
  LEDGER,
  MERGED_AT,
  NOT_HARVESTED,
  OUTBOX,
  SHIPPED,
  TIP,
  fakeFetch,
  harvestEvent,
  harvestScenario,
} from '../../test/harvest-scenario.mjs';
import {
  CONCURRENCY,
  FAILURE_MARKER,
  HARVEST_FUNCTION_ID,
  createHarvestFailureHandler,
  createKnowledgeHarvest,
  knowledgeHarvest,
} from './knowledge-harvest.mjs';

const markers = makeMarkers('omni-outbox');
const BRANCH = 'docs/knowledge-widgets';
const TODAY = '2026-09-27';

function engine(github, { event = harvestEvent(), env = { OPENROUTER_API_KEY: KEY }, fetch = fakeFetch(), octokit = github.octokit } = {}) {
  const fn = createKnowledgeHarvest({ client: inngest, octokitFor: () => octokit, env, fetch, now: () => TODAY });
  return { run: new InngestTestEngine({ function: fn, events: [event] }), fetch };
}

const writes = (github) => github.state.requests.filter((r) => !r.route.startsWith('GET '));
const commitsMade = (github) => github.state.requests.filter((r) => r.route === 'POST /repos/{owner}/{repo}/git/commits');
/** The knowledge PRs the runs opened from `branch`: the fixture's own merged knowledge PR left out. */
const FIXTURE_PULLS = new Set([FEATURE, GADGETS_FEATURE, ...Object.values(NOT_HARVESTED)].map((pull) => pull.number));
const knowledgePulls = (github, branch = BRANCH) =>
  github.state.pulls.filter((pull) => pull.head.ref === branch && !FIXTURE_PULLS.has(pull.number));

/** The branch's files, written into a scratch folder the kit's checks read. */
const scratch = [];
function checkout(github, branch, paths) {
  const root = mkdtempSync(join(tmpdir(), 'omni-harvest-test-'));
  scratch.push(root);
  for (const [path, text] of Object.entries(github.filesAt(branch, paths))) {
    if (text === null || text === undefined) continue;
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return createContext(root, loadConfig(root));
}
afterEach(() => {
  while (scratch.length) rmSync(scratch.pop(), { recursive: true, force: true });
});

const ADR = `${K}/adr/0002-widgets-are-built-the-simple-way.md`;
const BRANCH_PATHS = [
  '.omni-loop/config.yml',
  `${K}/README.md`,
  `${K}/product/principles.md`,
  `${K}/product/rules.md`,
  `${K}/product/invariants.md`,
  `${K}/adr/README.md`,
  `${K}/adr/0001-outbox-check-as-app.md`,
  ADR,
  `${SHIPPED}/spec.md`,
  `${SHIPPED}/plan.md`,
  LEDGER,
];

describe('knowledge-harvest — a feature PR merged over red', () => {
  it('runs qualify, settle, one classify step per candidate, write, then publish', async () => {
    const github = harvestScenario();
    const { run } = engine(github);
    const { ctx, error } = await run.execute();
    expect(error).toBeUndefined();
    const ids = ctx.step.run.mock.calls.map(([id]) => id);
    expect(ids[0]).toBe('qualify');
    expect(ids[1]).toBe('settle');
    expect(ids.slice(2, -2).sort()).toEqual(
      ['s0-01-local-name', 's0-02-cited', 's0-03-refused', 's0-04-drift', 's1-01-high-one', 's1-02-set-secret'].map((id) => `classify:${id}`),
    );
    expect(ids.slice(-2)).toEqual(['write', 'publish']);
  });

  it('opens one knowledge PR: its title, branch, base and label', async () => {
    const github = harvestScenario();
    const { result, error } = await engine(github).run.execute();
    expect(error).toBeUndefined();
    const [pr] = knowledgePulls(github);
    expect(knowledgePulls(github)).toHaveLength(1);
    expect(pr.title).toBe('docs(knowledge): PRD 42 — Widgets that remember');
    expect(pr.head.ref).toBe(BRANCH);
    expect(pr.base.ref).toBe('main');
    expect(pr.labels.map((label) => label.name)).toEqual(['omni:knowledge']);
    expect(result.published.pr).toMatchObject({ number: pr.number, created: true });
  });

  it('commits a tree holding the adopted entries, the moved folder, the knowledge files and the ledger lines', async () => {
    const github = harvestScenario();
    await engine(github).run.execute();
    expect(commitsMade(github)).toHaveLength(1);
    expect(commitsMade(github)[0].parents).toEqual([TIP]);

    const files = github.filesAt(BRANCH, [...BRANCH_PATHS, `${INBOX}/spec.md`, `${OUTBOX}/settled.md`, `${OUTBOX}/s1-01-high-one.md`, `${SHIPPED}/outbox/s1-01-high-one.md`]);
    // Settled at merge: the open items adopted by the merger, their files gone, the folder shipped.
    expect(files[`${INBOX}/spec.md`]).toBeNull();
    expect(files[`${OUTBOX}/settled.md`]).toBeNull();
    expect(files[`${OUTBOX}/s1-01-high-one.md`]).toBeNull();
    expect(files[`${SHIPPED}/outbox/s1-01-high-one.md`]).toBeNull();
    expect(files[`${SHIPPED}/spec.md`]).toContain('# Widgets that remember');
    expect(files[`${SHIPPED}/plan.md`]).toContain(`\`${SHIPPED}/spec.md\``);

    const latest = Object.fromEntries(parseSettledEntries(files[LEDGER], markers).map((entry) => [entry.id, entry]));
    for (const id of ['s1-01-high-one', 's1-02-set-secret', 's0-04-drift']) {
      expect(latest[id].verdict).toBe('adopted');
      expect(latest[id].fields['Approved by']).toBe('@octocat');
      expect(latest[id].fields['Approved at']).toBe(MERGED_AT);
      expect(latest[id].fields.Basis).toMatch(/^merged-over-red/);
    }
    // The knowledge, with its provenance.
    expect(files[ADR]).toContain('**Status:** adopted');
    expect(files[ADR]).toContain('**Merged:** @octocat, 2026-09-26, PR #43');
    expect(files[`${K}/product/rules.md`]).toContain('## BR-PRODUCT-1');
    expect(files[`${K}/product/rules.md`]).toContain(`Proposed: harvest ${TODAY}`);
    expect(files[`${K}/product/rules.md`]).not.toContain('None yet.');
    expect(files[`${K}/product/principles.md`]).toContain('## P-PRODUCT-2');
    expect(latest['s1-01-high-one'].became).toEqual(['ADR-0002']);
    expect(latest['s1-02-set-secret'].became).toEqual(['BR-PRODUCT-1', 'P-PRODUCT-2']);
    expect(latest['s0-04-drift'].became).toEqual(['ADR-0001']);
    expect(latest['s0-01-local-name'].fields['Stays here']).toBe('a local choice, nothing lasting');
  });

  it('moves the files it does not rewrite by reusing their blobs, never their text', async () => {
    const github = harvestScenario();
    await engine(github).run.execute();
    const tree = github.state.requests.find((r) => r.route === 'POST /repos/{owner}/{repo}/git/trees').tree;
    const spec = tree.find((entry) => entry.path === `${SHIPPED}/spec.md`);
    expect(spec).toEqual({ path: `${SHIPPED}/spec.md`, mode: '100644', type: 'blob', sha: `${TIP}:${INBOX}/spec.md` });
    expect(tree.find((entry) => entry.path === `${INBOX}/spec.md`)).toMatchObject({ sha: null });
    // Every path appears once in the tree.
    const paths = tree.map((entry) => entry.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('leaves a tree both checks pass, and on which the gate is green', async () => {
    const github = harvestScenario();
    await engine(github).run.execute();
    const ctx = checkout(github, BRANCH, BRANCH_PATHS);
    const files = ['principles', 'rules', 'invariants'].map((f) => `${K}/product/${f}.md`);
    expect(gradeKnowledge({ ctx, files }).violations).toEqual([]);
    expect(findOutboxViolations({ ctx })).toEqual([]);
    expect(gateResult(42, { ctx }).ok).toBe(true);
  });

  it('writes a body whose rows match the ledger lines: proposed principles first, then the table, the not placed, the facts', async () => {
    const github = harvestScenario();
    await engine(github).run.execute();
    const [pr] = knowledgePulls(github);
    const body = pr.body;
    const lines = body.split('\n');
    expect(lines[0]).toBe('Refs #42 · Knowledge from #43, merged by @octocat on 2026-09-26');
    expect(body).toContain("**Proposed principles — a person's call:** P-PRODUCT-2 (serves BR-PRODUCT-1)");
    expect(body.indexOf('**Proposed principles')).toBeLessThan(body.indexOf('| Decision |'));
    expect(body).toContain('| s1-01-high-one | ADR-0002 (new, adopted) | @octocat — merged over a red outbox | how it is built |');
    expect(body).toContain('| s1-02-set-secret | BR-PRODUCT-1, P-PRODUCT-2 (new, proposed) |');
    expect(body).toContain('| s0-01-local-name | stays here | nobody — adopted | a local choice, nothing lasting |');
    expect(body).toContain('| s0-04-drift | covered by ADR-0001 |');
    expect(body).toMatch(/- \[ \] s0-03-refused — the model's reply was refused twice/);
    expect(body).toMatch(/- \[ \] s0-02-cited — the checks refused it: .*BR-GHOST-9/);
    expect(body).toContain('Settled at merge: 2 open items, 1 drift never reworked, adopted by @octocat (merged over a red outbox)');
    expect(body).toContain('Shipped at merge: inbox/0042-widgets → shipped/0042-widgets');
    expect(body).toContain('Checks: omni check knowledge ✓ · omni check outbox ✓');
    expect(body.trimEnd().endsWith('Proposed entries resolve but bind nothing until a person deletes their `Proposed:` line.')).toBe(true);

    // Every row names a decision whose ledger entry carries a line; every unchecked box, one that carries none.
    const ledger = github.filesAt(BRANCH, [LEDGER])[LEDGER];
    const latest = Object.fromEntries(parseSettledEntries(ledger, markers).map((entry) => [entry.id, entry]));
    const rows = lines.filter((line) => /^\| s\d/.test(line)).map((line) => line.split('|')[1].trim());
    expect(rows.sort()).toEqual(['s0-01-local-name', 's0-04-drift', 's1-01-high-one', 's1-02-set-secret']);
    for (const id of rows) expect(latest[id].became.length > 0 || latest[id].fields['Stays here'] !== undefined).toBe(true);
    for (const id of ['s0-02-cited', 's0-03-refused']) {
      expect(latest[id].became).toEqual([]);
      expect(latest[id].fields['Stays here']).toBeUndefined();
    }
  });
});

describe('knowledge-harvest — what never starts a harvest', () => {
  it.each(Object.entries(NOT_HARVESTED))('%s ends at qualify, asks no model and writes nothing', async (_name, pull) => {
    const github = harvestScenario();
    const { run, fetch } = engine(github, { event: harvestEvent(pull.number) });
    const { ctx, result, error } = await run.execute();
    expect(error).toBeUndefined();
    expect(result.skipped).toBeTruthy();
    expect(ctx.step.run.mock.calls.map(([id]) => id)).toEqual(['qualify']);
    expect(fetch).not.toHaveBeenCalled();
    expect(writes(github)).toEqual([]);
  });
});

describe('knowledge-harvest — replays and ids', () => {
  it('a replay gives no second PR and no second commit, rewrites the body, and never writes to main', async () => {
    const github = harvestScenario();
    await engine(github).run.execute();
    const [pr] = knowledgePulls(github);
    pr.body = 'edited by hand';
    const { result, error } = await engine(github).run.execute();
    expect(error).toBeUndefined();
    expect(knowledgePulls(github)).toHaveLength(1);
    expect(commitsMade(github)).toHaveLength(1);
    expect(result.published).toMatchObject({ committed: false, pr: { number: pr.number, created: false } });
    expect(knowledgePulls(github)[0].body).toContain('Refs #42');
    expect(github.state.refs.get('heads/main')).toBe(TIP);
    expect(writes(github).filter((r) => String(r.ref ?? '').endsWith('heads/main'))).toEqual([]);
  });

  it('refuses a knowledge branch that is the default branch before any write', async () => {
    const config = 'kit: 1\nrepo:\n  slug: acme/widgets\nbranches:\n  knowledge: main\n';
    const github = harvestScenario({ files: { ...FILES, '.omni-loop/config.yml': config } });
    const { error } = await engine(github).run.execute();
    expect(error?.message).toMatch(/default branch; refusing to write to it/);
    expect(writes(github)).toEqual([]);
  });

  it('a second harvest while the first PR is open shares no record number and no register id', async () => {
    const github = harvestScenario();
    await engine(github).run.execute();
    const { error } = await engine(github, { event: harvestEvent(GADGETS_FEATURE.number) }).run.execute();
    expect(error).toBeUndefined();
    expect(knowledgePulls(github, 'docs/knowledge-gadgets')).toHaveLength(1);
    const second = github.filesAt('docs/knowledge-gadgets', [`${K}/adr/0002-gadgets-are-numbered.md`, `${K}/adr/0003-gadgets-are-numbered.md`, `${K}/product/rules.md`]);
    expect(second[`${K}/adr/0002-gadgets-are-numbered.md`]).toBeNull();
    expect(second[`${K}/adr/0003-gadgets-are-numbered.md`]).toContain('# ADR-0003');
    expect(second[`${K}/product/rules.md`]).toContain('## BR-PRODUCT-2');
    expect(second[`${K}/product/rules.md`]).not.toContain('## BR-PRODUCT-1');
  });

  it('nothing to harvest opens nothing', async () => {
    const github = harvestScenario();
    await engine(github).run.execute();
    // The first knowledge PR merged: the default branch moves to its head, its branch is deleted.
    const head = github.state.refs.get(`heads/${BRANCH}`);
    github.state.refs.set('heads/main', head);
    github.state.refs.delete(`heads/${BRANCH}`);
    Object.assign(knowledgePulls(github)[0], { state: 'closed', merged_at: '2026-09-27T10:00:00Z' });
    const everything = Object.fromEntries(Object.keys(REFUSING).map((id) => [id, REFUSING[id]]));
    const { result, error } = await engine(github, { fetch: fakeFetch(everything) }).run.execute();
    expect(error).toBeUndefined();
    expect(result.published).toBeNull();
    expect(knowledgePulls(github)).toHaveLength(1);
    expect(commitsMade(github)).toHaveLength(1);
  });
});

/** Replies refused by the schema, for the decisions a first harvest left not placed. */
const REFUSING = { 's0-02-cited': { kind: 'nonsense' }, 's0-03-refused': { kind: 'nonsense' } };

describe('knowledge-harvest — failures', () => {
  it('without OPENROUTER_API_KEY, still opens the PR with the settle and the ship, every decision not placed', async () => {
    const github = harvestScenario();
    const { run, fetch } = engine(github, { env: {} });
    const { result, error } = await run.execute();
    expect(error).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
    expect(result).toMatchObject({ settled: 3, shipped: true, placed: 0, notPlaced: 6 });
    const [pr] = knowledgePulls(github);
    expect(pr.body).not.toContain('| Decision |');
    expect(pr.body.match(/^- \[ \] .* — the model could not be asked: .*OPENROUTER_API_KEY/gm)).toHaveLength(6);
    expect(pr.body).toContain('Settled at merge: 2 open items');
    expect(pr.body).toContain('Shipped at merge: inbox/0042-widgets → shipped/0042-widgets');
    const files = github.filesAt(BRANCH, [`${SHIPPED}/spec.md`, ADR]);
    expect(files[`${SHIPPED}/spec.md`]).toContain('# Widgets');
    expect(files[ADR]).toBeNull();
  });

  it('a GitHub failure after the retries leaves one comment on the merged feature PR', async () => {
    const github = harvestScenario();
    const broken = failing(github.octokit, 'POST /repos/{owner}/{repo}/git/commits');
    const { error } = await engine(github, { octokit: broken }).run.execute();
    expect(error).toBeTruthy();

    const handler = createHarvestFailureHandler({ octokitFor: () => github.octokit });
    const failed = { name: 'inngest/function.failed', data: { event: harvestEvent(), error: { message: 'GitHub is down' } } };
    await handler({ event: failed, error: new Error('GitHub is down\nat stack') });
    await handler({ event: failed, error: new Error('GitHub is still down') });

    const comments = github.state.comments.filter((comment) => comment.issue === FEATURE.number);
    expect(comments).toHaveLength(1);
    expect(comments[0].body).toBe(`${FAILURE_MARKER}\nThe knowledge harvest could not run: GitHub is still down\n`);
  });
});

describe('knowledge-harvest — the function’s configuration', () => {
  it('is its own function, triggered by the harvest event only, one run at a time per repository', () => {
    expect(knowledgeHarvest.id()).toBe(HARVEST_FUNCTION_ID);
    expect(knowledgeHarvest.opts.triggers).toEqual([{ event: HARVEST_EVENT }]);
    expect(knowledgeHarvest.opts.triggers).not.toContainEqual({ event: RETRO_EVENT });
    expect(knowledgeHarvest.opts.triggers).not.toContainEqual({ event: OUTBOX_CHECK_EVENT });
    expect(knowledgeHarvest.opts.concurrency).toEqual(CONCURRENCY);
    expect(CONCURRENCY).toEqual({ key: 'event.data.repository', limit: 1 });
  });
});
