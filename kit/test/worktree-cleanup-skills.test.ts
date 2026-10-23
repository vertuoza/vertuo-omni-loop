// PRD 2485, s3: the skills that create worktrees remove them. `/omni:wave` removes a slice's worktree
// once its sub-PR merges (its inline slice's once it is done), `/omni:yolo` and `/omni:yolo-fix` prune
// the PRD's worktrees before their hand-off and name the kept ones, and the guide lists the command.
// The engine is tested where it lives (kit/bin/worktrees.test.ts).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function read(path: string): string {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
}

/** The text of one `## ` section, flattened to single spaces, failing the test when it is absent. */
function section(text: string, heading: string): string {
  const parts = text.split(/^(?=## )/m);
  const found = parts.find((part) => part.startsWith(`## ${heading}`));
  expect(found, heading).toBeDefined();
  return (found ?? '').replace(/\s+/g, ' ');
}

const WAVE = read('../plugin/skills/wave/SKILL.md');
const YOLO = read('../plugin/skills/yolo/SKILL.md');
const YOLO_FIX = read('../plugin/skills/yolo-fix/SKILL.md');
const GUIDE = read('../../docs/guide/any-agent.md');

describe('/omni:wave removes a slice worktree', () => {
  it('after each merged sub-PR, in step 4, and puts the line in the report', () => {
    const step = section(WAVE, '4. Merge, one at a time');
    expect(step).toContain('omni.mjs worktrees remove <worktree>');
    expect(step.indexOf('worktrees remove')).toBeGreaterThan(step.indexOf('**Merge, through the gate.**'));
    expect(step).toContain('Once the sub-PR is merged, run `node .omni-loop/bin/omni.mjs worktrees remove');
    expect(step).toContain('the wave\'s report');
  });

  it('after each done slice of an inline wave', () => {
    const inline = section(WAVE, 'Inline wave');
    expect(inline).toContain('omni.mjs worktrees remove <worktree>');
    expect(inline).toContain('`done`: the slice is built; run `node .omni-loop/bin/omni.mjs worktrees remove <worktree>`');
  });

  it('keeps the removed line in step 6', () => {
    expect(section(WAVE, '6. Report')).toContain('removed <path>');
  });
});

describe('/omni:yolo and /omni:yolo-fix prune the PRD worktrees', () => {
  it('yolo prunes just before the hand-off, gate green or red, and lists the kept ones', () => {
    const at = YOLO.indexOf('omni.mjs worktrees prune --prd <n>');
    expect(at).toBeGreaterThan(YOLO.indexOf('## 6. Release'));
    expect(at).toBeLessThan(YOLO.indexOf('## 7. Hand off'));
    const handOff = section(YOLO, '7. Hand off');
    expect(handOff).toMatch(/kept <path> · <reason>/);
    expect(section(YOLO, '6. Release')).toMatch(/green or red/);
  });

  it('yolo-fix prunes at its end and names the kept ones in its hand-off', () => {
    const at = YOLO_FIX.indexOf('omni.mjs worktrees prune --prd <n>');
    expect(at).toBeGreaterThan(YOLO_FIX.indexOf('## 7. Finish'));
    expect(at).toBeLessThan(YOLO_FIX.indexOf('## 8. Hand off'));
    expect(section(YOLO_FIX, '8. Hand off')).toMatch(/kept <path> · <reason>/);
  });

  it('a red slice keeps its worktree while the feature PR is open', () => {
    expect(section(YOLO, '6. Release')).toMatch(/red, stopped or blocked slice/);
  });
});

describe('the guide', () => {
  it('lists omni worktrees with its four verbs', () => {
    for (const verb of ['list', 'prune', 'remove', 'hint']) {
      expect(GUIDE).toContain(`omni worktrees ${verb}`);
    }
  });
});
