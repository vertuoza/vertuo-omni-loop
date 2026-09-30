import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '../../ask/classify';
import { questionCategory } from './question-category';
import { JEV_DECISIONS, jevEntry } from './index';

// The question category's registry entry (PRD 812 s2): a Choice over the six categories, what it
// sends Jev (what Haiku reads today, never an option's preview), and how an answer maps back.

const TUNING = { threshold: 0.5 };
const INPUT = {
  questions: [
    { question: 'Which storage should the sessions use?', header: 'Storage', options: [
      { label: 'Postgres', description: 'Row-level security per owner.', preview: 'create table secret_preview ();' },
    ] },
  ],
  context: { repo: 'vertuoza/vertuo-omni-loop', branch: 'feat/x', prd: 144, skill: '/omni:brainstorm' },
};

describe('question-category', () => {
  it('asks a Choice whose options are the six categories, in order, each with what it holds', () => {
    const q = questionCategory.question;
    expect(q.type).toBe('choice');
    if (q.type !== 'choice') return;
    expect(q.options.map((o) => o.key)).toEqual([...CATEGORIES]);
    expect(q.options.every((o) => o.description.length > 0)).toBe(true);
    expect(q.instructions).toMatch(/category/i);
  });

  it('gives Jev the round\'s questions, options and context, and never an option\'s preview', () => {
    const state = questionCategory.state(INPUT);
    expect(typeof state).toBe('string');
    expect(state).toContain('Question (Storage): Which storage should the sessions use?');
    expect(state).toContain('- Postgres: Row-level security per owner.');
    expect(state).toContain('repository vertuoza/vertuo-omni-loop');
    expect(state).not.toContain('secret_preview');
  });

  it('maps each Choice to its category', () => {
    for (const c of CATEGORIES) expect(questionCategory.value(c, TUNING)).toBe(c);
    expect(questionCategory.show('ux-ui')).toBe('ux-ui');
  });

  it('refuses a key outside the options, and a number', () => {
    expect(questionCategory.value('pricing', TUNING)).toBeNull();
    expect(questionCategory.value('Business', TUNING)).toBeNull();
    expect(questionCategory.value(0.7, TUNING)).toBeNull();
  });
});

describe('the registry', () => {
  it('lists the three decisions in order, bug-risk still coming', () => {
    expect(JEV_DECISIONS.map((d) => [d.name, Boolean(jevEntry(d.name))])).toEqual([
      ['question-category', true], ['outbox-risk', true], ['bug-risk', false],
    ]);
    expect(JEV_DECISIONS.every((d) => d.title && d.sends)).toBe(true);
    expect(jevEntry('question-category')).toBe(questionCategory);
    expect(jevEntry('nope')).toBeNull();
  });
});
