// PRD 2175, s3: a takeover reuses the same work or rebuilds, in the words the agents read. `/omni:pr`'s
// Claim mode names the runner job that holds a claim; `/omni:wave` step 2 runs `omni claim check`
// before taking over a `claimed-stale` slice and follows its answer; `/omni:do-work` re-verifies a
// reused branch before building on it. Its own file: the law-proof tests stay as they are.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const read = (path: string) => readFileSync(join(repoRoot, path), 'utf8');
/** The text with its line breaks and runs of spaces read as one space, so a match spans a wrap. */
const flat = (text: string) => text.replace(/\s+/g, ' ');

/** The text of `markdown` from the heading `heading` to the next heading of its level or above. */
function section(markdown: string, heading: string): string {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.trim() === heading);
  expect(start, heading).toBeGreaterThanOrEqual(0);
  const level = /^#+/.exec(heading)?.[0].length ?? 2;
  const end = lines.findIndex((line, index) => index > start && /^#+ /.test(line) && (/^#+/.exec(line)?.[0].length ?? 9) <= level);
  return lines.slice(start, end === -1 ? undefined : end).join('\n');
}

const pr = read('kit/plugin/skills/pr/SKILL.md');
const wave = read('kit/plugin/skills/wave/SKILL.md');
const doWork = read('kit/plugin/skills/do-work/SKILL.md');

describe('/omni:pr — a claim names its runner job (PRD 2175)', () => {
  it('Claim mode writes the job line when OMNI_JOB is set, and none outside a runner', () => {
    const claim = flat(section(pr, '## Claim'));
    expect(claim).toContain('`OMNI_JOB`');
    expect(claim).toContain('`- job: <id> · runner <name>`');
    expect(claim).toMatch(/outside a runner[^.]*no job line/);
  });

  it('the status comment carries the job line, rewritten from the session that holds the claim', () => {
    const status = flat(section(pr, '## The status comment'));
    expect(status).toContain('- job: <id> · runner <name>');
    expect(status).toMatch(/`OMNI_JOB`/);
    expect(status).toMatch(/drop(s|ped)? it when `OMNI_JOB` is not set/);
  });
});

describe('/omni:wave — the takeover of a claimed-stale slice (PRD 2175)', () => {
  const claimStep = flat(section(wave, '## 2. Claim every slice first'));

  it('runs omni claim check first', () => {
    expect(claimStep).toContain('node .omni-loop/bin/omni.mjs claim check <prd> <slice>');
  });

  it('on reuse, relabels the sub-PR and says whom it took over from', () => {
    expect(claimStep).toMatch(/\*\*`reuse`\*\*[^]*add `labels\.inProgress`[^]*remove the released label/);
    expect(claimStep).toContain('`omni:released` unless `labels.released` sets another');
    expect(claimStep).toContain('taken over from job `<id>`');
    expect(claimStep).toContain('taken over from a quiet claim');
    expect(claimStep).toMatch(/branch is reused/);
  });

  it('on rebuild, closes the sub-PR with its reason, deletes its branch and claims afresh', () => {
    expect(claimStep).toMatch(/\*\*`rebuild: <reason>`\*\*/);
    expect(claimStep).toContain('Closed to rebuild: <the rebuild line>');
    expect(claimStep).toMatch(/delete its remote branch/);
    expect(claimStep).toMatch(/claim the slice afresh[^.]*Claim[^.]* mode/);
  });

  it('never reads the released label with omni config, which has no default for it', () => {
    for (const text of [wave, pr, doWork]) expect(text).not.toContain('config labels.released');
  });

  it('tells the subagent of a reused slice that its branch is reused', () => {
    const dispatch = flat(section(wave, '## 3. Dispatch, one agent per slice, all at once'));
    expect(dispatch).toContain('Its branch is reused: re-verify it before building.');
  });
});

describe('/omni:do-work — a reused branch is re-verified first (PRD 2175)', () => {
  const reused = flat(section(doWork, '## A reused branch'));

  it('is reached from --in-wave when the prompt says the branch is reused', () => {
    expect(flat(section(doWork, '## 1. Read before you build'))).toMatch(/branch is reused[^.]*\*\*A reused branch\*\*/);
  });

  it('merges the feature branch in, runs the preflight, then reviews the diff against the done-when', () => {
    const merge = reused.indexOf('git merge <repo.remote>/<feature branch>');
    const preflight = reused.indexOf('the preflight');
    const review = reused.indexOf("done-when");
    expect(merge).toBeGreaterThan(0);
    expect(preflight).toBeGreaterThan(merge);
    expect(review).toBeGreaterThan(preflight);
    expect(reused).toContain('git diff <repo.remote>/<feature branch>...HEAD');
  });

  it('fixes each finding within limits.attempts or records it as an outbox item, before its own work', () => {
    expect(reused).toContain('`limits.attempts`');
    expect(reused).toMatch(/outbox item/);
    expect(reused).toMatch(/[Oo]nly then[^.]*step 2/);
  });
});
