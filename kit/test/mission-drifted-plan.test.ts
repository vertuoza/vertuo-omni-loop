// Bug #3326: in a mission, the PM's plan job pushes a new plan version of a product PRD, which voids its earlier approval
// (BL-APPROVALS-1), so `omni prd <key>-<n>` reads `drifted`. The fleet approves the PRD again only after the PM's `plan` and the
// Architect's `tech` decisions on the latest version (apps/omni-app/src/missions/tech.ts), so the Architect's review and the PM's
// plan-only run under `--mission` must take a drifted PRD, as they take one in the inbox. Mission #3319 sent omni-loop-28, 30 and 32
// to a person because the Architect refused them. Outside `--mission`, nothing changes. Read as text from the two SKILL.md files.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (skill: string): string => readFileSync(new URL(`../plugin/skills/${skill}/SKILL.md`, import.meta.url), 'utf8');

/** The section whose `## ` heading starts with `start`, up to the next `## ` heading outside a fence. */
function section(text: string, start: string): string {
  const lines = text.split('\n');
  let fenced = false;
  let from = -1;
  for (const [index, line] of lines.entries()) {
    if (line.trim().startsWith('```')) fenced = !fenced;
    else if (!fenced && line.startsWith('## ')) {
      if (from >= 0) return lines.slice(from, index).join('\n');
      if (line.startsWith(`## ${start}`)) from = index;
    }
  }
  return from < 0 ? '' : lines.slice(from).join('\n');
}

const flat = (text: string): string => text.replace(/\s+/g, ' ');

describe("a mission's Architect reviews a drifted product PRD (bug #3326)", () => {
  const mission = flat(section(read('tech-review'), "For a mission's Architect"));

  it('reviews a drifted PRD as one in the inbox, on its latest plan version', () => {
    expect(mission).toContain('`drifted` is reviewed as `inbox`');
    expect(mission).not.toContain('A `state:` other than `inbox`');
  });

  it('stops only on a PRD whose page cannot be read, with no record', () => {
    expect(mission).toContain('Only `unreachable` stops');
  });
});

describe("a mission's PM plans a drifted product PRD (bug #3326)", () => {
  const planOnly = flat(section(read('mega-brainstorm'), 'Plan only'));

  it('plans a drifted PRD under --mission as one in the inbox, and stops only on an unreachable one', () => {
    expect(planOnly).toContain('Under `--mission`, only `unreachable` stops');
    expect(planOnly).toContain('`drifted` is planned as `inbox`');
  });

  it('keeps refusing every state but inbox without --mission', () => {
    expect(planOnly).toContain('Without `--mission`, a `state:` other than `inbox` (`drifted`, `unreachable`) writes nothing');
  });
});
