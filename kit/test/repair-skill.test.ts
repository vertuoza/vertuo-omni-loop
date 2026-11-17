// The contract of `/omni:repair` (PRD 2980, s3), read as text: it reads why a step failed, writes a retro, takes one way by
// its class (`code` through `/omni:bug-fix --base <mission branch>`, `omni-loop` a scrubbed report, `flake` nothing, `person` the
// question), asks nobody, and ends on one `omni repair:` record line that `repairLine()` reads. `/omni:bug-fix` takes `--base`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { repairLine } from '../lib/repair/line.ts';
import { RUNNABLE_SKILLS } from '../lib/runner/line.ts';
import { roleOf } from '../lib/virtual-fleet/roles.ts';

const read = (name: string): string => readFileSync(fileURLToPath(new URL(`../plugin/skills/${name}/SKILL.md`, import.meta.url)), 'utf8').replace(/\s+/g, ' ');
const REPAIR = read('repair');
const BUG_FIX = read('bug-fix');

describe('/omni:repair', () => {
  it('is a skill a runner takes, and the Engineer starts with it', () => {
    expect(REPAIR).toContain('name: repair');
    expect(RUNNABLE_SKILLS).toContain('repair');
    expect(roleOf('engineer').skills).toContain('repair');
  });

  it('takes the mission, the PRD and the failed job', () => {
    for (const input of ['--mission <m>', '--prd <n>', '--job <id>']) expect(REPAIR).toContain(input);
  });

  it('writes a retro of the schema\'s fields and names the four classes', () => {
    for (const field of ['"cause"', '"class"', '"place"', '"signature"', '"evidence"', '"proposedFix"', '"fingerprint"']) expect(REPAIR).toContain(field);
    for (const way of ['`code`', '`omni-loop`', '`flake`', '`person`']) expect(REPAIR).toContain(way);
  });

  it('fixes a code cause through the bug fix into the mission branch, and a multi-repository PRD through the mega bug fix', () => {
    expect(REPAIR).toContain('`/omni:bug-fix` with `--base <mission branch>`');
    expect(REPAIR).toContain('`/omni:mega-bug-fix`');
  });

  it('reads omni-loop as code in the Omni Loop repository, and fixes nothing for omni-loop, flake or person', () => {
    expect(REPAIR).toContain('read `omni-loop` as `code`');
    expect(REPAIR).toContain('Never fix a class other than `code`.');
  });

  it('asks nobody and never merges', () => {
    expect(REPAIR).toContain('Never ask a person');
    expect(REPAIR).toContain('Never merge');
  });

  it('ends on the record line the App reads', () => {
    expect(REPAIR).toContain('omni repair: {"v":1,"mission":<m>,"prd":<n>,"fingerprint":"<hex>","class":"<class>","retro":{…},"fix":<pr|null>,"report":{…}|null}');
    expect(repairLine('12:00:00 omni repair: not json')).toEqual({ readable: false, reason: 'malformed' });
    expect(repairLine('nothing')).toEqual({ readable: false, reason: 'missing' });
  });
});

describe('/omni:bug-fix --base', () => {
  it('cuts the fix branch from the given branch and targets its PR at it, the default branch with no --base', () => {
    expect(BUG_FIX).toContain('`--base <branch>`');
    expect(BUG_FIX).toContain('`<base>` below is the branch given by `--base`, else `repo.defaultBranch`');
    expect(BUG_FIX).toContain('git worktree add -b <fix branch> <worktrees>/<n>-<slug> <remote>/<base>');
    expect(BUG_FIX).toContain('base `<base>`, label `labels.bug`');
  });
});
