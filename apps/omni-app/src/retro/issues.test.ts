import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { InngestTestEngine } from '@inngest/test';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { inngest } from '../inngest-client.ts';
import { replayGitHub } from '../../test/github-replay.ts';
import { FEATURE, JUDGE_ENV, OWNER, REPO, judge, widgetScenario } from '../../test/retro-scenario.ts';
import { detect } from './detect.ts';
import { issueMarker, publishIssues, renderIssue } from './issues.ts';
import { timeline } from './kinds/timeline.ts';
import { createRetro } from './retro.ts';
import { ISSUES_PER_RUN, refusedWordsIn } from './rules.ts';
import type { Config, FactSheet, FeaturePull, Finding, Octokit, PrdFacts, Prose } from './retro.types.ts';
import type { Kind } from './kinds/index.ts';

/** The stubbed GitHub, as the tests read it: its state open to look at. */
type Stub = { octokit: Octokit; state: any; filesAt: (branch: string, paths: string[]) => Record<string, string | undefined> };
type Scenario = { github: Stub; event: any };
const replay = (options?: object): Stub => replayGitHub(options as never) as unknown as Stub;
const scenarioOf = (options?: object): Scenario => widgetScenario(options as never) as unknown as Scenario;

const GOLDEN = fileURLToPath(new URL('./issues.golden/', import.meta.url));

/** Compares `text` with a golden file; `UPDATE_GOLDEN=1 pnpm test` rewrites the file instead. */
function golden(name: string, text: string): void {
  const file = `${GOLDEN}${name}`;
  if (process.env.UPDATE_GOLDEN) {
    mkdirSync(GOLDEN, { recursive: true });
    writeFileSync(file, text);
  }
  expect(text).toBe(readFileSync(file, 'utf8'));
}

const config = parseConfig('kit: 1\n');
const FOLDER = '.omni-loop/delivery/shipped/0007-widget';
const RETRO_PATH = `${FOLDER}/retro.md`;
const BRANCH = 'docs/retro-widget';

const pr = {
  number: 12,
  title: FEATURE.title,
  url: FEATURE.html_url,
  openedAt: FEATURE.created_at,
  mergedAt: FEATURE.merged_at,
  mergeSha: 'merge1',
} as FeaturePull;
const prd = { number: 7, topic: 'widget', title: 'Widgets that remember their colour', state: 'shipped', folder: FOLDER, plan: null } as PrdFacts;

const run = (id: number) => `https://github.com/${OWNER}/${REPO}/actions/runs/${id}`;
const AWKWARD = 'failing-test:cart --> adds an item: twice #2';

/** Seven findings of seven kinds, listed out of order: `detect` ranks them by the rules. */
const FOUND: Finding[] = [
  {
    id: 'churn:src/cart.ts:120-160',
    kind: 'churn',
    title: 'Lines of the cart were rewritten again and again',
    happened: 'Lines 120 to 160 of `src/cart.ts` were rewritten in 4 commits across 2 slices.',
    evidence: [{ label: 'commit abc1234', url: `https://github.com/${OWNER}/${REPO}/commit/abc1234` }],
  },
  {
    id: 'slow-slice:s3',
    kind: 'slow-slice',
    title: 'Slice s3 took far longer than the others',
    happened: 'Slice s3 took 120 minutes from its claim to its merge, against a median of 30 minutes.',
    evidence: [{ label: '#15', url: `https://github.com/${OWNER}/${REPO}/pull/15` }],
  },
  {
    id: 'repeated-red:e2e',
    kind: 'repeated-red',
    title: 'The check e2e went red again and again',
    happened: 'The check e2e was red on 4 commits in 2 slices.',
    evidence: [
      { label: 'run 7001', url: run(7001) },
      { label: 'run 7002', url: run(7002) },
    ],
  },
  {
    id: 'drift:s2-04-colour-store',
    kind: 'drift',
    title: 'A decision drifted from its answer',
    happened: 'Decision `s2-04-colour-store` was answered with B after A was built, and was reworked.',
    evidence: [{ label: '#16', url: `https://github.com/${OWNER}/${REPO}/pull/16` }],
  },
  {
    id: 'territory:s2',
    kind: 'territory',
    title: 'Slice s2 changed a file outside its territory',
    happened: 'Slice s2 changed `src/show/colour.ts`, outside `src/read/`.',
    evidence: [{ label: '#14', url: `https://github.com/${OWNER}/${REPO}/pull/14` }],
  },
  {
    id: AWKWARD,
    kind: 'failing-test',
    title: 'One test failed in several runs',
    happened: 'The test `cart --> adds an item: twice #2` failed in 3 runs.',
    evidence: [{ label: 'run 7003', url: `${run(7003)}?check_suite_focus=true#step:4:12` }],
  },
  {
    id: 'review:14',
    kind: 'review',
    title: 'A review thread was left unresolved at merge',
    happened: 'A review thread on #14 was still unresolved when the feature merged.',
    evidence: [],
  },
];

/** The rank `detect` gives them: drift, repeated red, failing test, review, territory, churn, slow slice. */
const RANKED = ['drift:s2-04-colour-store', 'repeated-red:e2e', AWKWARD, 'review:14', 'territory:s2', 'churn:src/cart.ts:120-160', 'slow-slice:s3'];

const found = (findings: Finding[]): Kind => ({
  id: 'found',
  section: 'Found',
  runs: ['merge'],
  gather: async () => null,
  detect: () => ({ facts: null, findings }),
  describe: () => null,
});

const sheetOf = (findings: Finding[] = FOUND): FactSheet => detect({ run: 'merge', pr, prd, config, pulls: [], records: {}, kinds: [found(findings)] });

/** The judge's marks alone, keeping every finding of `findings`: no words. */
const keeping = (findings: Finding[] = FOUND): Prose => ({
  findings: Object.fromEntries(findings.map((finding) => [finding.id, { keep: true }])),
  lessons: [],
  verdict: { worthIt: true, reason: 'Each finding is new.' },
});
const KEEP_ALL = keeping();

const input = ({ sheet = sheetOf(), prose = KEEP_ALL, cfg = config }: { sheet?: FactSheet; prose?: Prose | null; cfg?: Config } = {}) => ({
  owner: OWNER,
  repo: REPO,
  config: cfg,
  sheet,
  prose,
  retroPath: RETRO_PATH,
});

const PROSE: Prose = {
  summary: 'The widgets shipped, but one check kept failing.',
  findings: {
    ...KEEP_ALL.findings,
    'repeated-red:e2e': {
      title: 'The end-to-end check kept failing',
      whyItMatters: 'Each red run held a slice back and hid whether the change itself was sound.',
      lesson: 'Fix the flaky step before the next wave starts.',
      keep: true,
      why: 'No earlier lesson says to fix a flaky step between waves.',
    },
    'drift:s2-04-colour-store': { title: { dropped: 'it holds a digit' }, whyItMatters: { dropped: 'it links outside the evidence' }, keep: true },
  },
  verdict: KEEP_ALL.verdict,
  lessons: [
    { text: 'Keep the end-to-end check green between waves.', findings: ['repeated-red:e2e'] },
    { text: 'Answer decisions before the wave that builds on them.', findings: ['drift:s2-04-colour-store', 'repeated-red:e2e'] },
  ],
};

const writes = (github: Stub): any[] => github.state.requests.filter((r: any) => !r.route.startsWith('GET '));
const created = (github: Stub): any[] => github.state.requests.filter((r: any) => r.route === 'POST /repos/{owner}/{repo}/issues');
const patched = (github: Stub): any[] => github.state.requests.filter((r: any) => r.route === 'PATCH /repos/{owner}/{repo}/issues/{issue_number}');

/** The YAML block an issue body ends with, parsed. */
function yamlBlock(body: string) {
  const match = body.match(/```yaml\n([\s\S]*?)\n```\n$/);
  expect(match, 'the body ends with a YAML block').toBeTruthy();
  return parse(match![1]!);
}

describe('publishIssues — the first run', () => {
  it('opens one issue for each of the five most severe findings, in the rules’ order, and none for the rest', async () => {
    const github = replay();
    const out = await publishIssues(github.octokit, input());
    expect(ISSUES_PER_RUN).toBe(5);
    const titles = Object.fromEntries(FOUND.map((finding) => [finding.id, `retro(PRD 7): ${finding.title}`]));
    expect(created(github).map((request) => request.title)).toEqual(RANKED.slice(0, 5).map((id) => titles[id]));
    expect(Object.keys(out)).toEqual(RANKED.slice(0, 5));
    expect(github.state.issues).toHaveLength(5);
  });

  it('labels each issue with the retro label, never the PRD label', async () => {
    const github = replay();
    await publishIssues(github.octokit, input());
    expect(created(github)).toHaveLength(5);
    for (const request of created(github)) expect(request.labels).toEqual(['omni:retro']);
    for (const issue of github.state.issues) expect(issue.labels).toEqual([{ name: 'omni:retro' }]);
  });

  it('gives back each issue’s number, link and state, so retro.md can link it', async () => {
    const github = replay();
    const out = await publishIssues(github.octokit, input());
    const first = github.state.issues[0];
    expect(out['drift:s2-04-colour-store']).toEqual({ number: first.number, url: first.html_url, state: 'open' });
    expect(first.html_url).toBe(`https://github.com/${OWNER}/${REPO}/issues/${first.number}`);
  });

  it('starts each body with its marker and ends it with the YAML block /omni:retro-apply reads', async () => {
    const github = replay();
    await publishIssues(github.octokit, input());
    const sheet = sheetOf();
    expect(github.state.issues).toHaveLength(5);
    for (const issue of github.state.issues) {
      const finding = sheet.findings.find((candidate) => issue.body.startsWith(`${issueMarker('omni-outbox', 7, candidate.id)}\n`))!;
      expect(finding, issue.body.split('\n')[0]).toBeTruthy();
      expect(yamlBlock(issue.body)).toEqual({
        prd: 7,
        finding: finding.id,
        kind: finding.kind,
        retro: RETRO_PATH,
        evidence: finding.evidence!.map((item) => item.url),
      });
    }
  });

  it('opens issues only for the findings the judge kept, worst first', async () => {
    const github = replay();
    const kept = FOUND.filter((finding) => ['slow-slice:s3', 'territory:s2', 'repeated-red:e2e'].includes(finding.id));
    const out = await publishIssues(github.octokit, input({ prose: keeping(kept) }));
    expect(Object.keys(out)).toEqual(['repeated-red:e2e', 'territory:s2', 'slow-slice:s3']);
    expect(github.state.issues).toHaveLength(3);
  });

  it('reads and writes nothing when the retro was not judged, or the judge kept nothing', async () => {
    for (const prose of [null, { findings: {}, lessons: [], verdict: { dropped: 'it gives no verdict' } }, keeping([])]) {
      const github = replay();
      expect(await publishIssues(github.octokit, input({ prose }))).toEqual({});
      expect(github.state.requests).toEqual([]);
    }
  });

  it('reads and writes nothing when the run found nothing', async () => {
    const github = replay();
    expect(await publishIssues(github.octokit, input({ sheet: sheetOf([]) }))).toEqual({});
    expect(github.state.requests).toEqual([]);
  });

  it('refuses a config whose retro label is the PRD label, before writing anything', async () => {
    const github = replay();
    const same = parseConfig('kit: 1\nlabels:\n  retro: omni:prd\n');
    await expect(publishIssues(github.octokit, input({ cfg: same }))).rejects.toThrow(/PRD label/);
    expect(writes(github)).toEqual([]);
  });
});

describe('publishIssues — a replay', () => {
  it('rewrites the open issues in place and opens none', async () => {
    const github = replay();
    const first = await publishIssues(github.octokit, input());
    const again = await publishIssues(github.octokit, input({ prose: PROSE }));
    expect(created(github)).toHaveLength(5);
    expect(github.state.issues).toHaveLength(5);
    expect(again).toEqual(first);
    const red = github.state.issues.find((issue: any) => issue.number === first['repeated-red:e2e']!.number);
    expect(red.title).toBe('retro(PRD 7): The end-to-end check kept failing');
    expect(red.body).toContain('## Why it matters\n\nEach red run held a slice back');
    expect(patched(github).map((request) => request.issue_number)).toContain(red.number);
  });

  it('writes nothing to an issue whose title and body are unchanged', async () => {
    const github = replay();
    await publishIssues(github.octokit, input());
    const before = writes(github).length;
    expect(before).toBe(5);
    await publishIssues(github.octokit, input());
    expect(writes(github)).toHaveLength(before);
  });

  it('leaves a closed issue closed and untouched, and still gives it back for retro.md to link', async () => {
    const github = replay();
    const first = await publishIssues(github.octokit, input());
    const { number } = first['repeated-red:e2e']!;
    await github.octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', { owner: OWNER, repo: REPO, issue_number: number, state: 'closed' });
    const body = github.state.issues.find((issue: any) => issue.number === number).body;

    const again = await publishIssues(github.octokit, input({ prose: PROSE }));
    const closed = github.state.issues.find((issue: any) => issue.number === number);
    expect(closed).toMatchObject({ state: 'closed', body });
    expect(patched(github).filter((request) => request.issue_number === number && request.state !== 'closed')).toEqual([]);
    expect(again['repeated-red:e2e']).toEqual({ number, url: first['repeated-red:e2e']!.url, state: 'closed' });
    expect(created(github)).toHaveLength(5);
  });

  it('finds an issue by its own PRD and finding, never by another PRD’s issue for the same finding', async () => {
    const github = replay();
    await github.octokit.request('POST /repos/{owner}/{repo}/issues', {
      owner: OWNER,
      repo: REPO,
      title: 'retro(PRD 8): A decision drifted from its answer',
      body: `${issueMarker('omni-outbox', 8, 'drift:s2-04-colour-store')}\nAnother PRD.\n`,
      labels: ['omni:retro'],
    });
    const out = await publishIssues(github.octokit, input());
    expect(created(github)).toHaveLength(1 + 5);
    expect(out['drift:s2-04-colour-store']!.number).not.toBe(github.state.issues[0].number);
  });
});

describe('publishIssues — the header', () => {
  it('names the PRD and the feature PR, and the retro PR once one is open from the retro branch', async () => {
    const bare = replay();
    await publishIssues(bare.octokit, input());
    expect(bare.state.issues[0].body.split('\n')[1]).toBe('**Retro of PRD 7** (#7 · feature PR #12) · F1');

    const retroPull = {
      number: 930,
      title: 'docs(retro): PRD 7 — Widgets that remember their colour',
      state: 'open',
      html_url: `https://github.com/${OWNER}/${REPO}/pull/930`,
      head: { ref: BRANCH, sha: 'r1' },
      base: { ref: 'main' },
      labels: [{ name: 'omni:retro' }],
    };
    const withPr = replay({ pulls: [retroPull] });
    await publishIssues(withPr.octokit, input());
    const first = withPr.state.issues.find((issue: any) => issue.title.startsWith('retro(PRD 7)'));
    expect(first.body.split('\n')[1]).toBe('**Retro of PRD 7** (#7 · feature PR #12 · retro PR #930) · F1');
  });
});

describe('renderIssue', () => {
  const sheet = sheetOf();
  const red = sheet.findings.find((finding) => finding.id === 'repeated-red:e2e')!;

  it('matches its golden file with facts only', () => {
    const { title, body } = renderIssue({ sheet, finding: red, prose: null, retroPath: RETRO_PATH, retroPr: null, prefix: 'omni-outbox' });
    expect(title).toBe('retro(PRD 7): The check e2e went red again and again');
    golden('issue-facts-only.md', body);
  });

  it('matches its golden file with prose: the model’s title, why it matters, its lesson, the lessons citing it and why it is kept', () => {
    const retroPr = { number: 930, url: `https://github.com/${OWNER}/${REPO}/pull/930` };
    const { title, body } = renderIssue({ sheet, finding: red, prose: PROSE, retroPath: RETRO_PATH, retroPr, prefix: 'omni-outbox' });
    expect(title).toBe('retro(PRD 7): The end-to-end check kept failing');
    golden('issue-prose.md', body);
  });

  it('keeps the detector’s title when the model’s was dropped, and names why a field was dropped', () => {
    const drift = sheet.findings.find((finding) => finding.id === 'drift:s2-04-colour-store')!;
    const { title, body } = renderIssue({ sheet, finding: drift, prose: PROSE, retroPath: RETRO_PATH, retroPr: null, prefix: 'omni-outbox' });
    expect(title).toBe('retro(PRD 7): A decision drifted from its answer');
    expect(body).toContain('## Why it matters\n\n_Dropped: it links outside the evidence._\n');
    expect(body).toContain('## Proposed lesson\n\n- Answer decisions before the wave that builds on them.\n');
  });

  it('keeps an awkward finding id whole: the marker stays one comment, and the YAML block reads it back', () => {
    const odd = sheet.findings.find((finding) => finding.id === AWKWARD)!;
    const { body } = renderIssue({ sheet, finding: odd, prose: null, retroPath: RETRO_PATH, retroPr: null, prefix: 'omni-outbox' });
    const marker = body.split('\n')[0]!;
    expect(marker).toMatch(/^<!-- omni-outbox-retro: prd=7 finding=.* -->$/);
    expect(marker.indexOf('-->')).toBe(marker.length - 3);
    expect(yamlBlock(body)).toMatchObject({ finding: AWKWARD, evidence: [odd.evidence![0]!.url] });
  });

  it('writes "None recorded." for a finding without evidence, and an empty list in its YAML block', () => {
    const review = sheet.findings.find((finding) => finding.id === 'review:14')!;
    const { body } = renderIssue({ sheet, finding: review, prose: null, retroPath: RETRO_PATH, retroPr: null, prefix: 'omni-outbox' });
    expect(body).toContain('## Evidence\n\nNone recorded.\n');
    expect(yamlBlock(body).evidence).toEqual([]);
  });

  it('holds no word the rules refuse', () => {
    for (const finding of sheet.findings) {
      const { title, body } = renderIssue({ sheet, finding, prose: null, retroPath: RETRO_PATH, retroPr: null, prefix: 'omni-outbox' });
      expect(refusedWordsIn(`${title}\n${body}`)).toEqual([]);
    }
  });
});

describe('the retro function — its issues', () => {
  /** The widget scenario, its timeline plus the seven findings above: eight findings, the slow slice once. */
  function engine(scenario: Scenario) {
    const kinds = [timeline as unknown as Kind, found(FOUND)];
    const fn = createRetro({ client: inngest, octokitFor: () => scenario.github.octokit, env: JUDGE_ENV, fetch: judge() as typeof fetch, kinds });
    return new InngestTestEngine({ function: fn, events: [scenario.event] });
  }
  const markdown = (github: Stub) => github.filesAt(BRANCH, [RETRO_PATH])[RETRO_PATH];

  it('publishes five issues before the branch, and retro.md links each', async () => {
    const scenario = scenarioOf();
    const { result, error } = await engine(scenario).execute();
    expect(error).toBeUndefined();
    expect(result).toMatchObject({ findings: 7, issues: 5 });

    const routes = scenario.github.state.requests.map((r: any) => r.route);
    expect(routes.lastIndexOf('POST /repos/{owner}/{repo}/issues')).toBeLessThan(routes.indexOf('POST /repos/{owner}/{repo}/git/refs'));

    const issues = scenario.github.state.issues;
    expect(issues).toHaveLength(5);
    const md = markdown(scenario.github);
    for (const issue of issues) {
      expect(issue.labels).toEqual([{ name: 'omni:retro' }]);
      expect(md).toContain(`[#${issue.number}](${issue.html_url})`);
    }
  });

  it('on a replay opens no second issue, and a closed one stays closed and is still linked', async () => {
    const scenario = scenarioOf();
    await engine(scenario).execute();
    const [first] = scenario.github.state.issues;
    await scenario.github.octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
      owner: OWNER,
      repo: REPO,
      issue_number: first.number,
      state: 'closed',
    });

    const { error } = await engine(scenario).execute();
    expect(error).toBeUndefined();
    expect(created(scenario.github)).toHaveLength(5);
    expect(scenario.github.state.issues.find((issue: any) => issue.number === first.number).state).toBe('closed');
    expect(markdown(scenario.github)).toContain(`[#${first.number}](${first.html_url}) (closed)`);
  });
});
