// PRD 2746, slice s2: `/omni:ultra-yolo` and `/omni:ultra-wave` write one `Merge after <owner/repo>#<n>`
// line per provider target on a consumer target's pull request, from the plan's cross-target blockers.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (name: string) => readFileSync(new URL(`../plugin/skills/${name}/SKILL.md`, import.meta.url), 'utf8');
const flat = (text: string) => text.replace(/\s+/g, ' ');

describe.each(['ultra-yolo', 'ultra-wave'])('/omni:%s writes the Merge after lines', (name) => {
  const text = flat(read(name));

  it('names the line and its shape', () => {
    expect(text).toContain('`Merge after <owner/repo>#<n>`');
  });

  it('writes one line per provider target the consumer waits for, in the plan order', () => {
    expect(text).toContain('one `Merge after <owner/repo>#<n>` line for each provider target the plan makes it wait for');
    expect(text).toContain('blocked by a slice of another target');
    expect(text).toContain("in the plan's order");
  });

  it('writes them as /omni:mega-bug-fix does', () => {
    expect(text).toContain('as `/omni:mega-bug-fix` writes them');
  });
});
