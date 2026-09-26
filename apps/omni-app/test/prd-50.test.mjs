import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { InngestTestEngine } from '@inngest/test';
import { describe, expect, it } from 'vitest';
import { inngest, RETRO_EVENT } from '../src/inngest-client.mjs';
import { createRetro } from '../src/retro/retro.mjs';
import { replayGitHub } from './github-replay.mjs';

// PRD 50, recorded (PRD 72, "Test seams"): feature PR #51 and its sub-PRs as GitHub returned them,
// replayed offline through the real retro function. The recording is read here and by later slices;
// none of them writes to it.
const FIXTURE = fileURLToPath(new URL('./fixtures/prd-50/', import.meta.url));
const recording = JSON.parse(readFileSync(`${FIXTURE}recording.json`, 'utf8'));

const FOLDER = '.omni-loop/delivery/shipped/0050-question-intros';
const BRANCH = 'docs/retro-question-intros';

async function replay() {
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
  const { result, error } = await new InngestTestEngine({ function: fn, events: [event] }).execute();
  const files = github.filesAt(BRANCH, [`${FOLDER}/retro.md`, `${FOLDER}/retro.json`]);
  return { github, result, error, markdown: files[`${FOLDER}/retro.md`], doc: JSON.parse(files[`${FOLDER}/retro.json`]) };
}

describe('the PRD 50 recording, replayed offline', () => {
  it('qualifies #51 as the feature PR of PRD 50, shipped, and publishes its retro', async () => {
    const { result, error, doc } = await replay();
    expect(error).toBeUndefined();
    expect(result).toMatchObject({ prd: 50, branch: BRANCH, committed: true, pr: { created: true } });
    expect(doc.runs[0].prd).toEqual({
      number: 50,
      title: 'A joke around every outbox question — an intro and a punchline',
      topic: 'question-intros',
      state: 'shipped',
      folder: FOLDER,
    });
  });

  it('counts 3 slices in 2 waves, as planned and as merged', async () => {
    const { doc } = await replay();
    const timeline = doc.runs[0].kinds.timeline;
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

  it('finds no slow slice, and goes out facts only without a model key', async () => {
    const { doc, markdown } = await replay();
    expect(doc.runs[0].findings).toEqual([]);
    expect(markdown).toContain('\nFacts only: no model key\n');
  });

  it('writes no number in retro.md that retro.json does not hold', async () => {
    const { github, markdown } = await replay();
    const json = github.filesAt(BRANCH, [`${FOLDER}/retro.json`])[`${FOLDER}/retro.json`];
    const held = new Set(json.match(/\d+/g));
    expect((markdown.match(/\d+/g) ?? []).filter((n) => !held.has(n))).toEqual([]);
  });

  it('writes the retro pinned beside the recording', async () => {
    const { markdown } = await replay();
    const golden = `${FIXTURE}retro.golden.md`;
    if (process.env.UPDATE_GOLDEN) writeFileSync(golden, markdown);
    expect(markdown).toBe(readFileSync(golden, 'utf8'));
  });
});
