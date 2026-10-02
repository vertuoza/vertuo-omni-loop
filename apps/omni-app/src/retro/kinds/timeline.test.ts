import { describe, expect, it } from 'vitest';
import { failing } from '../../../test/github-replay.ts';
import { FEATURE, FEATURE_EVENTS, OWNER, PLAN, REPO, SUB_PULLS } from '../../../test/retro-scenario.ts';
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { at } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { listPullsInto } from '../github.ts';
import { timeline, wavesAsMerged } from './timeline.ts';
import type { RetroPull } from './index.ts';
import { handles, replay } from './test-handles.ts';

const { gather, detect, section } = handles(timeline);

const config = parseConfig('kit: 1\n');
const pr = { number: 12, url: FEATURE.html_url, openedAt: FEATURE.created_at, mergedAt: FEATURE.merged_at };
const prd = { number: 7, topic: 'widget', plan: PLAN };

async function context() {
  const github = replay({ pulls: [FEATURE, ...SUB_PULLS] });
  const pulls: RetroPull[] = await listPullsInto(github.octokit, { owner: OWNER, repo: REPO, base: 'feat/widget' });
  return { pr, prd, config, pulls };
}

describe('timeline — gather', () => {
  it('reads when the feature PR was marked ready from its issue events', async () => {
    const github = replay({ events: { 12: FEATURE_EVENTS } });
    const records = await gather(github.octokit, { owner: OWNER, repo: REPO, pr, prd, config, pulls: [] });
    expect(records).toEqual({ readyAt: '2026-09-20T11:50:00Z' });
  });

  it('reads no ready time for a feature PR opened ready, or whose events cannot be read', async () => {
    const opened = replay({ events: { 12: [at(FEATURE_EVENTS, 0, 'the feature PR’s first event')] } });
    expect(await gather(opened.octokit, { owner: OWNER, repo: REPO, pr })).toEqual({ readyAt: null });
    const unreadable = replay();
    expect(await gather(unreadable.octokit, { owner: OWNER, repo: REPO, pr })).toEqual({ readyAt: null });
  });

  it('lets any other GitHub failure fail the step, so Inngest retries it', async () => {
    const github = replay({ events: { 12: FEATURE_EVENTS } });
    const broken = failing(github.octokit, 'GET /repos/{owner}/{repo}/issues/{issue_number}/events');
    await expect(gather(broken, { owner: OWNER, repo: REPO, pr })).rejects.toThrow('GitHub is down');
  });
});

describe('timeline — detect', () => {
  it('counts the feature PR, each slice from its claim to its merge, and the waves as planned and as merged', async () => {
    const { facts } = detect({ readyAt: '2026-09-20T11:50:00Z' }, await context());
    expect(facts.featurePr).toEqual({
      number: 12,
      url: FEATURE.html_url,
      openedAt: '2026-09-20T09:00:00Z',
      readyAt: '2026-09-20T11:50:00Z',
      mergedAt: '2026-09-20T12:00:00Z',
      minutes: 180,
    });
    expect(facts.slices).toEqual([
      { slice: 's1', pr: 13, url: at(SUB_PULLS, 0, 'sub-PR 0').html_url, openedAt: '2026-09-20T09:10:00Z', mergedAt: '2026-09-20T09:40:00Z', closedAt: '2026-09-20T09:40:00Z', minutes: 30, plannedWave: 1, mergedWave: 1 },
      { slice: 's2', pr: 14, url: at(SUB_PULLS, 1, 'sub-PR 1').html_url, openedAt: '2026-09-20T09:45:00Z', mergedAt: '2026-09-20T10:05:00Z', closedAt: '2026-09-20T10:05:00Z', minutes: 20, plannedWave: 2, mergedWave: 2 },
      { slice: 's3', pr: 15, url: at(SUB_PULLS, 2, 'sub-PR 2').html_url, openedAt: '2026-09-20T09:46:00Z', mergedAt: '2026-09-20T11:46:00Z', closedAt: '2026-09-20T11:46:00Z', minutes: 120, plannedWave: 2, mergedWave: 2 },
    ]);
    expect(facts.sliceCount).toBe(3);
    expect(facts.waves).toEqual({ planned: 2, merged: 2 });
    expect(facts.medianMinutes).toBe(30);
    expect(facts.slowFactor).toBe(3);
  });

  it('finds a slice slower than three times the median, with its sub-PR as evidence', async () => {
    const { findings } = detect({ readyAt: null }, await context());
    expect(findings).toEqual([
      {
        id: 'slow-slice:s3',
        kind: 'slow-slice',
        title: 'Slice s3 took far longer than the others',
        happened:
          'Slice s3 took 120 minutes from its claim to its merge, against a median of 30 minutes; the rules flag a slice slower than 3 times the median.',
        evidence: [{ label: '#15', url: at(SUB_PULLS, 2, 'sub-PR 2').html_url }],
      },
    ]);
  });

  it('finds nothing when no slice is that slow', async () => {
    const ctx = await context();
    ctx.pulls = ctx.pulls.filter((pull) => pull.number !== 15);
    expect(detect({ readyAt: null }, ctx).findings).toEqual([]);
  });

  it('keeps a sub-PR closed without merging, with no time, and ignores pull requests that are no slice', async () => {
    const ctx = await context();
    ctx.pulls = [
      ...ctx.pulls,
      { number: 16, title: 'S2 again', url: 'u16', state: 'closed', draft: false, headRef: 'feat/widget--s2', headSha: 'sha16', openedAt: '2026-09-20T10:10:00Z', closedAt: '2026-09-20T10:20:00Z', mergedAt: null, labels: [] },
      { number: 17, title: 'Settle', url: 'u17', state: 'open', draft: false, headRef: 'fix/settle-widget', headSha: 'sha17', openedAt: '2026-09-20T10:30:00Z', closedAt: null, mergedAt: null, labels: [] },
    ];
    const { facts } = detect({ readyAt: null }, ctx);
    expect(facts.slices.map((slice) => [slice.slice, slice.pr, slice.minutes])).toEqual([
      ['s1', 13, 30],
      ['s2', 14, 20],
      ['s3', 15, 120],
      ['s2', 16, null],
    ]);
    expect(facts.sliceCount).toBe(3);
  });

  it('reads the plan’s waves as unknown when the plan has no slice table', async () => {
    const ctx = await context();
    ctx.prd = { ...ctx.prd, plan: '# No table here\n' };
    const { facts } = detect({ readyAt: null }, ctx);
    expect(facts.waves.planned).toBeNull();
    expect(facts.slices[0]?.plannedWave).toBeNull();
  });
});

describe('wavesAsMerged', () => {
  it('starts a wave when a slice is claimed after every slice of the current wave has closed', () => {
    const at = (h: number, m: number) => `2026-09-20T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`;
    const waves = wavesAsMerged([
      { openedAt: at(9, 0), closedAt: at(9, 30) },
      { openedAt: at(9, 35), closedAt: at(10, 0) },
      { openedAt: at(9, 36), closedAt: at(10, 5) },
      { openedAt: at(10, 1), closedAt: at(10, 20) },
      { openedAt: at(10, 30), closedAt: null },
    ]);
    expect(waves).toEqual([1, 2, 2, 2, 3]);
  });
});

describe('timeline — its section', () => {
  it('describes the feature PR, the waves and one row per sub-PR', async () => {
    const { facts } = detect({ readyAt: null }, await context());
    const lines = section(facts);
    expect(lines[0]).toBe(
      `- Feature PR [#12](${FEATURE.html_url}): opened \`2026-09-20T09:00:00Z\`, ready: not known, merged \`2026-09-20T12:00:00Z\`, 180 minutes in all.`,
    );
    expect(lines).toContain('- 3 slices; waves: 2 planned, 2 as merged; median slice: 30 minutes from its claim to its merge.');
    expect(lines).toContain(`| s3 | [#15](${at(SUB_PULLS, 2, 'sub-PR 2').html_url}) | \`2026-09-20T09:46:00Z\` | \`2026-09-20T11:46:00Z\` | 120 | 2 | 2 |`);
  });
});
