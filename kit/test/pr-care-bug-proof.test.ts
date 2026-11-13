import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// PRD 2741: a bug fix's proof is only good at the head that merges, so pr-care runs `omni bug` again
// after each push to a bug-fix pull request, and the bug-fix skills say the After line cites the head.
const skill = (name: string) =>
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../plugin/skills', name, 'SKILL.md'), 'utf8');

describe('the proof at the head, in the skills', () => {
  it('has pr-care rerun omni bug after a push, re-prove with a new line, else back to draft', () => {
    const text = skill('pr-care');
    const start = text.indexOf('### After a push to a bug-fix pull request');
    expect(start).toBeGreaterThan(-1);
    const section = text.slice(start, text.indexOf('## 3. Review threads'));
    const order = ['omni.mjs bug <n>', '- **Re-proved** (green,', 'changing no line already there', 'gh pr ready <n> --undo', 'status comment'];
    let at = -1;
    for (const part of order) {
      const next = section.indexOf(part, at + 1);
      expect(next, part).toBeGreaterThan(at);
      at = next;
    }
  });

  it('has bug-fix and mega-bug-fix say the After line cites the head', () => {
    expect(skill('bug-fix')).toMatch(/cites the head/);
    expect(skill('mega-bug-fix')).toMatch(/cites the head/);
    expect(skill('mega-bug-fix')).toContain('--pr <owner/repo>#<n>');
  });
});
