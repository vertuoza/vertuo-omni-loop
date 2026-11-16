// PRD 2898, s4 (AC-1, AC-2, AC-7): the gate line of the skills that mark a feature PR ready. `/omni:review`'s
// pass labels the draft, runs `omni ready`, and only then marks it ready; a red verdict leaves the draft and
// ends `changes` naming the failing check. `/omni:yolo` and `/omni:yolo-fix` run the same line only under
// `ready.checks: all`: under `mission`, a PRD in no mission is marked ready as today.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COMMAND_TABLE } from '../bin/commands/index.ts';

const read = (name: string) => readFileSync(new URL(`../plugin/skills/${name}/SKILL.md`, import.meta.url), 'utf8').replace(/\s+/g, ' ');

describe("/omni:review's ready gate", () => {
  const text = read('review');

  it('labels the draft, runs omni ready, and only then marks it ready (AC-1)', () => {
    const label = text.indexOf('gh pr edit <pr> --add-label <label>');
    const ready = text.indexOf('omni.mjs ready <n> --json');
    const mark = text.indexOf('`gh pr ready <pr>`');
    expect(label).toBeGreaterThan(0);
    expect(label).toBeLessThan(ready);
    expect(ready).toBeLessThan(mark);
    expect(text).toContain('omni:ready-check');
    expect(text).toContain('Exit 0 is five checks `pass`');
  });

  it('is off under ready.checks off', () => {
    expect(text).toContain('It prints `off` (or fails): there is no gate');
  });

  it('leaves the draft on a red verdict, ends changes, and names the failing check as the finding (AC-2)', () => {
    expect(text).toContain('leaves the PR a draft');
    expect(text).toContain('A check `fail`: the run ends `changes`');
    expect(text).toContain("naming the check's number, title and why exactly as `omni ready` printed them");
    expect(text).toContain('end at step 7 on `/omni:yolo-fix <n> --for-review`');
  });

  it('never reads a check not finished or not judged as a pass', () => {
    expect(text).toContain('not ready, check <number> not finished');
    expect(text).toContain('not ready, check <number> not judged');
  });

  it('names only commands the CLI has', () => {
    expect(COMMAND_TABLE).toHaveProperty('ready');
  });
});

describe.each(['yolo', 'yolo-fix'])('/omni:%s runs omni ready only under ready.checks all (AC-7)', (name) => {
  const text = read(name);

  it('gates only under all, so a PRD in no mission is marked ready as today', () => {
    expect(text).toMatch(/only (when|under) .{0,80}?(ready\.checks` prints `all`|ready\.checks: all|`ready\.checks: all`)/);
  });
});

describe('/omni:yolo gate line', () => {
  const text = read('yolo');

  it('runs omni ready before the draft is marked ready, and a red verdict leaves the draft', () => {
    expect(text.indexOf('omni.mjs ready <prd>')).toBeLessThan(text.indexOf('Item 3 has just pushed:'));
    expect(text).toContain('under `mission` or `off` it does not run');
    expect(text).toContain('a PRD in no mission is marked ready as today');
    expect(text).toContain('leaves the feature PR in draft');
  });
});
