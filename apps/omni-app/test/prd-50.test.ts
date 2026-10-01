// @ts-nocheck
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { InngestTestEngine } from '@inngest/test';
import { describe, expect, it } from 'vitest';
import { inngest, RETRO_EVENT } from '../src/inngest-client.ts';
import { createRetro } from '../src/retro/retro.ts';
import { replayGitHub } from './github-replay.ts';

// PRD 50, recorded (PRD 72, "Test seams"): feature PR #51 and its sub-PRs as GitHub returned them,
// replayed offline through the real retro function. The recording is read here and by later slices;
// none of them writes to it. Without a model key the retro is not judged, so since PRD 487 it ends
// with one comment on #51 instead of a retro PR.
const FIXTURE = fileURLToPath(new URL('./fixtures/prd-50/', import.meta.url));
const recording = JSON.parse(readFileSync(`${FIXTURE}recording.json`, 'utf8'));

const FOLDER = '.omni-loop/delivery/shipped/0050-question-intros';
const BRANCH = 'docs/retro-question-intros';

/** The retro of #51 against the recording, not yet run. */
function engine() {
  const github = replayGitHub({ recording: recording.requests });
  const fn = createRetro({ client: inngest, octokitFor: () => github.octokit, env: {} });
  const event = {
    name: RETRO_EVENT,
    data: {
      installationId: 1,
      owner: 'vertuoza',
      repo: 'vertuo-omni-loop',
      repository: 'vertuoza/vertuo-omni-loop',
      prNumber: 51,
      mergeSha: recording.mergeSha,
      mergedAt: '2026-09-25T14:44:12Z',
    },
  };
  return { github, run: new InngestTestEngine({ function: fn, events: [event] }) };
}

async function replay() {
  const { github, run } = engine();
  const { result, error } = await run.execute();
  const comments = github.state.comments.filter((comment) => comment.issue === 51);
  return { github, result, error, comments };
}

/** The fact sheet the replay counts, from its step "facts". */
async function sheet() {
  const { result } = await engine().run.executeStep('facts');
  return result;
}

describe('the PRD 50 recording, replayed offline', () => {
  it('qualifies #51 as the feature PR of PRD 50, shipped, and opens no retro PR: nothing was judged', async () => {
    const { github, result, error, comments } = await replay();
    expect(error).toBeUndefined();
    expect(result).toMatchObject({ prd: 50, findings: 0, issues: 0, verdict: 'not judged', comment: { created: true } });
    expect(github.state.refs.has(`heads/${BRANCH}`)).toBe(false);
    expect(github.state.pulls.filter((pull) => pull.head.ref === BRANCH)).toEqual([]);
    expect(comments).toHaveLength(1);
    expect((await sheet()).prd).toEqual({
      number: 50,
      title: 'A joke around every outbox question — an intro and a punchline',
      topic: 'question-intros',
      state: 'shipped',
      folder: FOLDER,
    });
  });

  it('counts 3 slices in 2 waves, as planned and as merged', async () => {
    const timeline = (await sheet()).kinds.timeline;
    expect(timeline.sliceCount).toBe(3);
    expect(timeline.waves).toEqual({ planned: 2, merged: 2 });
    expect(timeline.slices.map((slice) => [slice.slice, slice.pr, slice.minutes, slice.plannedWave, slice.mergedWave])).toEqual([
      ['s1', 54, 13, 1, 1],
      ['s2', 56, 20, 2, 2],
      ['s3', 57, 21, 2, 2],
    ]);
    expect(timeline.medianMinutes).toBe(20);
    expect(timeline.featurePr).toMatchObject({ number: 51, minutes: 62, readyAt: null });
  });

  it('finds no slow slice, and says "Retro: not judged — no model key" without a model key', async () => {
    expect((await sheet()).findings).toEqual([]);
    const { comments } = await replay();
    expect(comments[0].body).toContain('\nRetro: not judged — no model key\n');
  });

  it('writes the verdict comment pinned beside the recording', async () => {
    const { comments } = await replay();
    const golden = `${FIXTURE}verdict.golden.md`;
    if (process.env.UPDATE_GOLDEN) writeFileSync(golden, comments[0].body);
    expect(comments[0].body).toBe(readFileSync(golden, 'utf8'));
  });
});
