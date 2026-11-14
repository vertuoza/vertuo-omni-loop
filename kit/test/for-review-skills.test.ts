// PRD 2871, slice s4: `--for-review` on `/omni:yolo`, `/omni:yolo-fix` and `/omni:ultra-yolo-fix` ships,
// leaves the pull request a draft and ends `review`; the fix judges each Reviewer thread.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (name: string) => readFileSync(new URL(`../plugin/skills/${name}/SKILL.md`, import.meta.url), 'utf8');
const flat = (text: string) => text.replace(/\s+/g, ' ');

describe('/omni:yolo --for-review', () => {
  const text = flat(read('yolo'));

  it('runs everything up to omni ship, then leaves the feature PR a draft', () => {
    expect(text).toContain('step 5 runs everything up to and including `omni ship`');
    expect(text).toContain('then leaves the feature PR a **draft**');
  });

  it('runs neither the yolo.ready point nor gh pr ready under the flag', () => {
    expect(text).toContain('**With `--for-review`, stop here:** run neither the point `yolo.ready` nor `gh pr ready`.');
  });

  it('ends on the review hand-off, its last line /omni:review <n>', () => {
    expect(text).toContain("the reply's last line is `/omni:review <n>`");
  });

  it('marks ready as today without the flag', () => {
    expect(text).toContain('Without `--for-review`, every step is as written below');
    expect(text).toContain('Without `--for-review`: only now, `gh pr ready <feature PR>`');
  });
});

describe.each(['yolo-fix', 'ultra-yolo-fix'])('/omni:%s --for-review', (name) => {
  const text = flat(read(name));

  it('names the flag, the draft and the review hand-off', () => {
    expect(text).toContain('`--for-review`');
    expect(text).toContain('**draft**');
    expect(text).toContain('`/omni:review <n>`');
  });

  it('never marks ready under the flag', () => {
    expect(text).toMatch(/(never under `--for-review`|in place of marking it ready|ships as written, then leaves the plan PR a \*\*draft\*\*)/);
  });
});

describe("/omni:yolo-fix reads the Reviewer's threads", () => {
  const text = flat(read('yolo-fix'));

  it('reads the latest review and its open threads', () => {
    expect(text).toContain('`node .omni-loop/bin/omni.mjs review read <prd>`');
    expect(text).toContain('<!-- omni-review: ');
  });

  it('judges each thread as pr-care does: fixed, pushed-back or asked, through omni care reply', () => {
    expect(text).toContain("as `/omni:pr-care`'s **Review threads** does");
    expect(text).toContain('**fixed**');
    expect(text).toContain('**pushed-back**');
    expect(text).toContain('**asked**');
    expect(text).toContain('omni.mjs care reply --verdict <fixed|pushed-back|asked>');
  });

  it("settles every thread before the ship and never touches a person's words", () => {
    expect(text).toContain('Settle every Reviewer thread before step 7 ships');
    expect(text).toContain("never edit, resolve on behalf of or reword a person's comment or reply");
  });
});

describe("/omni:ultra-yolo-fix reads the Reviewer's threads the same way", () => {
  const text = flat(read('ultra-yolo-fix'));

  it("points at yolo-fix's threads step and keeps the plan PR a draft", () => {
    expect(text).toContain("**The Reviewer's threads** of `/omni:yolo-fix` step 3");
    expect(text).toContain('each thread fixed, pushed back or asked');
    expect(text).toContain('it stays a draft for the Reviewer');
  });
});
