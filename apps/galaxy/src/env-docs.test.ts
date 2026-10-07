// The docs check for the arcade (PRD 1059, s4; ADR-0057): `.env.example` and the README's variable list
// name exactly what `src/env.ts` reads, both ways. Readers: kit/lib/env/docs.ts.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { envExampleNames, listDifference, readmeNames } from 'vertuo-omni-plan/kit/lib/env/docs.ts';
import { PLATFORM_VARIABLES, VARIABLES } from './env.ts';

vi.mock('server-only', () => ({}));

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('the docs check, for the arcade', () => {
  it('keeps the platform\'s variables apart from the groups\'', () => {
    expect(VARIABLES.filter((name) => PLATFORM_VARIABLES.includes(name))).toEqual([]);
  });

  it('.env.example lists exactly the variables the arcade reads', () => {
    expect(listDifference(VARIABLES, envExampleNames(read('../.env.example')))).toEqual({ unlisted: [], unread: [] });
  });

  it('README.md lists exactly the variables the arcade reads', () => {
    expect(listDifference(VARIABLES, readmeNames(read('../README.md')))).toEqual({ unlisted: [], unread: [] });
  });
});
