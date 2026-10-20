// What a runner job asks the person (PRD 2255, s2): the questions file `omni runner ask` reads, held to the
// limits the Omni app's route holds it to, and the line a skill posts once they are stored.
import { describe, expect, it } from 'vitest';
import { answerLink, MAX_OPTIONS, MAX_QUESTIONS, MIN_OPTIONS, readJobQuestions, waitingLine } from './questions.ts';

const option = (label: string) => ({ label, description: `${label}, in one line` });

/** One question, as `omni ask question --file` reads it, with `options` options. */
const question = (header: string, options = 3) => ({
  question: `How should ${header} behave?`,
  header,
  options: Array.from({ length: options }, (_, index) => option(`Fix ${String(index + 1)}`)),
  multiSelect: false,
});

describe('readJobQuestions', () => {
  it('reads 1 to 4 questions, each with a header and 2 to 4 options, in the file shape omni ask reads', () => {
    expect([MAX_QUESTIONS, MIN_OPTIONS, MAX_OPTIONS]).toEqual([4, 2, 4]);
    const one = [question('Planning')];
    expect(readJobQuestions({ questions: one })).toEqual({ ok: true, value: one });
    const four = Array.from({ length: 4 }, (_, index) => question(`Header ${String(index)}`, index === 0 ? 2 : 4));
    expect(readJobQuestions({ questions: four })).toEqual({ ok: true, value: four });
  });

  it('refuses more than 4 questions, and none', () => {
    const five = Array.from({ length: 5 }, (_, index) => question(`Header ${String(index)}`));
    expect(readJobQuestions({ questions: five })).toEqual({ ok: false, field: 'questions', message: 'at most 4 questions, got 5' });
    expect(readJobQuestions({ questions: [] })).toMatchObject({ ok: false, field: 'questions' });
  });

  it('refuses a question with fewer than 2 options or more than 4, naming it', () => {
    expect(readJobQuestions({ questions: [question('A'), question('B', 1)] })).toEqual({ ok: false, field: 'questions.1.options', message: '2 to 4 options, got 1' });
    expect(readJobQuestions({ questions: [question('A', 5)] })).toEqual({ ok: false, field: 'questions.0.options', message: '2 to 4 options, got 5' });
  });

  it('refuses an option with no label, naming the field as omni ask does', () => {
    const bad = { ...question('A'), options: [option('One'), { label: '', description: 'nothing' }] };
    expect(readJobQuestions({ questions: [bad] })).toMatchObject({ ok: false, field: 'questions.0.options.1.label' });
  });

  it('refuses a question with no header, blank or missing', () => {
    expect(readJobQuestions({ questions: [question('  ')] })).toEqual({ ok: false, field: 'questions.0.header', message: 'a header is needed' });
    const headless = { question: 'How should it behave?', options: question('A').options, multiSelect: false };
    expect(readJobQuestions({ questions: [headless] })).toMatchObject({ ok: false, field: 'questions.0.header' });
  });

  it('refuses a field omni ask does not know, and a file that is no object', () => {
    expect(readJobQuestions({ questions: [question('A')], extra: 1 })).toMatchObject({ ok: false, field: 'extra' });
    expect(readJobQuestions('questions')).toMatchObject({ ok: false, field: '(file)' });
  });
});

describe('the link and the line a stopped skill posts', () => {
  it("opens the Runners page on the job's drawer, whether or not the Omni page ends in a slash", () => {
    expect(answerLink('https://omni.test', 'job-7')).toBe('https://omni.test/app/runners?answer=job-7');
    expect(answerLink('https://omni.test//', 'job-7')).toBe('https://omni.test/app/runners?answer=job-7');
    expect(answerLink('https://omni.test', 'a b/c')).toBe('https://omni.test/app/runners?answer=a+b%2Fc');
  });

  it('says what the job waits for, with the link', () => {
    expect(waitingLine('https://omni.test', 'job-7')).toBe('Waiting for an answer on Omni: https://omni.test/app/runners?answer=job-7');
  });
});
