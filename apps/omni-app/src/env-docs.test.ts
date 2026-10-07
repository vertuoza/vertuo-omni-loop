// The docs check for the GitHub App (PRD 1059, s4; ADR-0057): the README's variable list names exactly
// what `src/env.ts` reads plus what the Inngest SDK reads itself, both ways. Readers: kit/lib/env/docs.ts.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { listDifference, readmeNames } from 'vertuo-omni-plan/kit/lib/env/docs.ts';
import { PLATFORM_VARIABLES, SDK_VARIABLES, VARIABLES } from './env.ts';

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

describe('the docs check, for the GitHub App', () => {
  it('keeps the platform\'s and the SDK\'s variables apart from the groups\'', () => {
    const others = [...PLATFORM_VARIABLES, ...SDK_VARIABLES];
    expect(VARIABLES.filter((name) => others.includes(name))).toEqual([]);
  });

  it('README.md lists exactly the variables the app and the Inngest SDK read', () => {
    expect(listDifference([...VARIABLES, ...SDK_VARIABLES], readmeNames(readme))).toEqual({ unlisted: [], unread: [] });
  });
});
