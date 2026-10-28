import { describe, expect, it } from 'vitest';
import type { JobPart } from '../runners.contract';
import { jobAgentWords, modelWords, partLines } from './parts';

// A job's agent and parts on the Runners page (PRD 2537 s3): the agent and model beside its status, and one line per
// part under a job that turned over to another account.

const LIMIT: JobPart = {
  agent: 'claude', model: 'claude-opus-5-5', account: 'claude-1', from: '2026-10-27T13:41:02.000Z', to: '2026-10-27T14:02:11.000Z',
  ended: 'limit', resetsAt: '2026-10-27T18:00:00.000Z', guessed: false, note: 'runner',
};
const RUNNING: JobPart = { agent: 'codex', model: 'gpt-5-codex', account: 'codex-1', from: '2026-10-27T14:02:15.000Z', to: null, ended: null };

describe("a model's name", () => {
  it.each([
    ['claude-opus-5-5', 'Opus 5.5'],
    ['claude-sonnet-4-5-20250929', 'Sonnet 4.5'],
    ['claude-haiku-4-5', 'Haiku 4.5'],
    ['claude-opus-5-5[1m]', 'Opus 5.5 (1M)'],
    ['gpt-5-codex', 'gpt-5-codex'],
    ['mistral/devstral-medium-latest', 'mistral/devstral-medium-latest'],
  ])('reads %s as %s', (model, words) => {
    expect(modelWords(model)).toBe(words);
  });
});

describe("a job's agent", () => {
  it('names the agent and model of its last part, the agent alone when it named no model', () => {
    expect(jobAgentWords({ parts: [LIMIT, RUNNING] })).toBe('codex · gpt-5-codex');
    expect(jobAgentWords({ parts: [LIMIT] })).toBe('claude · Opus 5.5');
    expect(jobAgentWords({ parts: [{ ...RUNNING, agent: 'claude', model: null }] })).toBe('claude');
  });

  it('names none for a job whose runner reported no part', () => {
    expect(jobAgentWords({ parts: null })).toBeNull();
    expect(jobAgentWords({})).toBeNull();
    expect(jobAgentWords({ parts: [] })).toBeNull();
  });
});

describe("a job's parts", () => {
  it('gives one line per part of a job that turned over: the account, the model, when, and why it ended', () => {
    expect(partLines({ parts: [LIMIT, RUNNING] })).toEqual([
      { text: 'claude-1 · Opus 5.5 · 13:41–14:02 · usage limit', title: 'claude, claude-1 out until 18:00 UTC' },
      { text: 'codex-1 · gpt-5-codex · since 14:02', title: 'codex, running' },
    ]);
  });

  it.each([
    ['usage', 'usage warning'],
    ['context', 'context full'],
    ['done', 'done'],
    ['failed', 'failed'],
  ] as const)('reads a part that ended on %s as %s', (ended, words) => {
    const [, second] = partLines({ parts: [LIMIT, { ...RUNNING, to: '2026-10-27T14:30:00.000Z', ended }] });
    expect(second?.text).toBe(`codex-1 · gpt-5-codex · 14:02–14:30 · ${words}`);
  });

  it('says when a reset was guessed, and names an account with no model by its id alone', () => {
    const [first] = partLines({ parts: [{ ...LIMIT, model: null, guessed: true }, RUNNING] });
    expect(first).toEqual({ text: 'claude-1 · 13:41–14:02 · usage limit', title: 'claude, claude-1 out until 18:00 UTC (guessed)' });
  });

  it('gives no line for a job that ran on one account, or reported none', () => {
    expect(partLines({ parts: [LIMIT] })).toEqual([]);
    expect(partLines({ parts: null })).toEqual([]);
  });
});
