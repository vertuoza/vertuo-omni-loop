import { describe, expect, it } from 'vitest';
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { failing, replayGitHub } from '../../../test/github-replay.ts';
import { refusedWordsIn } from '../rules.ts';
import { afterMerge, followUpAt } from './after-merge.ts';
import {
  DAY_14,
  FEATURE,
  FIX_PULLS,
  ISSUES,
  MERGED_AT,
  MERGE_SHA,
  OWNER,
  RANGES,
  REPO,
  afterMergeRecording,
} from './after-merge.fixtures/day-14.ts';

const config = parseConfig('kit: 1\n');
const prd = { number: 7, topic: 'widget' };
const pr = { number: 12, url: FEATURE.html_url, mergedAt: MERGED_AT, mergeSha: MERGE_SHA };
const atMerge = { kinds: { churn: { ranges: RANGES } } };
const issueUrl = (n) => `https://github.com/${OWNER}/${REPO}/issues/${n}`;
const pullUrl = (n) => `https://github.com/${OWNER}/${REPO}/pull/${n}`;

function github({ missing, issues = ISSUES, pulls = FIX_PULLS } = {}) {
  const stub = replayGitHub({ pulls: [FEATURE, ...pulls], recording: afterMergeRecording({ missing }) });
  stub.state.issues.push(...structuredClone(issues));
  return stub;
}

const scope = (over = {}) => ({ owner: OWNER, repo: REPO, mergeSha: MERGE_SHA, mergedAt: MERGED_AT, pr, prd, config, pulls: [], atMerge, ...over });

async function run(options = {}) {
  const stub = github(options);
  const records = await afterMerge.gather(stub.octokit, scope(options.scope));
  return { stub, records, ...afterMerge.detect(records, { pr, prd, config, pulls: [] }) };
}

describe('after-merge — when it wakes', () => {
  it('fourteen days after the merge, as the rules say', () => {
    expect(followUpAt(MERGED_AT)).toBe(DAY_14);
    expect(followUpAt('2026-02-20T23:30:00Z')).toBe('2026-03-06T23:30:00.000Z');
  });

  it('takes part in the day-14 run only, under its own section', () => {
    expect(afterMerge).toMatchObject({ id: 'after-merge', section: 'After merge', runs: ['day-14'] });
  });
});

describe('after-merge — gather', () => {
  it('keeps the `bug` issues naming the PRD opened within the window: not an older one, a later one, or one naming another PRD', async () => {
    const { records, stub } = await run();
    expect(records.window).toEqual({ from: '2026-09-20T12:00:00.000Z', to: DAY_14 });
    expect(records.bugs).toEqual([
      { number: 40, url: issueUrl(40), createdAt: '2026-09-23T09:00:00Z', closedAt: '2026-09-24T10:00:00Z' },
      { number: 41, url: issueUrl(41), createdAt: '2026-09-29T08:00:00Z', closedAt: '2026-10-08T09:00:00Z' },
    ]);
    const listed = stub.state.requests.find((r) => r.route === 'GET /repos/{owner}/{repo}/issues');
    expect(listed).toMatchObject({ labels: 'bug', state: 'all', since: '2026-09-20T12:00:00.000Z' });
  });

  it('keeps the pull requests merged into the default branch within the window that close one of them, with their change blocks', async () => {
    const { records } = await run();
    expect(records.fixes).toEqual([
      {
        number: 45,
        url: pullUrl(45),
        mergedAt: '2026-09-24T09:55:00Z',
        closes: [40],
        files: [
          { path: 'src/store/colour.js', previous: null, blocks: [[9, 2, 9, 2]] },
          { path: 'src/store/colour.test.js', previous: null, blocks: [[1, 0, 1, 3]] },
        ],
      },
      { number: 47, url: pullUrl(47), mergedAt: '2026-09-27T10:00:00Z', closes: [40], files: [{ path: 'src/show/table.js', previous: null, blocks: null }] },
    ]);
  });

  it('reads the jobs of every workflow run on the merge commit, never a check run', async () => {
    const { records, stub } = await run();
    expect(records.checks).toEqual({
      commit: MERGE_SHA,
      status: null,
      jobs: [
        { name: 'unit', workflow: 'CI', conclusion: 'success', url: expect.stringContaining('/job/8001') },
        { name: 'e2e', workflow: 'CI', conclusion: 'failure', url: expect.stringContaining('/job/8002') },
        { name: 'lint', workflow: 'CI', conclusion: 'success', url: expect.stringContaining('/job/8003') },
        { name: 'deploy', workflow: 'Deploy', conclusion: 'skipped', url: expect.stringContaining('/job/8004') },
      ],
    });
    expect(stub.state.requests.filter((r) => r.route.includes('check-runs'))).toEqual([]);
  });

  it('hands on the churn ranges the merge run found, and nothing else of that run', async () => {
    const { records } = await run();
    expect(records.ranges).toEqual([
      { path: 'src/store/colour.js', from: 8, to: 11 },
      { path: 'src/show/table.js', from: 61, to: 90 },
    ]);
    expect(records.unread).toEqual([]);
  });

  it('reads no pull request when no bug names the PRD', async () => {
    const { records, stub } = await run({ issues: ISSUES.filter((issue) => ![40, 41].includes(issue.number)) });
    expect(records.bugs).toEqual([]);
    expect(records.fixes).toEqual([]);
    expect(stub.state.requests.filter((r) => r.route.startsWith('GET /repos/{owner}/{repo}/pulls'))).toEqual([]);
  });

  it('stops listing pull requests at the first page updated before the merge', async () => {
    const older = Array.from({ length: 100 }, (_, i) => ({ ...FIX_PULLS[3], number: 200 + i, updated_at: '2026-09-10T00:00:00Z', merged_at: '2026-09-10T00:00:00Z' }));
    const stub = github({ pulls: [...FIX_PULLS, ...older] });
    await afterMerge.gather(stub.octokit, scope());
    const pages = stub.state.requests.filter((r) => r.route === 'GET /repos/{owner}/{repo}/pulls').map((r) => r.page);
    expect(pages).toEqual([1]);
    expect(stub.state.requests.find((r) => r.route === 'GET /repos/{owner}/{repo}/pulls')).toMatchObject({
      base: 'main',
      state: 'closed',
      sort: 'updated',
      direction: 'desc',
    });
  });

  it('names what GitHub would not let it read, instead of guessing', async () => {
    const { records } = await run({ missing: { runs: 403, files: { 45: 404 } } });
    expect(records.checks).toEqual({ commit: MERGE_SHA, status: 403, jobs: [] });
    expect(records.fixes[0]).toMatchObject({ number: 45, files: null });
    expect(records.unread).toEqual([{ read: 'files', pr: 45, status: 404 }]);
  });

  it('names a run whose jobs it could not read', async () => {
    const { records } = await run({ missing: { jobs: { 7002: 404 } } });
    expect(records.checks.jobs.map((job) => job.name)).toEqual(['unit', 'e2e', 'lint']);
    expect(records.unread).toEqual([{ read: 'jobs', run: 7002, status: 404 }]);
  });

  it('lets any other GitHub failure fail the step, so Inngest retries it', async () => {
    const stub = github();
    const broken = failing(stub.octokit, 'GET /repos/{owner}/{repo}/issues');
    await expect(afterMerge.gather(broken, scope())).rejects.toThrow('GitHub is down');
  });

  it('gathers nothing without a merge to count from', async () => {
    expect(await afterMerge.gather({ request: () => { throw new Error('no GitHub'); } }, {})).toBeNull();
  });
});

describe('after-merge — detect', () => {
  it('counts the bugs, the ones fixed and the ones linked to churn, and the merge commit’s jobs', async () => {
    const { facts } = await run();
    expect(facts).toMatchObject({ prd: 7, days: 14, from: '2026-09-20T12:00:00.000Z', to: DAY_14, total: 2, fixed: 1, linked: 1 });
    expect(facts.checks).toMatchObject({ commit: 'merge1', read: true, status: null, total: 4, green: 2, red: 1, other: 1 });
  });

  it('marks a fix touching a churn range as linked: by its lines, or by its file when GitHub sent no patch', async () => {
    const { facts } = await run();
    expect(facts.bugs).toEqual([
      {
        number: 40,
        url: issueUrl(40),
        daysAfterMerge: 2,
        closed: true,
        fixes: [45, 47],
        linked: [
          { fix: 45, path: 'src/store/colour.js', from: 8, to: 11, finding: 'churn:src/store/colour.js:8-11', byFile: false },
          { fix: 47, path: 'src/show/table.js', from: 61, to: 90, finding: 'churn:src/show/table.js:61-90', byFile: true },
        ],
      },
      { number: 41, url: issueUrl(41), daysAfterMerge: 8, closed: false, fixes: [], linked: [] },
    ]);
  });

  it('does not link a fix whose lines stay outside every range', () => {
    const records = {
      window: { from: '2026-09-20T12:00:00.000Z', to: DAY_14 },
      bugs: [{ number: 40, url: issueUrl(40), createdAt: '2026-09-23T09:00:00Z', closedAt: null }],
      fixes: [
        {
          number: 45,
          url: pullUrl(45),
          mergedAt: '2026-09-24T09:55:00Z',
          closes: [40],
          files: [
            { path: 'src/store/colour.js', previous: null, blocks: [[12, 2, 12, 2], [4, 0, 4, 3], [8, 0, 8, 1]] },
            { path: 'src/show/other.js', previous: null, blocks: null },
          ],
        },
      ],
      checks: { commit: MERGE_SHA, status: null, jobs: [] },
      ranges: [{ path: 'src/store/colour.js', from: 8, to: 11 }],
      unread: [],
    };
    const { facts, findings } = afterMerge.detect(records, { pr, prd });
    expect(facts.bugs[0]).toMatchObject({ fixes: [45], linked: [] });
    expect(facts).toMatchObject({ fixed: 1, linked: 0 });
    expect(findings[0].happened).not.toContain('linked');
  });

  it('links a pure insertion inside a range, and a file renamed from a churned one', () => {
    const records = {
      window: { from: '2026-09-20T12:00:00.000Z', to: DAY_14 },
      bugs: [{ number: 40, url: issueUrl(40), createdAt: '2026-09-23T09:00:00Z', closedAt: null }],
      fixes: [
        { number: 45, url: pullUrl(45), mergedAt: '2026-09-24T09:55:00Z', closes: [40], files: [{ path: 'src/store/colour.js', previous: null, blocks: [[10, 0, 10, 2]] }] },
        { number: 47, url: pullUrl(47), mergedAt: '2026-09-25T09:55:00Z', closes: [40], files: [{ path: 'src/store/hue.js', previous: 'src/store/colour.js', blocks: [[11, 1, 11, 1]] }] },
      ],
      checks: { commit: MERGE_SHA, status: null, jobs: [] },
      ranges: [{ path: 'src/store/colour.js', from: 8, to: 11 }],
      unread: [],
    };
    const { facts } = afterMerge.detect(records, { pr, prd });
    expect(facts.bugs[0].linked.map((link) => link.fix)).toEqual([45, 47]);
  });

  it('counts only what falls within the window, whatever the records hold', () => {
    const records = {
      window: { from: '2026-09-20T12:00:00.000Z', to: DAY_14 },
      bugs: [
        { number: 40, url: issueUrl(40), createdAt: '2026-09-23T09:00:00Z', closedAt: '2026-10-05T09:00:00Z' },
        { number: 42, url: issueUrl(42), createdAt: '2026-10-06T08:00:00Z', closedAt: null },
        { number: 44, url: issueUrl(44), createdAt: '2026-09-19T08:00:00Z', closedAt: null },
      ],
      fixes: [{ number: 46, url: pullUrl(46), mergedAt: '2026-10-05T08:55:00Z', closes: [40], files: [] }],
      checks: { commit: MERGE_SHA, status: null, jobs: [] },
      ranges: [],
      unread: [],
    };
    const { facts, findings } = afterMerge.detect(records, { pr, prd });
    expect(facts.bugs).toEqual([{ number: 40, url: issueUrl(40), daysAfterMerge: 2, closed: false, fixes: [], linked: [] }]);
    expect(findings.map((finding) => finding.id)).toEqual(['bug:40']);
  });

  it('finds one `bug` finding per bug, the most severe kind, with what happened and its evidence', async () => {
    const { findings } = await run();
    expect(findings).toEqual([
      {
        id: 'bug:40',
        kind: 'bug',
        title: 'Bug #40 was reported against the PRD after the merge',
        happened:
          'Issue #40, labelled `bug`, names #7 and was opened 2 days after the merge. It was closed within 14 days of the merge, fixed by #45 and #47. A fix touched code rewritten again and again before the merge, so the bug is linked to that churn: #45 touched `churn:src/store/colour.js:8-11`, and #47 changed `src/show/table.js`, which holds `churn:src/show/table.js:61-90`, without a patch to place its lines.',
        evidence: [
          { label: 'Bug #40', url: issueUrl(40) },
          { label: 'Fix #45', url: pullUrl(45) },
          { label: 'Fix #47', url: pullUrl(47) },
        ],
      },
      {
        id: 'bug:41',
        kind: 'bug',
        title: 'Bug #41 was reported against the PRD after the merge',
        happened:
          'Issue #41, labelled `bug`, names #7 and was opened 8 days after the merge. It was still open 14 days after the merge; no pull request closing it was merged by then.',
        evidence: [{ label: 'Bug #41', url: issueUrl(41) }],
      },
    ]);
  });

  it('finds nothing, and says so, when no bug names the PRD', async () => {
    const { facts, findings } = await run({ issues: [] });
    expect(findings).toEqual([]);
    expect(facts).toMatchObject({ total: 0, fixed: 0, linked: 0, bugs: [] });
    expect(afterMerge.describe(facts)[0]).toBe('- No `bug` issue naming #7 was opened within 14 days of the merge.');
  });

  it('is the same for the same records: nothing in it depends on the clock', async () => {
    const { records } = await run();
    expect(afterMerge.detect(records, { pr, prd })).toEqual(afterMerge.detect(structuredClone(records), { pr, prd }));
  });
});

describe('after-merge — its section', () => {
  it('lists the bugs, their fixes and links, and the merge commit’s jobs', async () => {
    const { facts } = await run();
    expect(afterMerge.describe(facts)).toEqual([
      '- 2 `bug` issues naming #7 were opened within 14 days of the merge: 1 fixed within those days, 1 linked to churn.',
      `- [#40](${issueUrl(40)}): opened 2 days after the merge, closed; fixed by [#45](${pullUrl(45)}) and [#47](${pullUrl(47)}); linked to \`churn:src/store/colour.js:8-11\` (#45) and \`churn:src/show/table.js:61-90\` (#47, by its file).`,
      `- [#41](${issueUrl(41)}): opened 8 days after the merge, still open; no fix merged.`,
      '- 4 GitHub Actions jobs ran on the merge commit `merge1`: 2 green, 1 red (`e2e`), 1 neither.',
    ]);
  });

  it('says what it could not read', async () => {
    const { facts } = await run({ missing: { runs: 403, files: { 45: 404 } } });
    expect(afterMerge.describe(facts).slice(-2)).toEqual([
      '- The jobs on the merge commit `merge1` were not read (GitHub answered 403). The app reads them with the `actions: read` permission.',
      '- The files of #45 were not read (GitHub answered 404), so it is not placed against the churn ranges.',
    ]);
  });

  it('says so when no job ran on the merge commit', () => {
    const facts = afterMerge.detect(
      { window: { from: '2026-09-20T12:00:00.000Z', to: DAY_14 }, bugs: [], fixes: [], checks: { commit: MERGE_SHA, status: null, jobs: [] }, ranges: [], unread: [] },
      { pr, prd },
    ).facts;
    expect(afterMerge.describe(facts).at(-1)).toBe('- No GitHub Actions job ran on the merge commit `merge1`.');
  });

  it('is left out before the day-14 run', () => {
    expect(afterMerge.detect(null, { pr, prd })).toEqual({ facts: null, findings: [] });
    expect(afterMerge.describe(null)).toBeNull();
  });

  it('writes no number its facts and findings do not hold, and no word the rules refuse', async () => {
    const { facts, findings } = await run();
    const held = new Set(JSON.stringify({ facts, findings, days: 14 }).match(/\d+/g));
    const written = [...afterMerge.describe(facts), ...findings.flatMap((finding) => [finding.title, finding.happened])].join('\n');
    expect((written.match(/\d+/g) ?? []).filter((n) => !held.has(n))).toEqual([]);
    expect(refusedWordsIn(written)).toEqual([]);
  });
});
