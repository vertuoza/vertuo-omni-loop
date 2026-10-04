import { describe, it, expect } from 'vitest';
import { foldSummary, LONG_QUESTION, longQuestion } from './long-question';
import { present } from './test/test-item';

// A long question on the ask page (PRD 752): a lead in bold, the rest folded under "Read the full
// question · N steps · N words", inline steps as a numbered list. A short one stays as it is.

const ERP =
  "The two customer-facing screens are painted by the ERP out of the package this work publishes, and that package now expects the ERP to install AG Grid itself and point Tailwind at the package's dist. " +
  'Nobody in this repository can make that change — it belongs to vertuo-apps. ' +
  'Until it lands, those two screens render unstyled and nothing errors to say so. ' +
  'Steps: (1) open a change in vertuo-apps declaring ag-grid-community and ag-grid-react at the version the guide names; ' +
  "(2) in the same change add the @source line pointing Tailwind at this package's dist, plus the two stylesheet imports — libs/vertuo-workflow-ui/README.md gives all three word for word; " +
  "(3) merge it before or with the ERP's next update of this package, and tell whoever cuts the release here. " +
  'Has that been done?';

const filler = 'This sentence only makes the question long enough to be folded on the page. ';

describe('a long question', () => {
  it('leaves a question of 280 characters or fewer alone', () => {
    expect(longQuestion('Which storage should the sessions use?')).toBeNull();
    expect(longQuestion('x'.repeat(LONG_QUESTION))).toBeNull();
    expect(longQuestion(`${'x'.repeat(LONG_QUESTION - 1)}?`)).toBeNull();
  });

  it('takes the first sentence and the final question as the lead when there is no blank line', () => {
    const long = present(longQuestion(ERP), 'longQuestion(ERP)');
    expect(long.lead).toBe(
      "The two customer-facing screens are painted by the ERP out of the package this work publishes, and that package now expects the ERP to install AG Grid itself and point Tailwind at the package's dist. Has that been done?",
    );
    expect(long.rest.startsWith('Nobody in this repository can make that change')).toBe(true);
    expect(long.rest).not.toContain('Has that been done?');
  });

  it('turns inline steps into a numbered list and counts them', () => {
    const long = present(longQuestion(ERP), 'longQuestion(ERP)');
    expect(long.steps).toBe(3);
    expect(long.rest).toContain('Steps:\n\n1. open a change in vertuo-apps');
    expect(long.rest).toContain('\n2. in the same change add the @source line');
    expect(long.rest).toMatch(/\n3\. merge it before or with the ERP's next update of this package, and tell whoever cuts the release here\.$/);
    expect(long.rest).not.toContain('(2)');
    expect(foldSummary(long)).toBe(`Read the full question · 3 steps · ${long.words} words`);
  });

  it('counts the words of the whole question', () => {
    expect(present(longQuestion(ERP), 'longQuestion(ERP)').words).toBe(ERP.split(/\s+/).filter(Boolean).length);
  });

  it('takes the first paragraph as the lead when the text has a blank line', () => {
    const text = `Should the sessions move to Postgres now?\nThe memory store loses them on every deploy.\n\n${filler.repeat(4)}Is that fine?`;
    const long = present(longQuestion(text), 'longQuestion(text)');
    expect(long.lead).toBe('Should the sessions move to Postgres now?\nThe memory store loses them on every deploy.');
    expect(long.rest).toBe(`${filler.repeat(4).trim()} Is that fine?`);
    expect(long.steps).toBe(0);
    expect(foldSummary(long)).toBe(`Read the full question · ${long.words} words`);
  });

  it('keeps the first sentence alone when it is the question itself', () => {
    const text = `Should the sessions move to Postgres now? ${filler.repeat(4).trim()}`;
    const long = present(longQuestion(text), 'longQuestion(text)');
    expect(long.lead).toBe('Should the sessions move to Postgres now?');
    expect(long.rest).toBe(filler.repeat(4).trim());
  });

  it('adds a later question only when it is a different sentence from the first', () => {
    const text = `We moved the sessions to Postgres. ${filler.repeat(4)}Which region should hold them? ${filler.trim()}`;
    const long = present(longQuestion(text), 'longQuestion(text)');
    expect(long.lead).toBe('We moved the sessions to Postgres. Which region should hold them?');
    expect(long.rest).toBe(`${filler.repeat(4).trim()} ${filler.trim()}`);
  });

  it('has no rest when the long question is one sentence', () => {
    const text = `Should ${'the sessions and '.repeat(20)}the rounds move to Postgres?`;
    const long = present(longQuestion(text), 'longQuestion(text)');
    expect(long.lead).toBe(text);
    expect(long.rest).toBe('');
  });

  it('only counts steps that run 1, 2, 3 in order', () => {
    const text = `We weighed it. ${filler.repeat(4)}See (2) of the guide and (1) of the spec. Ready?`;
    const long = present(longQuestion(text), 'longQuestion(text)');
    expect(long.steps).toBe(0);
    expect(long.rest).toContain('See (2) of the guide and (1) of the spec.');
  });
});
