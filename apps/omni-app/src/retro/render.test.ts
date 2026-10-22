import { parseIssue, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { z } from 'zod';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseConfig } from 'omni-loop/kit/lib/config.ts';
import { outcomeLine } from 'omni-loop/kit/lib/retro/outcome.ts';
import { replayGitHub } from '../../test/github-replay.ts';
import { FEATURE, OWNER, PLAN, REPO, SUB_PULLS } from '../../test/retro-scenario.ts';
import { detect } from './detect.ts';
import { listPullsInto } from './github.ts';
import { mergeRuns, render, retroTitle, verdictComment } from './render.ts';
import { refusedWordsIn } from './rules.ts';
import type { FeaturePull, Finding, IssueLinks, Narration, PrdFacts, Prose, RunRecord } from './retro.types.ts';
import type { Kind } from './kinds/index.ts';

const GOLDEN = fileURLToPath(new URL('./render.golden/', import.meta.url));

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
const pr = {
  number: 12,
  title: FEATURE.title,
  url: FEATURE.html_url,
  openedAt: FEATURE.created_at,
  mergedAt: FEATURE.merged_at,
  mergeSha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
} as FeaturePull;
const prd = {
  number: 7,
  topic: 'widget',
  title: 'Widgets that remember their colour',
  problem: 'A widget forgets its colour.',
  state: 'shipped',
  folder: '.omni-loop/delivery/shipped/0007-widget',
  plan: PLAN,
  settled: null,
} as PrdFacts;

/** The widget scenario's fact sheet: the timeline for real, and one slow slice. */
async function widgetSheet({
  narration = { model: null, reason: 'no model key', dropped: [] },
  extra = [],
  issues = {},
}: { narration?: Narration; extra?: Finding[]; issues?: IssueLinks } = {}): Promise<RunRecord> {
  const github = replayGitHub({ pulls: [FEATURE, ...SUB_PULLS] });
  const pulls = await listPullsInto(github.octokit, { owner: OWNER, repo: REPO, base: 'feat/widget' });
  const records = { timeline: { readyAt: '2026-09-20T11:50:00Z' } };
  const extraKind: Kind = {
    id: 'ci',
    section: 'Checks',
    records: z.unknown(),
    runs: ['merge'],
    gather: () => Promise.resolve(null),
    detect: () => ({ facts: null, findings: extra }),
    describe: () => null,
  };
  const { timeline } = await import('./kinds/timeline.ts');
  const sheet = detect({ run: 'merge', pr, prd, config, pulls, records, kinds: [timeline, extraKind] });
  return { ...sheet, narration, issues };
}

const RED: Finding = {
  id: 'repeated-red:e2e',
  kind: 'repeated-red',
  title: 'The check e2e went red again and again',
  happened: 'The check e2e was red on 4 commits in 2 slices.',
  evidence: [
    { label: 'run 7001', url: 'https://github.com/acme/widgets/actions/runs/7001' },
    { label: 'run 7002', url: 'https://github.com/acme/widgets/actions/runs/7002' },
  ],
};

/** Every run of digits in `text`. */
const numbers = (text: string) => new Set(text.match(/\d+/g) ?? []);

describe('render — retro.md, facts only', () => {
  it('matches its golden file: the timeline, one finding, the rules, and "Facts only" for the summary', async () => {
    const sheet = await widgetSheet();
    const out = render({ doc: mergeRuns(null, sheet), featurePr: 12 });
    golden('retro-facts-only.md', out.markdown);
    golden('retro-facts-only.json', out.json);
    golden('pr-body-facts-only.md', out.prBody);
  });

  it('reads "Facts only: <reason>" when there is no prose', async () => {
    const out = render({ doc: mergeRuns(null, await widgetSheet({ narration: { model: null, reason: 'model unavailable (500)', dropped: [] } })), featurePr: 12 });
    expect(out.markdown).toContain('\nFacts only: model unavailable (500)\n');
  });

  it('writes no number that retro.json does not hold, and retro.json holds exactly the run’s sheet', async () => {
    const issues: IssueLinks = { 'repeated-red:e2e': { number: parseIssue(88), url: 'https://github.com/acme/widgets/issues/88', state: 'open' } };
    const sheet = await widgetSheet({ extra: [RED], issues });
    const out = render({ doc: mergeRuns(null, sheet), featurePr: 12 });
    expect(JSON.parse(out.json)).toEqual({ prd: 7, runs: [sheet] });
    expect(out.markdown).toContain('[#88](https://github.com/acme/widgets/issues/88)');
    const held = numbers(out.json);
    expect([...numbers(out.markdown)].filter((n) => !held.has(n))).toEqual([]);
    expect([...numbers(out.prBody)].filter((n) => !held.has(n))).toEqual([]);
  });

  it('holds no word the rules refuse', async () => {
    const out = render({ doc: mergeRuns(null, await widgetSheet({ extra: [RED] })), featurePr: 12 });
    expect(refusedWordsIn(out.markdown)).toEqual([]);
    expect(refusedWordsIn(out.prBody)).toEqual([]);
  });
});

describe('render — with prose and issue links', () => {
  it('matches its golden file: the model’s summary, titles, why it matters and lessons, the kept finding marked, and each issue linked', async () => {
    const issues: IssueLinks = {
      'repeated-red:e2e': { number: parseIssue(88), url: 'https://github.com/acme/widgets/issues/88', state: 'open' },
      'slow-slice:s3': { number: parseIssue(89), url: 'https://github.com/acme/widgets/issues/89', state: 'closed' },
    };
    const sheet = await widgetSheet({ narration: { model: 'anthropic/claude-opus-5.5', reason: null, dropped: [] }, extra: [RED], issues });
    const prose: Prose = {
      summary: 'The widgets shipped, but one check kept failing and one slice dragged on.',
      findings: {
        'repeated-red:e2e': {
          title: 'The end-to-end check kept failing',
          whyItMatters: 'Each red run held a slice back and hid whether the change itself was sound.',
          lesson: 'Fix the flaky step before the next wave starts.',
          keep: true,
          why: 'No earlier lesson says to fix a flaky step between waves.',
        },
        'slow-slice:s3': {
          title: { dropped: 'it holds a digit' },
          whyItMatters: 'The last slice kept the whole feature waiting.',
          keep: false,
          why: 'A slow slice is a known pattern.',
        },
      },
      lessons: [{ text: 'Keep the end-to-end check green between waves.', findings: ['repeated-red:e2e'] }],
      verdict: { worthIt: true, reason: 'The flaky step is new.' },
    };
    const out = render({ doc: mergeRuns(null, sheet), featurePr: 12, prose });
    golden('retro-prose.md', out.markdown);
    golden('pr-body-prose.md', out.prBody);
  });
});

describe('render — the judge', () => {
  it('names the judge’s version in the front matter, and marks only the kept findings, with their why', async () => {
    const sheet = await widgetSheet({ extra: [RED] });
    const prose: Prose = {
      findings: { 'repeated-red:e2e': { lesson: 'Fix the flaky step first.', keep: true, why: 'It is new.' }, 'slow-slice:s3': { keep: false, why: 'Known.' } },
      lessons: [],
      verdict: { worthIt: true, reason: 'New.' },
    };
    const { markdown } = render({ doc: mergeRuns(null, sheet), featurePr: 12, prose });
    expect(markdown).toContain('\nrules: 1\njudge: 1\n---\n');
    expect(markdown.match(/- \*\*Kept:\*\* /g)).toEqual(['- **Kept:** ']);
    expect(markdown).toContain('- **Proposed lesson:** Fix the flaky step first.\n- **Kept:** It is new.\n');
    expect(markdown).not.toContain('Known.');
  });
});

describe('verdictComment — a retro not worth a pull request', () => {
  it('matches its golden file: "Retro: no new lesson", the timeline in two lines, one line per finding', async () => {
    const sheet = await widgetSheet({ extra: [RED] });
    const prose: Prose = { findings: { 'repeated-red:e2e': { title: 'The end-to-end check kept failing' } }, lessons: [], verdict: { worthIt: false, reason: 'Both are known.' } };
    golden('verdict-comment.md', verdictComment({ judged: true, reason: 'Both are known.', runs: [sheet], prose }));
  });

  it('reads "Retro: not judged — <reason>" when there was no verdict, and says when nothing was found', async () => {
    const text = verdictComment({ judged: false, reason: 'no model key', runs: [await widgetSheet()] });
    expect(text.split('\n')[0]).toBe('Retro: not judged — no model key');
    const none = await widgetSheet();
    none.findings = [];
    expect(verdictComment({ judged: false, reason: 'no model key', runs: [none] })).toContain('\nNo findings: nothing crossed a threshold of the rules.\n');
  });

  it('counts the minutes from the pull request when no timeline was read', async () => {
    const sheet = await widgetSheet();
    sheet.kinds = {};
    const text = verdictComment({ judged: true, reason: 'Known.', runs: [sheet] });
    expect(text).toContain('\n- Feature PR #12: 180 minutes from open to merge.\n- Slices and waves: not counted.\n');
  });

  it('holds one line per finding of every run, each once', async () => {
    const first = await widgetSheet({ extra: [RED] });
    const later = { ...first, run: 'day-14', findings: [{ ...RED, ref: 'F3', id: 'bug:40', title: 'Bug #40 was reported' }] } as RunRecord;
    const lines = verdictComment({ judged: true, reason: 'Known.', runs: [first, later] }).split('\n').filter((line) => /^- F\d/.test(line));
    expect(lines.map((line) => line.slice(0, 4))).toEqual(['- F1', '- F2', '- F3']);
  });
});

describe('render — each kind’s section', () => {
  it('places each kind’s findings under the section that kind names, after its own lines', async () => {
    const sheet = await widgetSheet({ extra: [RED], issues: { 'repeated-red:e2e': { number: parseIssue(88), url: 'u88', state: 'open' } } });
    sheet.kinds.ci = { checks: 1 };
    const kinds = [
      { id: 'timeline', section: 'Timeline', runs: ['merge'], describe: () => ['- the timeline'] },
      { id: 'ci', section: 'Checks', runs: ['merge'], describe: () => ['- the checks'] },
      { id: 'churn', section: 'Churn', runs: ['merge'], describe: () => null },
    ] as unknown as Kind[];
    const out = render({ doc: mergeRuns(null, sheet), featurePr: 12, kinds });
    expect(out.markdown).toContain('## Timeline\n\n- the timeline\n\nFindings: F2 · Slice s3 took far longer than the others\n');
    expect(out.markdown).toContain('## Checks\n\n- the checks\n\nFindings: F1 · The check e2e went red again and again · [#88](u88)\n');
    expect(out.markdown).not.toContain('## Churn');
  });
});

describe('mergeRuns — retro.json keeps every run', () => {
  it('adds a run, and replaces the one with the same feature PR and run on a replay', async () => {
    const sheet = await widgetSheet();
    const first = mergeRuns(null, sheet);
    const again = mergeRuns(JSON.stringify(first), { ...sheet, narration: { model: null, reason: 'other', dropped: [] } });
    expect(again.runs).toHaveLength(1);
    expect(again.runs[0]?.narration?.reason).toBe('other');
    const later = mergeRuns(JSON.stringify(first), { ...sheet, run: 'day-14' as const });
    expect(later.runs.map((run) => run.run)).toEqual(['merge', 'day-14']);
  });

  it('starts again from nothing when the file on the branch is not JSON', async () => {
    expect(mergeRuns('not json', await widgetSheet()).runs).toHaveLength(1);
  });
});

describe('render — the outcomes of the kept lessons (PRD 2338)', () => {
  const issues: IssueLinks = {
    'repeated-red:e2e': { number: parseIssue(88), url: 'https://github.com/acme/widgets/issues/88', state: 'open' },
    'slow-slice:s3': { number: parseIssue(89), url: 'https://github.com/acme/widgets/issues/89', state: 'open' },
  };
  const prose: Prose = {
    findings: {
      'repeated-red:e2e': { lesson: 'Fix the flaky step first.', keep: true, why: 'It is new.' },
      'slow-slice:s3': { lesson: 'Split a slice that runs long.', keep: true, why: 'It is new too.' },
    },
    lessons: [],
    verdict: { worthIt: true, reason: 'New.' },
  };
  const settled = async (): Promise<RunRecord> => ({
    ...(await widgetSheet({ extra: [RED], issues })),
    outcomes: { 'repeated-red:e2e': { became: 'playbook/testing#never' } },
  });

  it('renders each outcome under its lesson, with the kit’s line, and none under a lesson that has none', async () => {
    const { markdown } = render({ doc: mergeRuns(null, await settled()), featurePr: 12, prose });
    expect(markdown).toContain(`- **Kept:** It is new.\n${outcomeLine({ became: 'playbook/testing#never' })}\n- **Evidence:** `);
    expect(markdown).toContain('- **Kept:** It is new too.\n- **Evidence:** ');
  });

  it('renders a reason it stays here on one line', async () => {
    const sheet: RunRecord = { ...(await settled()), outcomes: { 'slow-slice:s3': { staysHere: 'A rule\n  already says it.' } } };
    const { markdown } = render({ doc: mergeRuns(null, sheet), featurePr: 12, prose });
    expect(markdown).toContain('- **Kept:** It is new too.\n- **Stays here:** A rule already says it.\n');
  });

  it('shows each outcome in the PR body, closes the issue of each settled lesson, and says what merging applies', async () => {
    const { prBody } = render({ doc: mergeRuns(null, await settled()), featurePr: 12, prose });
    expect(prBody).toContain('· [#88](https://github.com/acme/widgets/issues/88)\n  - **Became:** `playbook/testing#never`\n');
    expect(prBody).toContain('\nCloses #88\n');
    expect(prBody).not.toContain('Closes #89');
    expect(prBody).not.toContain('changes nothing else');
  });

  it('carries the line that settles the kept lessons when it is given, and none when it is not', async () => {
    const doc = mergeRuns(null, await widgetSheet({ extra: [RED], issues }));
    const line = '/omni:retro-apply --retro 21';
    const withLine = render({ doc, featurePr: 12, prose, apply: line }).prBody;
    expect(withLine).toContain('\n## Lessons to settle\n');
    expect(withLine).toContain(`\n\`\`\`text\n${line}\n\`\`\`\n`);
    const without = render({ doc, featurePr: 12, prose }).prBody;
    expect(without).not.toContain('Lessons to settle');
    expect(without).toContain('\nMerging keeps this retro as history and changes nothing else.\n');
  });
});

describe('mergeRuns — a lesson’s outcome is never lost (PRD 2338)', () => {
  it('keeps the outcomes of the run a replay replaces, and of every other run', async () => {
    const sheet = await widgetSheet();
    const onBranch = {
      prd: 7,
      runs: [
        { ...sheet, outcomes: { 'slow-slice:s3': { became: 'playbook/testing#never' } } },
        { ...sheet, run: 'day-14', outcomes: { 'bug:40': { staysHere: 'Not about how to work here.' } } },
      ],
    };
    const again = mergeRuns(JSON.stringify(onBranch), sheet);
    expect(again.runs.map((run) => run.outcomes)).toEqual([
      { 'slow-slice:s3': { became: 'playbook/testing#never' } },
      { 'bug:40': { staysHere: 'Not about how to work here.' } },
    ]);
  });

  it('adds nothing to a run that records no outcome', async () => {
    const sheet = await widgetSheet();
    const again = mergeRuns(JSON.stringify(mergeRuns(null, sheet)), sheet);
    expect(again.runs[0]).not.toHaveProperty('outcomes');
  });
});

describe('retroTitle', () => {
  it('is docs(retro): PRD <n> — <PRD title>', () => {
    expect(retroTitle({ number: parsePrd(7), title: 'Widgets that remember their colour' })).toBe(
      'docs(retro): PRD 7 — Widgets that remember their colour',
    );
  });
});
