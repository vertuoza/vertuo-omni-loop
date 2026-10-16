// PRD 1793, s3: the skills that grade their own diff, and the guide, name `briefing-text` among the
// changes a person answers: a change to the briefing's files needs an item ranked high, as a change
// to a rule does. Kept out of `plugin.test.ts`, the test of locked laws BR-PRODUCT-3 and BR-PRODUCT-5.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

/** The text of `path` from the line holding `heading` to the next heading of the same level. */
function section(path: string, heading: string): string {
  const text = read(path);
  const start = text.indexOf(heading);
  expect(start, `${path} has no "${heading}"`).toBeGreaterThanOrEqual(0);
  const level = /^#+/.exec(heading)?.[0] ?? '##';
  const next = text.indexOf(`\n${level} `, start + heading.length);
  return text.slice(start, next === -1 ? undefined : next);
}

describe('briefing-text in the skills and the guide', () => {
  it('/omni:do-work lists it among the risky changes it grades', () => {
    const text = section('kit/plugin/skills/do-work/SKILL.md', '## 4. Account for the ground you touched');
    expect(text).toMatch(/It names every risky change \([^)]*the briefing \(`briefing-text`\)/);
  });

  it.each([
    ['kit/plugin/skills/bug-fix/SKILL.md'],
    ['kit/plugin/skills/visual-fix/SKILL.md'],
  ])('%s has a briefing-text row in its rule table and names it on its not-ok line', (path) => {
    const text = section(path, '## A change to a law');
    expect(text).toMatch(/^\| `briefing-text` \| [^|]*briefing[^|]*\|$/m);
    expect(read(path)).toMatch(/A line naming `law-proof`, `law-text`, `test-removed`, `law-demoted` or `briefing-text`/);
  });

  it('the guide names it in "A person answers every change to a rule"', () => {
    const text = section('docs/guide/loop.md', '### A person answers every change to a rule');
    expect(text).toMatch(/^- \*\*`briefing-text`\*\*: /m);
    expect(text).toMatch(/Five changes count/);
    expect(text).toMatch(/the five changes answered only by `high` questions/);
  });
});
