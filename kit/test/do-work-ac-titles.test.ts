import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { acNumberOfTitle } from '../lib/ready/criteria.ts';

const DO_WORK = readFileSync(join(import.meta.dirname, '..', 'plugin', 'skills', 'do-work', 'SKILL.md'), 'utf8');

// A slice titled its criterion tests `… (AC-1)`, and the acceptance check read 0 of 6 proven (PRD 3015):
// do-work says the title starts with `AC-<n>:`, the only shape the report reads.
describe('do-work: a criterion test is titled AC-<n>: … (PRD 2898)', () => {
  it('tells the slice to start the test title with AC-<n>:', () => {
    expect(DO_WORK).toContain('**A criterion\'s test is titled `AC-<n>: …`**');
    expect(DO_WORK).toContain("`it('AC-2: refuses a second save', …)`");
  });

  it('names the shapes the report does not read, and the report agrees', () => {
    expect(DO_WORK).toContain('`… (AC-2)`, or the number in a `describe`, proves');
    expect(acNumberOfTitle('AC-2: refuses a second save')).toBe(2);
    expect(acNumberOfTitle('refuses a second save (AC-2)')).toBeNull();
  });
});
