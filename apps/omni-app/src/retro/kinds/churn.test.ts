import { InngestTestEngine } from '@inngest/test';
import { describe, expect, it } from 'vitest';
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { failing } from '../../../test/github-replay.ts';
import { JUDGE_ENV, MERGE_SHA, judge, mergeFiles } from '../../../test/retro-scenario.ts';
import { inngest } from '../../inngest-client.ts';
import { listPullsInto } from '../github.ts';
import { refusedWordsIn } from '../rules.ts';
import { churn } from './churn.ts';
import type { RetroPull } from './index.ts';
import { handles, replay, retroFunction, scenario } from './test-handles.ts';
import {
  FEATURE,
  GET_COMMIT,
  GITATTRIBUTES,
  LIST_COMMITS,
  OWNER,
  REPO,
  SUB_PULLS,
  UNMERGED,
  churnRecording,
  sha,
  short,
} from './churn.fixtures/delivery.ts';
import type { ChurnMissing } from './churn.fixtures/delivery.ts';

const { gather, detect, section } = handles(churn);

const config = parseConfig('kit: 1\n');
const prd = { number: 7, topic: 'widget' };
const pr = { number: 12, url: FEATURE.html_url, headSha: FEATURE.head.sha, openedAt: FEATURE.created_at, mergedAt: FEATURE.merged_at };
const BLOB = `https://github.com/${OWNER}/${REPO}/blob/${FEATURE.head.sha}`;
const commitUrl = (tag: string) => `https://github.com/${OWNER}/${REPO}/commit/${sha(tag)}`;

type Options = { missing?: ChurnMissing; gitattributes?: string | null };

function github({ missing, gitattributes = GITATTRIBUTES }: Options = {}) {
  const files = gitattributes === null ? {} : { '.gitattributes': gitattributes };
  return replay({
    commits: { [MERGE_SHA]: files },
    pulls: [FEATURE, UNMERGED, ...SUB_PULLS],
    recording: churnRecording({ missing }),
  });
}

async function scopeOf(stub: ReturnType<typeof github>) {
  const pulls: RetroPull[] = await listPullsInto(stub.octokit, { owner: OWNER, repo: REPO, base: 'feat/widget' });
  return { owner: OWNER, repo: REPO, mergeSha: MERGE_SHA, pr, prd, config, pulls };
}

async function run(options?: Options) {
  const stub = github(options);
  const scope = await scopeOf(stub);
  const records = await gather(stub.octokit, scope);
  return { stub, records, ...detect(records, { pr, prd, config, pulls: scope.pulls }) };
}

describe('churn — gather', () => {
  it('reads every commit of each merged sub-PR, with its change blocks and never its patch text', async () => {
    const { records } = await run();
    expect(records.gitattributes).toBe(GITATTRIBUTES);
    expect(records.pulls.map((pull) => [pull.number, pull.commits!.map((commit) => commit.sha)])).toEqual([
      [13, [sha('c1'), sha('c2')]],
      [14, [sha('claim2'), sha('c3'), sha('c4'), sha('c5')]],
      [15, [sha('claim3'), sha('c6'), sha('c7'), sha('c8')]],
    ]);
    const c2 = records.pulls[0]!.commits![1];
    expect(c2).toEqual({
      sha: sha('c2'),
      url: commitUrl('c2'),
      files: [{ path: 'src/store/colour.js', previous: null, status: 'modified', additions: 4, deletions: 4, blocks: [[5, 4, 5, 4]] }],
    });
    expect(JSON.stringify(records)).not.toContain('line 1');
  });

  it('keeps a file GitHub sent without a patch, with its totals and no blocks', async () => {
    const { records } = await run();
    const c7 = records.pulls[2]!.commits!.find((commit) => commit.sha === sha('c7'));
    expect(c7!.files).toEqual([{ path: 'src/show/table.js', previous: null, status: 'added', additions: 120, deletions: 0, blocks: null }]);
  });

  it('reads the feature PR’s final diff: each file’s lines added', async () => {
    const { records } = await run();
    expect(records.final).toContainEqual({ path: 'src/store/colour.js', additions: 23, deletions: 0 });
    expect(records.final).toHaveLength(7);
  });

  it('never reads a merge commit, nor the commits of a sub-PR closed without merging', async () => {
    const { stub } = await run();
    const reads = stub.state.requests;
    expect(reads.filter((r) => r.route === GET_COMMIT && r.ref === sha('m1'))).toEqual([]);
    expect(reads.filter((r) => r.route === LIST_COMMITS).map((r) => r.pull_number)).toEqual([13, 14, 15]);
  });

  it('gathers nothing, and asks GitHub nothing, when no pull request merged into the feature branch', async () => {
    const octokit = { request: () => Promise.reject(new Error('no GitHub')) };
    expect(await gather(octokit, {})).toBeNull();
    expect(await gather(octokit, { pulls: [{ ...UNMERGED, mergedAt: null }] })).toBeNull();
  });

  it('marks what GitHub does not have — a sub-PR’s commits, a commit, the final diff — as not read', async () => {
    const { records } = await run({ missing: { pulls: { 14: 404 }, commits: { c8: 422 }, final: 404 } });
    expect(records.pulls[1]).toMatchObject({ number: 14, commits: null });
    expect(records.pulls[2]!.commits!.at(-1)).toEqual({ sha: sha('c8'), url: null, files: null });
    expect(records.final).toBeNull();
  });

  it('reads no `.gitattributes` as none', async () => {
    const { records } = await run({ gitattributes: null });
    expect(records.gitattributes).toBeNull();
  });

  it('lets any other GitHub failure fail the step, so Inngest retries it', async () => {
    const stub = github();
    const scope = await scopeOf(stub);
    await expect(gather(failing(stub.octokit, GET_COMMIT), scope)).rejects.toThrow('GitHub is down');
    await expect(gather(failing(stub.octokit, LIST_COMMITS, { status: 403 }), scope)).rejects.toThrow('GitHub is down');
  });
});

describe('churn — detect', () => {
  it('finds a line range rewritten in three commits across two slices, followed through the hunk above it', async () => {
    const { facts, findings } = await run();
    expect(facts.ranges).toEqual([
      { path: 'src/store/colour.js', from: 8, to: 11, commits: [short('c1'), short('c2'), short('c4')], slices: ['s1', 's2'] },
    ]);
    const range = findings.find((finding) => finding.id === 'churn:src/store/colour.js:8-11');
    expect(range).toEqual({
      id: 'churn:src/store/colour.js:8-11',
      kind: 'churn',
      title: 'Lines 8-11 of `src/store/colour.js` were rewritten again and again',
      happened:
        'Lines 8-11 of `src/store/colour.js`, as merged, were written and rewritten in 3 commits, in s1 and s2; the rules flag a line range rewritten in 3 or more commits.',
      evidence: [
        { label: `${short('c1')} (s1)`, url: commitUrl('c1') },
        { label: `${short('c2')} (s1)`, url: commitUrl('c2') },
        { label: `${short('c4')} (s2)`, url: commitUrl('c4') },
        { label: '`src/store/colour.js` lines 8-11, as merged', url: `${BLOB}/src/store/colour.js#L8-L11` },
      ],
    });
  });

  it('counts churn per file — lines added across the commits minus those in the final diff — and flags a file at both thresholds only', async () => {
    const { facts, findings } = await run();
    expect(facts.files).toEqual([
      { path: 'src/show/table.js', commits: 2, added: 180, finalAdded: 120, churn: 60, percent: 50 },
      { path: 'src/read/below-percent.js', commits: 2, added: 149, finalAdded: 100, churn: 49, percent: 49 },
      { path: 'src/read/at.js', commits: 2, added: 120, finalAdded: 80, churn: 40, percent: 50 },
      { path: 'src/read/below-lines.js', commits: 2, added: 117, finalAdded: 78, churn: 39, percent: 50 },
      { path: 'src/store/colour.js', commits: 4, added: 31, finalAdded: 23, churn: 8, percent: 35 },
    ]);
    expect(findings.map((finding) => finding.id)).toEqual(['churn:src/show/table.js', 'churn:src/read/at.js', 'churn:src/store/colour.js:8-11']);
    const at = findings.find((finding) => finding.id === 'churn:src/read/at.js');
    expect(at).toEqual({
      id: 'churn:src/read/at.js',
      kind: 'churn',
      title: 'Much of `src/read/at.js` was written, then rewritten',
      happened:
        '`src/read/at.js` had 120 lines added across 2 commits, 80 of them in the final diff: 40 lines of churn, 50% of its final added lines. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.',
      evidence: [
        { label: `${short('c5')} (s2)`, url: commitUrl('c5') },
        { label: `${short('c6')} (s3)`, url: commitUrl('c6') },
        { label: '`src/read/at.js`, as merged', url: `${BLOB}/src/read/at.js` },
      ],
    });
  });

  it('counts a file GitHub sent without a patch by its totals, and names it', async () => {
    const { facts, findings } = await run();
    expect(facts.noPatch).toEqual([{ path: 'src/show/table.js', commit: short('c7'), slice: 's3', additions: 120, deletions: 0 }]);
    const table = findings.find((finding) => finding.id === 'churn:src/show/table.js');
    expect(table!.happened).toContain('had 180 lines added across 2 commits, 120 of them in the final diff: 60 lines of churn');
    expect(table!.happened).toContain(`GitHub sent no patch for it in ${short('c7')}, so that commit is counted by its totals.`);
    expect(facts.ranges.map((range) => range.path)).not.toContain('src/show/table.js');
  });

  it('leaves out a generated path and a lockfile, and names them', async () => {
    const { facts } = await run();
    expect(facts.leftOut).toEqual({ generated: ['dist/bundle.js'], lockfile: ['pnpm-lock.yaml'], delivery: [] });
    expect(facts.files!.map((file) => file.path)).not.toContain('dist/bundle.js');
    expect(facts.files!.map((file) => file.path)).not.toContain('pnpm-lock.yaml');
  });

  it('adds up the delivery, and names the sub-PR it did not count', async () => {
    const { facts } = await run();
    expect(facts).toMatchObject({ pulls: 3, commits: 10, added: 597, finalAdded: 401, churn: 196, notCounted: [16] });
    expect(facts.unread).toEqual({ pulls: [], commits: [] });
  });

  it('follows a renamed file under its new name', () => {
    const records = {
      gitattributes: null,
      final: [{ path: 'b.js', additions: 3, deletions: 0 }],
      pulls: [
        {
          number: 13,
          url: SUB_PULLS[0]!.html_url,
          headRef: 'feat/widget--s1',
          mergedAt: SUB_PULLS[0]!.merged_at,
          commits: ['r1', 'r2', 'r3'].map((tag, i) => ({
            sha: sha(tag),
            url: commitUrl(tag),
            files: [
              i === 0
                ? { path: 'a.js', previous: null, status: 'added', additions: 3, deletions: 0, blocks: [[1, 0, 1, 3]] }
                : i === 1
                  ? { path: 'b.js', previous: 'a.js', status: 'renamed', additions: 3, deletions: 3, blocks: [[1, 3, 1, 3]] }
                  : { path: 'b.js', previous: null, status: 'modified', additions: 3, deletions: 3, blocks: [[1, 3, 1, 3]] },
            ],
          })),
        },
      ],
    };
    const { facts } = detect(records, { pr, prd, config, pulls: [] });
    expect(facts.files).toEqual([{ path: 'b.js', commits: 3, added: 9, finalAdded: 3, churn: 6, percent: 200 }]);
    expect(facts.ranges).toEqual([{ path: 'b.js', from: 1, to: 3, commits: [short('r1'), short('r2'), short('r3')], slices: ['s1'] }]);
  });

  it("leaves out an outbox note raised, rewritten and settled: the loop's own record, not churn", () => {
    const note = `${config.paths.delivery}/outbox/0007-widget/s1-01-a-decision.md`;
    const records = {
      gitattributes: null,
      final: [],
      pulls: [
        {
          number: 13,
          url: SUB_PULLS[0]!.html_url,
          headRef: 'feat/widget--s1',
          mergedAt: SUB_PULLS[0]!.merged_at,
          commits: ['o1', 'o2', 'o3'].map((tag, i) => ({
            sha: sha(tag),
            url: commitUrl(tag),
            files: [
              i === 0
                ? { path: note, previous: null, status: 'added', additions: 50, deletions: 0, blocks: [[1, 0, 1, 50]] }
                : i === 1
                  ? { path: note, previous: null, status: 'modified', additions: 50, deletions: 50, blocks: [[1, 50, 1, 50]] }
                  : { path: note, previous: null, status: 'removed', additions: 0, deletions: 50, blocks: [[1, 50, 1, 0]] },
            ],
          })),
        },
      ],
    };
    const { facts, findings } = detect(records, { pr, prd, config, pulls: [] });
    expect(findings).toEqual([]);
    expect(facts.leftOut.delivery).toEqual([note]);
    expect(facts.files).toEqual([]);
    expect(section(facts)).toContain(`- Left out as the loop's own delivery record: \`${note}\`.`);
  });

  it('still follows line ranges, and counts no file, when the final diff could not be read', async () => {
    const { facts, findings } = await run({ missing: { final: 404 } });
    expect(facts.files).toBeNull();
    expect(facts.finalAdded).toBeNull();
    expect(facts.churn).toBeNull();
    expect(findings.map((finding) => finding.id)).toEqual(['churn:src/store/colour.js:8-11']);
  });

  it('names the sub-PRs and the commits it could not read', async () => {
    const { facts } = await run({ missing: { pulls: { 13: 404 }, commits: { c8: 404 } } });
    expect(facts.unread).toEqual({ pulls: [13], commits: [short('c8')] });
    expect(facts.commits).toBe(7);
  });

  it('finds nothing and has no facts without records', () => {
    expect(detect(null, { pr, prd, config, pulls: [] })).toEqual({ facts: null, findings: [] });
  });

  it('gives the same facts for the same records', async () => {
    const { records } = await run();
    const context = { pr, prd, config, pulls: [] };
    expect(detect(records, context)).toEqual(detect(structuredClone(records), context));
  });
});

describe('churn — its section', () => {
  it('adds up the delivery and names what it left out, what it counted by totals and what it did not count', async () => {
    const { facts } = await run();
    expect(section(facts)).toEqual([
      '- 10 commits read across 3 merged pull requests: 597 lines added, 401 in the final diff, 196 lines of churn.',
      '- Left out as generated, by `.gitattributes`: `dist/bundle.js`.',
      '- Left out as lockfiles: `pnpm-lock.yaml`.',
      `- GitHub sent no patch for \`src/show/table.js\` in ${short('c7')} (s3): counted by its totals, 120 added and 0 removed, its lines not followed.`,
      '- Not counted: #16, never merged.',
    ]);
  });

  it('names what it could not read', async () => {
    const { facts } = await run({ missing: { pulls: { 13: 404 }, commits: { c8: 404 }, final: 404 } });
    const lines = section(facts);
    expect(lines[0]).toBe(
      '- 7 commits read across 2 merged pull requests: 513 lines added; the final diff could not be read, so no file’s churn is counted.',
    );
    expect(lines).toContain('- Not read: the commits of #13, which GitHub did not return.');
    expect(lines).toContain(`- Not read: commit ${short('c8')}, whose diff GitHub did not return.`);
  });

  it('is left out when no commit was read, or without facts', async () => {
    const { facts } = await run({ missing: { pulls: { 13: 404, 14: 404, 15: 404 } } });
    expect(facts.commits).toBe(0);
    expect(section(facts)).toBeNull();
    expect(section(null)).toBeNull();
  });

  it('writes no refused word, in its section or its findings', async () => {
    const { facts, findings } = await run();
    const words = [...section(facts), ...findings.flatMap((finding) => [finding.title, finding.happened])].join('\n');
    expect(refusedWordsIn(words)).toEqual([]);
  });

  it('writes no number its facts and findings do not hold', async () => {
    const { facts, findings } = await run();
    const held = new Set(JSON.stringify({ facts, findings }).match(/\d+/g));
    const written = [...section(facts), ...findings.flatMap((finding) => [finding.title, finding.happened])].join('\n');
    expect((written.match(/\d+/g) ?? []).filter((n) => !held.has(n))).toEqual([]);
  });
});

describe('churn — in the retro', () => {
  it('writes its section and findings into retro.md, every number held by retro.json', async () => {
    const recording = churnRecording();
    const widget = scenario({
      files: { ...mergeFiles(), '.gitattributes': GITATTRIBUTES },
      subPulls: [UNMERGED, ...SUB_PULLS],
      recording,
    });
    const fn = retroFunction({ client: inngest, octokitFor: () => widget.github.octokit, env: JUDGE_ENV, fetch: judge() });
    const { result, error } = await new InngestTestEngine({ function: fn, events: [widget.event] }).execute();
    expect(error).toBeUndefined();
    expect((result as { findings: number }).findings).toBe(4);

    const folder = '.omni-loop/delivery/shipped/0007-widget';
    const files = widget.github.filesAt('docs/retro-widget', [`${folder}/retro.md`, `${folder}/retro.json`]);
    const markdown = files[`${folder}/retro.md`]!;
    expect(markdown).toContain('\n## Churn\n\n- 10 commits read across 3 merged pull requests');
    expect(markdown).toContain('— `churn:src/store/colour.js:8-11`');
    const held = new Set(files[`${folder}/retro.json`]!.match(/\d+/g));
    expect((markdown.match(/\d+/g) ?? []).filter((n: string) => !held.has(n))).toEqual([]);
  });
});
