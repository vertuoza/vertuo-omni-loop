// The question file's one schema (PRD 1831, s1): `AskUserQuestion`'s input shape, plus an optional
// `lead` and `context`. Unknown fields are refused, and every refusal names its field.
import { describe, expect, it } from 'vitest';
import { readQuestionFile } from './schema.ts';

const QUESTION = {
  question: 'Which colour?',
  header: 'Colour',
  options: [{ label: 'Red', description: 'warm' }, { label: 'Blue', description: 'cold' }],
  multiSelect: false,
};

describe('readQuestionFile', () => {
  it('takes AskUserQuestion\'s input as it is', () => {
    expect(readQuestionFile({ questions: [QUESTION] })).toEqual({ ok: true, value: { questions: [QUESTION] } });
  });

  it('takes an optional lead and context', () => {
    const file = { questions: [QUESTION], lead: 'Before I build it:', context: { skill: 'omni:brainstorm', model: 'gpt-5' } };
    expect(readQuestionFile(file)).toEqual({ ok: true, value: file });
  });

  it('takes a context whose skill or model is null', () => {
    const file = { questions: [QUESTION], context: { skill: null, model: null } };
    expect(readQuestionFile(file)).toEqual({ ok: true, value: file });
  });

  it.each([
    ['a file that is not an object', [], '(file)'],
    ['no questions', {}, 'questions'],
    ['an empty list of questions', { questions: [] }, 'questions'],
    ['a question with no text', { questions: [{ ...QUESTION, question: '' }] }, 'questions.0.question'],
    ['a question with no header', { questions: [{ ...QUESTION, header: undefined }] }, 'questions.0.header'],
    ['an option with no label', { questions: [{ ...QUESTION, options: [{ description: 'warm' }] }] }, 'questions.0.options.0.label'],
    ['multiSelect that is not a boolean', { questions: [{ ...QUESTION, multiSelect: 'no' }] }, 'questions.0.multiSelect'],
    ['a lead that is not text', { questions: [QUESTION], lead: 3 }, 'lead'],
    ['an unknown field at the top', { questions: [QUESTION], tokens: 12 }, 'tokens'],
    ['an unknown field in a question', { questions: [{ ...QUESTION, colour: 'red' }] }, 'questions.0.colour'],
    ['an unknown field in an option', { questions: [{ ...QUESTION, options: [{ label: 'Red', description: 'warm', icon: 'x' }] }] }, 'questions.0.options.0.icon'],
    ['an unknown field in the context', { questions: [QUESTION], context: { skill: 's', repo: 'a/b' } }, 'context.repo'],
  ])('refuses %s, naming the field', (_, file, name) => {
    const read = readQuestionFile(file);
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.field).toBe(name);
  });
});
