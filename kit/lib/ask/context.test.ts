import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { askContext, prdOfBranch, readTranscript, sessionContext } from './context.ts';

const line = (entry: unknown) => JSON.stringify(entry);
const user = (content: unknown) => line({ type: 'user', message: { role: 'user', content } });
const assistant = (id: unknown, model: unknown, usage: unknown) => line({ type: 'assistant', message: { id, model, role: 'assistant', usage } });
const usage = (input: unknown, output: unknown, cacheRead: unknown = 0, cacheWrite: unknown = 0) => ({
  input_tokens: input,
  output_tokens: output,
  cache_read_input_tokens: cacheRead,
  cache_creation_input_tokens: cacheWrite,
});

const TRANSCRIPT = [
  user('<command-name>/omni:plan</command-name>\n<command-args>7</command-args>'),
  assistant('msg_1', 'claude-sonnet-4-5', usage(10, 5, 100, 20)),
  // One message streamed as two entries: the same id, counted once.
  assistant('msg_1', 'claude-sonnet-4-5', usage(10, 5, 100, 20)),
  user([{ type: 'text', text: '<command-message>omni:brainstorm</command-message>\n<command-name>/omni:brainstorm</command-name>' }]),
  user([{ type: 'tool_result', content: 'ok' }]),
  assistant('msg_2', 'claude-opus-4-1', usage(3, 7, 50, 0)),
  line({ type: 'summary', summary: 'no message here' }),
].join('\n');

describe('readTranscript', () => {
  it('finds the last command, the last model, and sums the tokens with each message id counted once', () => {
    expect(readTranscript(TRANSCRIPT)).toEqual({
      skill: '/omni:brainstorm',
      model: 'claude-opus-4-1',
      tokens: { input: 13, output: 12, cacheRead: 150, cacheWrite: 20 },
    });
  });

  it('skips a malformed line and keeps the rest', () => {
    const text = `${TRANSCRIPT}\n{not json\n\n${assistant('msg_3', 'claude-haiku-4-5', usage(1, 1))}`;
    expect(readTranscript(text)).toEqual({
      skill: '/omni:brainstorm',
      model: 'claude-haiku-4-5',
      tokens: { input: 14, output: 13, cacheRead: 150, cacheWrite: 20 },
    });
  });

  it('gives nulls for a transcript with no command, no model and no usage', () => {
    expect(readTranscript(user('hello'))).toEqual({ skill: null, model: null, tokens: null });
    expect(readTranscript('')).toEqual({ skill: null, model: null, tokens: null });
    expect(readTranscript(null)).toEqual({ skill: null, model: null, tokens: null });
  });
});

describe('prdOfBranch', () => {
  const branches = { feature: 'feat/{topic}', slice: 'feat/{topic}--{slice}' };
  const folders = ['0007-ask-mode', '0144-question-history', 'README.md'];

  it('reads the PRD number from a feature branch or a slice branch and the inbox folder of its topic', () => {
    expect(prdOfBranch('feat/question-history', { branches, folders })).toBe(144);
    expect(prdOfBranch('feat/question-history--s1', { branches, folders })).toBe(144);
    expect(prdOfBranch('feat/ask-mode', { branches, folders })).toBe(7);
  });

  it('is null for a branch outside the loop\'s shapes, a topic with no folder, or no branch', () => {
    expect(prdOfBranch('main', { branches, folders })).toBeNull();
    expect(prdOfBranch('fix/ask-mode', { branches, folders })).toBeNull();
    expect(prdOfBranch('feat/unknown-topic', { branches, folders })).toBeNull();
    expect(prdOfBranch(null, { branches, folders })).toBeNull();
  });
});

const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\n';

function checkout(branch: string | null, files: Record<string, string> = {}) {
  const repo = makeRepo({
    git: true,
    files: {
      '.omni-loop/config.yml': CONFIG,
      '.omni-loop/delivery/inbox/0144-question-history/spec.md': '# spec\n',
      'transcript.jsonl': TRANSCRIPT,
      ...files,
    },
  });
  if (branch) execFileSync('git', ['checkout', '-q', '-b', branch], { cwd: repo.root, stdio: 'ignore' });
  return repo;
}

describe('askContext', () => {
  it('reads the repo, branch, PRD, Claude session, skill, model and tokens', () => {
    const { root } = checkout('feat/question-history--s1');
    const input = { session_id: 'claude-session-1', transcript_path: `${root}/transcript.jsonl`, cwd: root };
    expect(askContext({ root, input })).toEqual({
      repo: 'acme/widgets',
      branch: 'feat/question-history--s1',
      prd: 144,
      claudeSessionId: 'claude-session-1',
      skill: '/omni:brainstorm',
      model: 'claude-opus-4-1',
      tokens: { input: 13, output: 12, cacheRead: 150, cacheWrite: 20 },
    });
  });

  it('gives nulls, never a throw, for a missing transcript, a detached HEAD and no session id', () => {
    const { root } = checkout(null);
    execFileSync('git', ['checkout', '-q', '--detach'], { cwd: root, stdio: 'ignore' });
    expect(askContext({ root, input: { transcript_path: `${root}/nowhere.jsonl` } })).toEqual({
      repo: 'acme/widgets',
      branch: null,
      prd: null,
      claudeSessionId: null,
      skill: null,
      model: null,
      tokens: null,
    });
  });

  it('gives nulls for a branch outside the loop\'s shapes, a broken config, and no git at all', () => {
    const { root } = checkout('wip/something', { '.omni-loop/config.yml': 'kit: [broken' });
    const context = askContext({ root, input: {} });
    expect(context).toMatchObject({ repo: null, branch: 'wip/something', prd: null });

    const bare = makeRepo({ files: { '.omni-loop/config.yml': CONFIG } });
    expect(askContext({ root: bare.root, input: null })).toMatchObject({ repo: 'acme/widgets', branch: null, prd: null });
  });

  it('never throws, even when git itself cannot run', () => {
    const { root } = checkout('feat/question-history');
    const exec = () => { throw new Error('no git'); };
    expect(askContext({ root, input: {}, exec })).toMatchObject({ repo: 'acme/widgets', branch: null, prd: null });
  });
});

describe('sessionContext', () => {
  it('carries the repo slug, or null when the config cannot give one', () => {
    expect(sessionContext(checkout(null).root)).toEqual({ repo: 'acme/widgets' });
    expect(sessionContext(makeRepo({ files: { '.omni-loop/config.yml': 'kit: [broken' } }).root)).toEqual({ repo: null });
  });
});
