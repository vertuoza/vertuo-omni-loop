// PRD 2898, s2: `/omni:brainstorm` step 4 writes each acceptance criterion as an `### AC-n · <kind>`
// scenario, the kind from `acceptance.kind`.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const skill = readFileSync(new URL('../plugin/skills/brainstorm/SKILL.md', import.meta.url), 'utf8').replace(/\s+/g, ' ');

describe('the brainstorm skill writes acceptance criteria as scenarios (PRD 2898)', () => {
  it('writes each criterion as an AC heading with a number and a kind, then a gherkin block', () => {
    expect(skill).toContain('### AC-<n> · <kind>');
    expect(skill).toContain('```gherkin block');
    expect(skill).toContain('Given, When and Then');
  });

  it('takes the default kind from acceptance.kind', () => {
    expect(skill).toContain('`omni config acceptance.kind`');
    expect(skill).toContain('`test`');
    expect(skill).toContain('`e2e`');
  });

  it('says omni check inbox refuses a malformed criterion', () => {
    expect(skill).toContain('`omni check inbox` refuses a number missing or twice');
  });
});
