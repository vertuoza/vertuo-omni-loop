// PRD 1162, slice s6: a roadmap's answers, written as a marked comment and read back from the issue.
import { describe, expect, it } from 'vitest';
import { parseCommentId } from '../ids.ts';
import { ANSWER_MAX, answerComment, answerMarker, answerOf, readAnswers } from './answers.ts';

const comment = (id: number, body: string | null) => ({ id: parseCommentId(id), body });

describe('a roadmap answer comment', () => {
  it('opens with the marker, names the question, then carries the answer', () => {
    expect(answerComment('Q5', '  yes, a trial week  ')).toBe('<!-- omni-roadmap-answer: Q5 -->\n**Q5**, answered:\n\nyes, a trial week\n');
    expect(answerMarker('P1.2')).toBe('<!-- omni-roadmap-answer: P1.2 -->');
  });

  it('is read back as the question and the answer it records', () => {
    expect(answerOf(answerComment('Q5', 'yes\n\nand a second line'))).toEqual({ question: 'Q5', answer: 'yes\n\nand a second line' });
  });

  it('reads an answer written under the marker without the heading', () => {
    expect(answerOf('<!-- omni-roadmap-answer: Q2 -->\nno')).toEqual({ question: 'Q2', answer: 'no' });
  });

  it('records nothing without the marker on the first line, or with nothing after it', () => {
    expect(answerOf('yes')).toBeNull();
    expect(answerOf('see below\n<!-- omni-roadmap-answer: Q5 -->\nyes')).toBeNull();
    expect(answerOf('<!-- omni-roadmap-answer: Q5 -->\n**Q5**, answered:\n\n')).toBeNull();
    expect(answerOf('<!-- omni-roadmap-answer: not an id! -->\nyes')).toBeNull();
  });

  it('cuts an answer longer than the app stores', () => {
    expect(answerOf(answerComment('Q5', 'x'.repeat(ANSWER_MAX + 50)))?.answer).toHaveLength(ANSWER_MAX);
  });
});

describe('readAnswers', () => {
  it('keeps the latest answer per question and ignores unmarked comments', () => {
    const answers = readAnswers([
      comment(1, answerComment('Q5', 'no')),
      comment(2, 'I think yes, but let us wait'),
      comment(3, answerComment('Q2', 'the default')),
      comment(4, null),
      comment(5, answerComment('Q5', 'yes')),
    ]);
    expect([...answers]).toEqual([['Q5', 'yes'], ['Q2', 'the default']]);
  });

  it('reads none from an issue without answers', () => {
    expect(readAnswers([comment(1, 'hello')]).size).toBe(0);
  });
});
