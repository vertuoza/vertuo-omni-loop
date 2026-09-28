import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { InngestTestEngine } from '@inngest/test';
import { describe, expect, it } from 'vitest';
import { inngest, RETRO_EVENT } from '../src/inngest-client.mjs';
import { VERDICT_MARKER, createRetro } from '../src/retro/retro.mjs';
import { replayGitHub } from './github-replay.mjs';
import { JUDGE_ENV, judge } from './retro-scenario.mjs';

// PRD 438, recorded (PRD 487, "Test seams"): feature PR #440 and its sub-PRs as GitHub returned them,
// replayed offline through the real retro function with a model reply that keeps nothing. Its retro
// PR (#467) was closed unmerged: every finding repeated a known pattern. Replayed today, the same
// findings end in one comment on #440, and no branch, no PR and no issue.
const FIXTURE = fileURLToPath(new URL('./fixtures/prd-438/', import.meta.url));
const recording = JSON.parse(readFileSync(`${FIXTURE}recording.json`, 'utf8'));

const BRANCH = 'docs/retro-app-sidebar';

async function replay(fetch = judge({ worthIt: false, reason: 'Every finding repeats a pattern the knowledge already names.' })) {
  const github = replayGitHub({ recording: recording.requests });
  const fn = createRetro({ client: inngest, octokitFor: () => github.octokit, env: JUDGE_ENV, fetch });
  const event = {
    name: RETRO_EVENT,
    data: {
      installationId: 1,
      owner: 'vertuoza',
      repo: 'vertuo-omni-loop',
      repository: 'vertuoza/vertuo-omni-loop',
      prNumber: 440,
      mergeSha: recording.mergeSha,
      mergedAt: recording.mergedAt,
    },
  };
  const { result, error } = await new InngestTestEngine({ function: fn, events: [event] }).execute();
  return { github, result, error, fetch, comments: github.state.comments.filter((comment) => comment.issue === 440) };
}

const writes = (github, route) => github.state.requests.filter((request) => request.route === route);

describe('the PRD 438 recording, replayed offline with a reply that keeps nothing', () => {
  it('ends with the verdict comment on #440: no branch, no PR, no issue', async () => {
    const { github, result, error, comments } = await replay();
    expect(error).toBeUndefined();
    expect(result).toMatchObject({ prd: 438, findings: 6, issues: 0, verdict: 'no new lesson', comment: { created: true } });
    expect(writes(github, 'POST /repos/{owner}/{repo}/git/refs')).toEqual([]);
    expect(writes(github, 'POST /repos/{owner}/{repo}/pulls')).toEqual([]);
    expect(writes(github, 'POST /repos/{owner}/{repo}/issues')).toEqual([]);
    expect(github.state.refs.has(`heads/${BRANCH}`)).toBe(false);
    expect(comments).toHaveLength(1);
    expect(comments[0].body.startsWith(`${VERDICT_MARKER}\nRetro: no new lesson — `)).toBe(true);
  });

  it('gives the judge the knowledge base at the merge commit, and the findings the closed retro PR held', async () => {
    const { fetch } = await replay();
    const [asked] = fetch.asked;
    expect(asked.knowledge.length).toBeGreaterThan(0);
    expect(asked.knowledge.map((line) => line.id)).toContain('BR-PRODUCT-33');
    expect(asked.earlierLessons).toEqual([]);
    expect(asked.findings.map((finding) => finding.id)).toContain('churn:apps/galaxy/src/nav/app-bar.css:23-23');
  });

  it('writes the verdict comment pinned beside the recording', async () => {
    const { comments } = await replay();
    const golden = `${FIXTURE}verdict.golden.md`;
    if (process.env.UPDATE_GOLDEN) writeFileSync(golden, comments[0].body);
    expect(comments[0].body).toBe(readFileSync(golden, 'utf8'));
  });

  it('a replay of the replay rewrites the one comment in place', async () => {
    const github = replayGitHub({ recording: recording.requests });
    const run = () =>
      new InngestTestEngine({
        function: createRetro({ client: inngest, octokitFor: () => github.octokit, env: JUDGE_ENV, fetch: judge({ worthIt: false }) }),
        events: [
          {
            name: RETRO_EVENT,
            data: {
              installationId: 1,
              owner: 'vertuoza',
              repo: 'vertuo-omni-loop',
              repository: 'vertuoza/vertuo-omni-loop',
              prNumber: 440,
              mergeSha: recording.mergeSha,
              mergedAt: recording.mergedAt,
            },
          },
        ],
      }).execute();
    await run();
    await run();
    expect(github.state.comments.filter((comment) => comment.issue === 440)).toHaveLength(1);
    expect(writes(github, 'PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}')).toHaveLength(1);
  });
});
