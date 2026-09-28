import { describe, expect, it } from 'vitest';
import { replayGitHub } from '../../test/github-replay.mjs';
import { upsertComment } from './verdict-comment.mjs';

const at = { owner: 'acme', repo: 'widgets', prNumber: 43 };
const MARKER = '<!-- omni-outbox-knowledge-verdict -->';
const on = (github, issue = 43) => github.state.comments.filter((comment) => comment.issue === issue);
const writes = (github) => github.state.requests.filter((r) => !r.route.startsWith('GET ')).map((r) => r.route);

describe('verdict-comment — one marked comment per pull request', () => {
  it('creates the comment, marker first, when the pull request has none', async () => {
    const github = replayGitHub();
    const result = await upsertComment(github.octokit, { ...at, marker: MARKER, text: 'Knowledge: nothing new.' });
    expect(on(github)).toEqual([{ id: result.commentId, issue: 43, body: `${MARKER}\nKnowledge: nothing new.\n` }]);
    expect(result.created).toBe(true);
  });

  it('edits the marked comment in place, never a second one', async () => {
    const github = replayGitHub();
    const first = await upsertComment(github.octokit, { ...at, marker: MARKER, text: 'first' });
    const second = await upsertComment(github.octokit, { ...at, marker: MARKER, text: 'second' });
    expect(on(github)).toHaveLength(1);
    expect(on(github)[0].body).toBe(`${MARKER}\nsecond\n`);
    expect(second).toEqual({ commentId: first.commentId, created: false });
    expect(writes(github)).toEqual([
      'POST /repos/{owner}/{repo}/issues/{issue_number}/comments',
      'PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}',
    ]);
  });

  it('leaves comments carrying another marker, or none, as they are', async () => {
    const github = replayGitHub();
    await github.octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
      owner: at.owner,
      repo: at.repo,
      issue_number: 43,
      body: 'a person wrote this',
    });
    const other = '<!-- omni-outbox-retro-verdict -->';
    await upsertComment(github.octokit, { ...at, marker: other, text: 'Retro: no new lesson.' });
    await upsertComment(github.octokit, { ...at, marker: MARKER, text: 'Knowledge: nothing new.' });
    await upsertComment(github.octokit, { ...at, marker: MARKER, text: 'Knowledge: still nothing.' });
    expect(on(github).map((comment) => comment.body)).toEqual([
      'a person wrote this',
      `${other}\nRetro: no new lesson.\n`,
      `${MARKER}\nKnowledge: still nothing.\n`,
    ]);
  });

  it('never touches another pull request', async () => {
    const github = replayGitHub();
    await upsertComment(github.octokit, { ...at, prNumber: 45, marker: MARKER, text: 'elsewhere' });
    await upsertComment(github.octokit, { ...at, marker: MARKER, text: 'here' });
    expect(on(github, 45).map((comment) => comment.body)).toEqual([`${MARKER}\nelsewhere\n`]);
    expect(on(github).map((comment) => comment.body)).toEqual([`${MARKER}\nhere\n`]);
  });
});
