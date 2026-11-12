// The docs check for the GitHub App (PRD 1059, s4; ADR-0057): the README's variable list names exactly
// what `src/env.ts` reads, both ways. Readers: kit/lib/env/docs.ts.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { listDifference, readmeNames } from 'omni-loop/kit/lib/env/docs.ts';
import { PLATFORM_VARIABLES, VARIABLES } from './env.ts';

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

describe('the docs check, for the GitHub App', () => {
  it('keeps the platform\'s variables apart from the groups\'', () => {
    expect(VARIABLES.filter((name) => PLATFORM_VARIABLES.includes(name))).toEqual([]);
  });

  it('README.md lists exactly the variables the app reads', () => {
    expect(listDifference(VARIABLES, readmeNames(readme))).toEqual({ unlisted: [], unread: [] });
  });
});
