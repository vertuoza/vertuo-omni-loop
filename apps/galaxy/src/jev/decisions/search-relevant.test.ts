import { describe, expect, it, vi } from 'vitest';
import { sure } from '../../arcade/test/sure';
import { JEV_DECISIONS, jevEntry } from './index';
import { RELEVANT_FROM, searchRelevant, searchRelevantInput } from './search-relevant';

vi.mock('server-only', () => ({}));

// `search-relevant` (PRD omni-loop-8 s3): a Noul "does this entry answer the question?", a right answer at
// 0.6 or more; it sends the question and one entry's title and text, nothing else.

describe('search-relevant', () => {
  it('is registered and listed on Settings › Jev with what it sends', () => {
    expect(jevEntry('search-relevant')).toBe(searchRelevant);
    const row = sure(JEV_DECISIONS.find((d) => d.name === 'search-relevant'), 'the search-relevant row');
    expect(row.sends).toMatch(/question/);
    expect(row.sends).toMatch(/title and text/);
    expect(row.sends).toMatch(/never a person, a key/);
    expect(searchRelevant.question.type).toBe('noul');
  });

  it('answers true from 0.6, false under it, whatever a lower setting says', () => {
    expect(RELEVANT_FROM).toBe(0.6);
    expect(searchRelevant.value(0.6, { threshold: 0.5 })).toBe(true);
    expect(searchRelevant.value(0.59, { threshold: 0.5 })).toBe(false);
    expect(searchRelevant.value(0.55, { threshold: 0.1 })).toBe(false);
  });

  it('lets a workspace raise the bar, never lower it', () => {
    expect(searchRelevant.value(0.7, { threshold: 0.8 })).toBe(false);
    expect(searchRelevant.value(0.8, { threshold: 0.8 })).toBe(true);
  });

  it('leaves an answer outside the question unanswered', () => {
    expect(searchRelevant.value('yes', { threshold: 0.5 })).toBeNull();
    expect(searchRelevant.value(1.2, { threshold: 0.5 })).toBeNull();
    expect(searchRelevant.value(Number.NaN, { threshold: 0.5 })).toBeNull();
    expect(searchRelevant.show(true)).toBe('true');
  });

  it('sends the question, the entry\'s title and its text, and nothing else', () => {
    const input = sure(searchRelevantInput({ question: 'can a quote go out unpaid', title: 'BL-QUOTES-1', text: 'A quote needs a payment term.' }), 'the input');
    expect(searchRelevant.state(input)).toBe('Question: can a quote go out unpaid\nEntry: BL-QUOTES-1\nA quote needs a payment term.');
    expect(searchRelevantInput({ question: 'q', title: 't', text: 'x', key: 'secret' })).toBeNull();
    expect(searchRelevantInput({ question: '', title: 't', text: 'x' })).toBeNull();
  });
});
