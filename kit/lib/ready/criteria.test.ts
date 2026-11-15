// PRD 2898, s1: the parser of a spec's `### AC-n · <kind>` criteria, each with its `gherkin` block.
import { describe, expect, it } from 'vitest';
import { acNumberOfTitle, parseCriteria } from './criteria.ts';

const FENCE = '```';

/** One criterion as a spec writes it. */
function criterion(heading: string, lines: readonly string[]): string {
  return [`### ${heading}`, '', `${FENCE}gherkin`, ...lines, FENCE, ''].join('\n');
}

const GOOD = ['Scenario: A loosened test keeps the pull request a draft', '  Given a diff that skips a test', '  When the Reviewer passes it', '  Then it stays a draft', '  And its check names the test'];

describe('parseCriteria (PRD 2898)', () => {
  it('reads each criterion: its number, its kind, its scenario and its lines verbatim', () => {
    const spec = ['## Acceptance criteria', '', criterion('AC-1 · test', GOOD), criterion('AC-2 · e2e', GOOD)].join('\n');
    const { criteria, problems } = parseCriteria(spec);
    expect(problems).toEqual([]);
    expect(criteria.map(({ number, kind }) => [number, kind])).toEqual([[1, 'test'], [2, 'e2e']]);
    const [first] = criteria;
    expect(first?.scenario).toBe('A loosened test keeps the pull request a draft');
    expect(first?.lines).toEqual(GOOD);
    expect(first?.steps).toEqual([
      { keyword: 'Given', text: 'a diff that skips a test' },
      { keyword: 'When', text: 'the Reviewer passes it' },
      { keyword: 'Then', text: 'it stays a draft' },
      { keyword: 'And', text: 'its check names the test' },
    ]);
  });

  it('reads a spec of plain bullets as no criterion and no problem', () => {
    expect(parseCriteria('## Acceptance criteria\n\n- it works\n- it is fast\n')).toEqual({ criteria: [], problems: [] });
  });

  it('never reads a heading inside a fence, even a longer one holding a gherkin block', () => {
    const example = ['````markdown', criterion('AC-2 · e2e', GOOD), '````', ''].join('\n');
    expect(parseCriteria(example)).toEqual({ criteria: [], problems: [] });
  });

  it('refuses a heading with no number, naming it', () => {
    const { problems } = parseCriteria(criterion('AC · test', GOOD));
    expect(problems).toEqual([{ criterion: 'AC', line: 1, problem: 'an AC- heading with no number: write ### AC-<n> · test' }]);
  });

  it('refuses a number written twice, naming it, and keeps its first criterion', () => {
    const { criteria, problems } = parseCriteria([criterion('AC-3 · test', GOOD), criterion('AC-3 · e2e', GOOD)].join('\n'));
    expect(criteria.map(({ number, kind }) => [number, kind])).toEqual([[3, 'test']]);
    expect(problems.map(({ criterion: name, problem }) => `${name}: ${problem}`)).toEqual(['AC-3: AC-3 is written twice']);
  });

  it('refuses a missing kind and a kind other than test or e2e, naming the criterion', () => {
    const { criteria, problems } = parseCriteria([criterion('AC-1', GOOD), criterion('AC-2 · unit', GOOD)].join('\n'));
    expect(criteria).toEqual([]);
    expect(problems.map(({ criterion: name, problem }) => `${name}: ${problem}`)).toEqual([
      'AC-1: AC-1 has no kind: write ### AC-1 · test or ### AC-1 · e2e',
      'AC-2: AC-2 has the kind "unit": its kind is test or e2e',
    ]);
  });

  it('refuses a scenario without a Given, a When or a Then, naming each one missing', () => {
    const noThen = GOOD.filter((line) => !/Then|And/.test(line));
    const { criteria, problems } = parseCriteria([criterion('AC-3 · test', GOOD), criterion('AC-4 · test', noThen), criterion('AC-5 · test', ['Scenario: empty'])].join('\n'));
    expect(criteria.map(({ number }) => number)).toEqual([3]);
    expect(problems.map(({ criterion: name, problem }) => `${name}: ${problem}`)).toEqual([
      'AC-4: AC-4 has no Then',
      'AC-5: AC-5 has no Given, no When, no Then',
    ]);
  });

  it('refuses a criterion with no gherkin block before the next heading', () => {
    const spec = ['### AC-1 · test', '', '- it works', '', criterion('AC-2 · test', GOOD)].join('\n');
    const { criteria, problems } = parseCriteria(spec);
    expect(criteria.map(({ number }) => number)).toEqual([2]);
    expect(problems).toEqual([{ criterion: 'AC-1', line: 1, problem: 'AC-1 has no gherkin scenario: a ```gherkin block under its heading' }]);
  });

  it('reads the kind only after a middle dot', () => {
    expect(parseCriteria(criterion('AC-7 - e2e', GOOD)).problems.map(({ problem }) => problem)).toEqual(['AC-7 has no kind: write ### AC-7 · test or ### AC-7 · e2e']);
  });

  it('reads the specs of AC-6: AC-3 twice and an AC-4 with no Then, both named', () => {
    const spec = [criterion('AC-3 · test', GOOD), criterion('AC-3 · test', GOOD), criterion('AC-4 · test', GOOD.slice(0, 3))].join('\n');
    const names = parseCriteria(spec).problems.map(({ criterion: name }) => name);
    expect(names).toEqual(['AC-3', 'AC-4']);
  });
});

describe('acNumberOfTitle (PRD 2898)', () => {
  it('reads the criterion a test title proves', () => {
    expect(acNumberOfTitle('AC-3: Evidence still coming never passes')).toBe(3);
    expect(acNumberOfTitle('AC-12:x')).toBe(12);
  });

  it('reads none from any other title', () => {
    for (const title of ['AC-3 Evidence', 'checks AC-3: x', 'AC-: x', 'ac-3: x', 'AC-0: x']) expect(acNumberOfTitle(title), title).toBeNull();
  });
});
