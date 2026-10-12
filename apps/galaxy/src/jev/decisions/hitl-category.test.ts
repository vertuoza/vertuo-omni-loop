import { describe, expect, it } from 'vitest';
import { HUMAN_WORK_KINDS } from '../../roadmap/store';
import { hitlCategory, type HitlInput } from './hitl-category';
import { JEV_DECISIONS, jevEntry } from './index';

// The human work's kind (PRD 1217 s3): a Choice over the four kinds, what it sends Jev (the entry's
// source, text, act and repository, and its PRD's title), and how an answer maps back.

const TUNING = { threshold: 0.5 };
const SECRET: HitlInput = {
  source: 'outbox', text: 'The worker needs a token to read the crew queue',
  act: 'Add CREW_QUEUE_TOKEN to the repository secrets.', repo: 'ai-domain', prdTitle: 'Stateless think endpoint',
};

describe('hitl-category', () => {
  it('asks a Choice whose options are the four kinds, in order, each with what it holds', () => {
    const q = hitlCategory.question;
    expect(q.type).toBe('choice');
    if (q.type !== 'choice') return;
    expect(q.options.map((o) => o.key)).toEqual([...HUMAN_WORK_KINDS]);
    expect(q.options.find((o) => o.key === 'dev-ops')?.description).toContain('a secret, a token scope, a grant');
    expect(q.options.find((o) => o.key === 'delivery-ops')?.description).toContain('a deploy, a migration run, a console step');
    expect(q.instructions).toMatch(/human work/i);
  });

  it('gives Jev the source, the repository, the PRD\'s title, the text and the act', () => {
    expect(hitlCategory.state(SECRET)).toBe([
      'Source: a decision a coding agent could not take alone (an outbox item)',
      'Repository: ai-domain',
      'PRD: Stateless think endpoint',
      'Work: The worker needs a token to read the crew queue',
      'What a person must do: Add CREW_QUEUE_TOKEN to the repository secrets.',
    ].join('\n'));
  });

  it('leaves out an act and a PRD it does not have', () => {
    const state = hitlCategory.state({ source: 'question', text: 'Who signs a mandate?', act: null, repo: 'acme/plan', prdTitle: null });
    expect(state).toBe('Source: an open question of the roadmap, for a person\nRepository: acme/plan\nWork: Who signs a mandate?');
  });

  it('keeps an answer among the four kinds', () => {
    for (const kind of HUMAN_WORK_KINDS) expect(hitlCategory.value(kind, TUNING)).toBe(kind);
    expect(hitlCategory.show('dev-ops')).toBe('dev-ops');
  });

  it('drops any other answer: another word, another case, a number', () => {
    expect(hitlCategory.value('legal', TUNING)).toBeNull();
    expect(hitlCategory.value('Business', TUNING)).toBeNull();
    expect(hitlCategory.value('dev ops', TUNING)).toBeNull();
    expect(hitlCategory.value(0.7, TUNING)).toBeNull();
  });

  it('is registered, made in Galaxy only, and listed sixth on Settings › Jev', () => {
    expect(jevEntry('hitl-category')).toBe(hitlCategory);
    expect(hitlCategory.terminal).toBeUndefined();
    const row = JEV_DECISIONS[5];
    expect(row?.name).toBe('hitl-category');
    expect(row?.sends).toMatch(/source, text, act and repository/);
  });
});
