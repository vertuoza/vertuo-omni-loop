import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.mjs';
import { replayGitHub } from '../../test/github-replay.mjs';
import { FEATURE, OWNER, PLAN, REPO, SUB_PULLS } from '../../test/retro-scenario.mjs';
import { detect } from './detect.mjs';
import { listPullsInto } from './github.mjs';
import { mergeRuns, render, retroTitle } from './render.mjs';
import { refusedWordsIn } from './rules.mjs';

const GOLDEN = fileURLToPath(new URL('./render.golden/', import.meta.url));

/** Compares `text` with a golden file; `UPDATE_GOLDEN=1 pnpm test` rewrites the file instead. */
function golden(name, text) {
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
};
const prd = {
  number: 7,
  topic: 'widget',
  title: 'Widgets that remember their colour',
  problem: 'A widget forgets its colour.',
  state: 'shipped',
  folder: '.omni-loop/delivery/shipped/0007-widget',
  plan: PLAN,
  settled: null,
};

/** The widget scenario's fact sheet: the timeline for real, and one slow slice. */
async function widgetSheet({ narration = { model: null, reason: 'no model key', dropped: [] }, extra = [], issues = {} } = {}) {
  const github = replayGitHub({ pulls: [FEATURE, ...SUB_PULLS] });
  const pulls = await listPullsInto(github.octokit, { owner: OWNER, repo: REPO, base: 'feat/widget' });
  const records = { timeline: { readyAt: '2026-09-20T11:50:00Z' } };
  const extraKind = {
    id: 'ci',
    section: 'Checks',
    runs: ['merge'],
    gather: async () => null,
    detect: () => ({ facts: null, findings: extra }),
    describe: () => null,
  };
  const { timeline } = await import('./kinds/timeline.mjs');
  const sheet = detect({ run: 'merge', pr, prd, config, pulls, records, kinds: [timeline, extraKind] });
  return { ...sheet, narration, issues };
}

const RED = {
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
const numbers = (text) => new Set(text.match(/\d+/g) ?? []);

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
    const issues = { 'repeated-red:e2e': { number: 88, url: 'https://github.com/acme/widgets/issues/88', state: 'open' } };
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
  it('matches its golden file: the model’s summary, titles, why it matters and lessons, and each issue linked', async () => {
    const issues = {
      'repeated-red:e2e': { number: 88, url: 'https://github.com/acme/widgets/issues/88', state: 'open' },
      'slow-slice:s3': { number: 89, url: 'https://github.com/acme/widgets/issues/89', state: 'closed' },
    };
    const sheet = await widgetSheet({ narration: { model: 'anthropic/claude-opus-5.5', reason: null, dropped: [] }, extra: [RED], issues });
    const prose = {
      summary: 'The widgets shipped, but one check kept failing and one slice dragged on.',
      findings: {
        'repeated-red:e2e': {
          title: 'The end-to-end check kept failing',
          whyItMatters: 'Each red run held a slice back and hid whether the change itself was sound.',
          lesson: 'Fix the flaky step before the next wave starts.',
        },
        'slow-slice:s3': { title: { dropped: 'it holds a digit' }, whyItMatters: 'The last slice kept the whole feature waiting.' },
      },
      lessons: [{ text: 'Keep the end-to-end check green between waves.', findings: ['repeated-red:e2e'] }],
    };
    const out = render({ doc: mergeRuns(null, sheet), featurePr: 12, prose });
    golden('retro-prose.md', out.markdown);
    golden('pr-body-prose.md', out.prBody);
  });
});

describe('render — each kind’s section', () => {
  it('places each kind’s findings under the section that kind names, after its own lines', async () => {
    const sheet = await widgetSheet({ extra: [RED], issues: { 'repeated-red:e2e': { number: 88, url: 'u88', state: 'open' } } });
    sheet.kinds.ci = { checks: 1 };
    const kinds = [
      { id: 'timeline', section: 'Timeline', runs: ['merge'], describe: () => ['- the timeline'] },
      { id: 'ci', section: 'Checks', runs: ['merge'], describe: () => ['- the checks'] },
      { id: 'churn', section: 'Churn', runs: ['merge'], describe: () => null },
    ];
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
    expect(again.runs[0].narration.reason).toBe('other');
    const later = mergeRuns(JSON.stringify(first), { ...sheet, run: 'day-14' });
    expect(later.runs.map((run) => run.run)).toEqual(['merge', 'day-14']);
  });

  it('starts again from nothing when the file on the branch is not JSON', async () => {
    expect(mergeRuns('not json', await widgetSheet()).runs).toHaveLength(1);
  });
});

describe('retroTitle', () => {
  it('is docs(retro): PRD <n> — <PRD title>', () => {
    expect(retroTitle({ number: 7, title: 'Widgets that remember their colour' })).toBe(
      'docs(retro): PRD 7 — Widgets that remember their colour',
    );
  });
});
