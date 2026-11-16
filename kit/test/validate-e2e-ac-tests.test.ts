// PRD 2898, s6: `/omni:validate-e2e` turns each `e2e` scenario of a spec into one test titled
// `AC-n: …`, tagged `prd-<n>`, each Given and When an `agent.act`, each Then an `agent.assert`, the
// scenario's lines kept verbatim, read from the spec and never from a `.feature` file.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const skill = readFileSync(new URL('../plugin/skills/validate-e2e/SKILL.md', import.meta.url), 'utf8').replace(/\s+/g, ' ');

describe('the validate-e2e skill writes one AC test per e2e scenario (PRD 2898)', () => {
  it('reads each AC heading and its gherkin block from the spec, never a .feature file', () => {
    expect(skill).toContain('`### AC-<n> · <kind>` heading');
    expect(skill).toContain('Never read a `.feature` file: the spec is the one source');
  });

  it('writes one test per e2e scenario and none for a test-kind criterion', () => {
    expect(skill).toContain('**`e2e` kind**: a screen proves it. It gets exactly one test.');
    expect(skill).toContain('**`test` kind**: a vitest test titled `AC-n: …` proves it, not this skill. It gets no e2e test.');
  });

  it('titles the test AC-n and tags it prd-<n>', () => {
    expect(skill).toContain("titled `AC-n: <the scenario's name>`");
    expect(skill).toContain('tagged `prd-<n>`');
  });

  it('makes each Given and When an agent.act and each Then an agent.assert, lines verbatim', () => {
    expect(skill).toContain('Each Given and each When of the scenario is one `agent.act`; each Then is one `agent.assert`');
    expect(skill).toContain('The scenario\'s lines are kept verbatim');
  });
});
