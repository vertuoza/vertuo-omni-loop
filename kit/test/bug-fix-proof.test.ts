// PRD 1972, s4: `/omni:bug-fix` films every bug and opens its pull request with `## Proof` (the
// before/after GIF and the failing and passing lines), or as a draft that says why; `/omni:mega-bug-fix`
// leaves `## Proof` out. PRD 2100, s5: the body is checked by `omni bug <n> --body-file` before the pull
// request opens, clips that fail fall back to the GIF of the two outputs, a component bug's `## Proof`
// links its clips, and stop rule 3 names the pull request that already fixed the bug, only when proven.
// PRD 2578, s4: the draft opens on the reproduction alone, the proof climbs down a ladder (A, B, C, D),
// and the check moves to the open pull request's body, before it is marked ready.
// These tests live apart from the law proofs of BR-PRODUCT-3, BR-PRODUCT-5 and N-PRODUCT-15 in
// `plugin.test.ts`, and change none of them.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stepsOf } from './skill-steps.ts';

/** A skill's SKILL.md, as text. */
const read = (skill: string) => readFileSync(new URL(`../plugin/skills/${skill}/SKILL.md`, import.meta.url), 'utf8');

/** The `## <heading>` section of a SKILL.md whose heading starts with `start`, up to the next one. */
function skillSection(text: string, start: string) {
  const lines = text.split('\n');
  const from = lines.findIndex((line: string) => line.startsWith(`## ${start}`));
  if (from < 0) return '';
  const to = lines.findIndex((line: string, index: number) => index > from && line.startsWith('## '));
  return lines.slice(from, to < 0 ? undefined : to).join('\n');
}

/** `text` with every run of whitespace, a line break and its indent included, as one space. */
const flat = (text: string) => text.replace(/\s+/g, ' ');

/** Each of `mentions` that `text` lacks, or lacks after the one before it: empty when all come in order, wherever a line breaks. */
const gaps = (text: string, mentions: string[]) => {
  const out: string[] = [];
  const words = flat(text);
  let from = 0;
  mentions.forEach((mention: string, index: number) => {
    const at = words.indexOf(mention, from);
    if (at < 0) out.push(`${mention} after ${mentions[index - 1] ?? 'the start'}`);
    else from = at + mention.length;
  });
  return out;
};

/** The rows of every Markdown table in `text`. */
const tableRows = (text: string) => text.split('\n').filter((line: string) => line.trimStart().startsWith('|'));

describe('the bug-fix skill films the bug and shows it in the pull request', () => {
  it('step 7 writes the red output to red.txt in the run folder, and films a component bug to before.webm', () => {
    const step = skillSection(read('bug-fix'), '7.');
    expect(gaps(step, ['<worktrees>/proof-bug-<n>/<run>/', '`red.txt`', 'component bug', 'Storybook', 'Playwright', '1280×720', '`before.webm`'])).toEqual([]);
  });

  it('step 8 writes green.txt, films the same story to after.webm, then stops Storybook', () => {
    const step = skillSection(read('bug-fix'), '8.');
    expect(gaps(step, ['`green.txt`', '`after.webm`', 'stops Storybook'])).toEqual([]);
  });

  it('step 12 commits, pushes, sends the dossier, walks the ladder, writes the body, puts it on the draft, checks it, then watches', () => {
    const step = skillSection(read('bug-fix'), '12.');
    expect(gaps(step, [
      '**Commit**',
      'git push -u <remote> <fix branch>',
      '/omni:dossier-push <n> --kind bug',
      '**The proof ladder.**',
      'omni.mjs bug film',
      'omni.mjs proof push --kind bug <n> <folder>',
      '**Write the body**',
      '`gh pr edit <pr> --body-file <file>`',
      '`node .omni-loop/bin/omni.mjs bug <n>`',
      '**Watch it through `/omni:pr`**',
    ])).toEqual([]);
  });

  it('the body has ## Proof right after What was wrong, with the GIF, the Clips line, the Proved on line and the failing and passing lines', () => {
    const step = skillSection(read('bug-fix'), '12.');
    expect(gaps(step, [
      '## What was wrong',
      '## Proof',
      '![Before and after the fix](<the GIF\'s stable link>)',
      'Clips: [before](<the before.webm link>) · [after](<the after.webm link>)',
      '- **Proved on:** <the level\'s line>',
      '- **Preview:** <url> · <lifetime>',
      '**Before the fix** (red): `<the failing line>`',
      '**After the fix** (green, `<short sha>`): `<the passing line>`',
      '## Bug',
    ])).toEqual([]);
  });

  it('the Clips links are the lines omni proof push prints after the GIF\'s, and only a component bug has them', () => {
    const step = skillSection(read('bug-fix'), '12.');
    expect(step).toContain('two more');
    expect(step).toContain('the `before.webm` link then the `after.webm` link');
    expect(step).toContain('The `Clips:` line is for a component bug whose clips were filmed');
  });
});

// PRD 2578, s4: the pull request opens as a draft on the reproduction alone, the fix is pushed on top,
// the proof is taken from the first level of the ladder that works (A a preview environment through the
// `bug-fix.proof` hook, B CI through `omni bug ci`, C this machine, D nowhere), and `omni bug <n>` checks
// the open pull request's body before it is marked ready, never to get a CI run.
describe('the draft pull request opens on the reproduction alone', () => {
  it('step 7 commits the reproduction alone, pushes it and opens the draft through /omni:pr at pr.open, before any fix', () => {
    const step = skillSection(read('bug-fix'), '7.');
    expect(gaps(step, [
      '**The draft pull request, on the reproduction alone.**',
      'before any fix',
      'Commit the reproduction alone',
      '`test(<scope>): reproduce',
      'Keep its sha',
      'git push -u <remote> <fix branch>',
      '`/omni:pr`',
      'as a **draft**',
      'at point `pr.open`',
      '`gh pr create --draft',
      'Keep its number, `<pr>`',
      'watch',
      'step 12',
    ])).toEqual([]);
  });

  it('the draft opens before the fix: step 7 holds it, and step 12 opens no pull request', () => {
    const text = read('bug-fix');
    expect(text.indexOf('**The draft pull request, on the reproduction alone.**')).toBeGreaterThan(0);
    expect(text.indexOf('**The draft pull request, on the reproduction alone.**')).toBeLessThan(text.indexOf('## 8. Fix'));
    expect(skillSection(text, '12.')).not.toContain('gh pr create');
  });

  it('never commits the fix before the draft exists, and steps 8 and 12 send a missing draft back to step 7', () => {
    const text = read('bug-fix');
    expect(gaps(skillSection(text, '7.'), [
      '**The fix is never committed before this draft exists.**',
      'the reproduction commit alone on top of the base',
      'stays uncommitted until then',
      'Pushing the reproduction with the fix, or opening the pull request once the fix is in, is this step skipped',
      "never level B's reason, and `omni bug <n>` refuses it as one",
    ])).toEqual([]);
    expect(gaps(skillSection(text, '8.'), ['**The draft comes first.**', 'before this step commits anything', 'back to step 7'])).toEqual([]);
    expect(gaps(skillSection(text, '12.'), ['No `<pr>` yet', "open step 7's draft on the reproduction alone first", 'only then commit the fix'])).toEqual([]);
  });
});

describe('a check failing on the reproduction commit counts no attempt; a red on the fix commit counts one', () => {
  it('step 7 says the reproduction\'s red is level B\'s red and counts no attempt', () => {
    expect(gaps(skillSection(read('bug-fix'), '7.'), [
      '**The red on the reproduction counts no attempt.**',
      'A check that fails on this commit is level B\'s red',
      'counts nothing against `limits.attempts`',
    ])).toEqual([]);
  });

  it('step 12 counts a red on the fix commit as an attempt once the fix is pushed, and the watch starts then', () => {
    const step = skillSection(read('bug-fix'), '12.');
    expect(gaps(step, ['git push -u <remote> <fix branch>', 'a red on the fix commit is one more attempt at the fix', 'a red on the reproduction commit never is'])).toEqual([]);
    expect(gaps(step, ['**Watch it through `/omni:pr`**', 'starts now, once the fix is pushed', 'A red CI run on the fix commit is one more attempt at the fix: back to step 8'])).toEqual([]);
  });

  it('stop rule 5 counts no check failing on the reproduction commit', () => {
    expect(flat(skillSection(read('bug-fix'), 'Stop rules'))).toContain('a check failing on the reproduction commit is never one');
  });
});

describe('step 12 takes the proof from the first level of the ladder that works', () => {
  it('walks A, B, C then D, in that order', () => {
    expect(gaps(skillSection(read('bug-fix'), '12.'), [
      '**The proof ladder.**',
      '**Level A, a preview environment.**',
      '**Level B, CI.**',
      '**Level C, the machine that made the fix.**',
      '**Level D, nowhere.**',
    ])).toEqual([]);
  });

  it('level A follows the bug-fix.proof point with its seven inputs, and needs two readable files and an env: line', () => {
    expect(gaps(skillSection(read('bug-fix'), '12.'), [
      '**Level A, a preview environment.**',
      '`node .omni-loop/bin/omni.mjs flow show bug-fix.proof',
      '`{issue}`', '`{base}`', '`{head}`', '`{pr}`', '`{targets}`', '`{reproduction}`', '`{out}`',
      '`node .omni-loop/bin/omni.mjs flow verdict bug-fix.proof --from <file>`',
      '`before.*` and a readable `after.*`',
      '`env: <url> · <lifetime>`',
      'omni.mjs bug film',
      'Anything else is level A\'s reason',
      '**Level B, CI.**',
    ])).toEqual([]);
  });

  it('level A\'s reasons name no hook, a failed hook, a missing file and a missing env: line', () => {
    const rows = tableRows(skillSection(read('bug-fix'), '12.'));
    for (const reason of ['`no bug-fix.proof hook`', '`hook failed: <why>`', '`no before.* or after.* in out`', '`no env: line`']) {
      expect(rows.some((row: string) => row.includes(reason)), reason).toBe(true);
    }
  });

  it('level B runs omni bug ci on the reproduction and the fix commits, and keeps its one line as B\'s reason', () => {
    expect(gaps(skillSection(read('bug-fix'), '12.'), [
      '**Level B, CI.**',
      '`node .omni-loop/bin/omni.mjs bug ci <n> --pr <pr> --reproduction <reproduction sha> --fix <head> --test <the reproduction\'s test name> --out <run folder>/ci/`',
      '`red.txt` and `green.txt`',
      'omni.mjs bug film',
      'Exit 1 prints level B\'s reason',
      '`job <name> skipped`',
      'never marks the pull request ready to get a run',
      '**Level C, the machine that made the fix.**',
    ])).toEqual([]);
  });

  it('level D keeps the PR a draft with a reason per level, naming a skipped job', () => {
    expect(gaps(skillSection(read('bug-fix'), '12.'), [
      '**Level D, nowhere.**',
      '`GIF not produced - A: <why>; B: <why>; C: <why>`',
      'stays a **draft**',
      'names the job',
    ])).toEqual([]);
  });

  it('each level writes its Proved on line, and a component filmed in Storybook says so beside its Clips line', () => {
    expect(gaps(skillSection(read('bug-fix'), '12.'), [
      '**The Proved on line.**',
      '`- **Proved on:** a preview environment`',
      '`- **Preview:** <url> · <lifetime>`',
      '`- **Proved on:** CI · reproduction test only, the screen was not filmed`',
      '`- **Proved on:** the machine that made the fix · reproduction test only, the screen was not filmed`',
      '`- **Proved on:** the machine that made the fix · the component filmed in Storybook`',
      'beside its `Clips:` line',
    ])).toEqual([]);
  });

  it('clips that fail fall back to the GIF of the two outputs at level C', () => {
    expect(gaps(skillSection(read('bug-fix'), '12.'), [
      '**Level C, the machine that made the fix.**',
      '**Clips that fail make the GIF of the two outputs.**',
      '`ffmpeg not found`',
      '`ffmpeg failed: <its last line>`',
      'no reason for level D',
      '`red.txt` and `green.txt`',
      'leave out the `Clips:` line',
      '`Storybook not filmed - <reason>`',
      '`ffmpeg not found` included',
    ])).toEqual([]);
  });

  it('level C is reached whenever red.txt and green.txt exist, whatever the kind of bug, its Proved on wording never its reason', () => {
    expect(gaps(skillSection(read('bug-fix'), '12.'), [
      '**Level C, the machine that made the fix.**',
      'Level C is reached whenever `red.txt` and `green.txt` exist from steps 7 and 8, whatever the kind of bug',
      "level C's only reason of its own",
      '`the pinned omni is too old: run omni update`',
      '`reproduction test only, the screen was not filmed` is the wording of level C\'s `Proved on` line',
      'never a reason for level C to fail, and never a way to level D',
    ])).toEqual([]);
  });

  it('level D names the reasons omni bug <n> takes, and its check names the two refusals', () => {
    const step = skillSection(read('bug-fix'), '12.');
    expect(gaps(step, [
      '**Level D, nowhere.**',
      "B's reason is the line `omni bug ci` printed",
      '`omni bug <n>` refuses any other',
    ])).toEqual([]);
    expect(flat(step)).toContain("giving level B a reason `omni bug ci` does not print, or level C a reason it does not have");
  });

  it('/omni:mega-bug-fix reaches level C whenever its outputs exist, with /omni:bug-fix\'s reasons', () => {
    expect(flat(read('mega-bug-fix'))).toContain('reached whenever both exist, whatever the kind of bug');
    expect(flat(read('mega-bug-fix'))).toContain('`reproduction test only` is the wording of its `Proved on` line, never its reason');
  });

  it('the reason table has no ffmpeg not found row, and names the old omni, the proof push and the red not seen', () => {
    const rows = tableRows(skillSection(read('bug-fix'), '12.'));
    expect(rows.filter((row: string) => row.includes('ffmpeg not found'))).toEqual([]);
    for (const reason of ['`the pinned omni is too old: run omni update`', '`proof push: <its line>`', '`red not proven here`']) {
      expect(rows.some((row: string) => row.includes(reason)), reason).toBe(true);
    }
  });

  it('/omni:mega-bug-fix takes the body from What was wrong on without ## Proof', () => {
    expect(read('mega-bug-fix')).toContain('without its `## Proof` section');
  });
});

describe('step 12 checks the open pull request\'s body before it is marked ready', () => {
  it('writes the body to a file, puts it on the draft, then runs omni bug <n> on the open pull request until ok', () => {
    expect(gaps(skillSection(read('bug-fix'), '12.'), [
      '**Write the body**',
      'to a file outside the repository',
      '`omni sign footer`',
      '`gh pr edit <pr> --body-file <file>`',
      '**Check it before ready:**',
      '`node .omni-loop/bin/omni.mjs bug <n>`',
      'reads the open pull request\'s body',
      'never before the pull request opens',
      'Run it until it prints `ok`',
    ])).toEqual([]);
  });

  it('never checks a body before the pull request opens: step 12 runs no omni bug --body-file', () => {
    expect(skillSection(read('bug-fix'), '12.')).not.toContain('bug <n> --body-file');
  });

  it('mends a proof fault in the body and edits the pull request again, and any other on the branch', () => {
    const step = skillSection(read('bug-fix'), '12.');
    for (const fault of [
      '`no ## Proof section`',
      '`## Proof has no image and no "GIF not produced - <reason>" line`',
      '`## Proof has no "Proved on" line`',
      '`the proof was not produced but #<pr> is not a draft',
    ]) expect(step, fault).toContain(fault);
    expect(step).toContain('is mended in the body file and put on the pull request again: no commit');
    expect(step).toContain('commit, push again');
  });

  it('marks the pull request ready only once omni bug printed ok on a produced proof, and keeps it a draft at level D', () => {
    expect(gaps(skillSection(read('bug-fix'), '12.'), [
      '**Watch it through `/omni:pr`**',
      '`gh pr ready <pr>`',
      'only once `omni bug <n>` printed `ok` on a produced proof',
      'At level D',
      'stays a draft',
      'never marks the pull request ready to get a CI run',
    ])).toEqual([]);
  });

  it('never marks the pull request ready before the check says ok, nor to get a CI run', () => {
    const never = skillSection(read('bug-fix'), 'Never');
    expect(never).toContain('**Never mark the PR ready before `omni bug <n>` printed `ok` on its open body**');
    expect(never).toContain('never mark it ready to get a CI run');
    expect(never).not.toContain('Never open the PR before');
  });

  it('names the commands step 12 runs, as the skill-steps guard reads them', () => {
    expect(stepsOf(read('bug-fix')).commands).toEqual(expect.arrayContaining(['bug', 'proof', 'dossier', 'sign', 'flow']));
  });
});

describe('stop rule 3 names the pull request that fixed the bug, only when proven', () => {
  it('step 7 finds candidates with git log --merges and gh pr list --state merged --search', () => {
    const step = skillSection(read('bug-fix'), '7.');
    expect(gaps(step, [
      '**Who fixed it.**',
      '**Candidates:**',
      '`git log --merges -- <files>`',
      '`gh pr list --state merged --search',
    ])).toEqual([]);
  });

  it('a candidate is proven only red at its merge commit\'s first parent and green at its merge commit', () => {
    const step = skillSection(read('bug-fix'), '7.');
    expect(gaps(step, [
      '**Proven:**',
      '**red at its merge commit\'s first parent**',
      '**green at its merge commit**',
      'A candidate you could not run at both commits is not proven',
    ])).toEqual([]);
  });

  it('writes Fixed by #<n> (or Fixed by <PR URL>) for the one proven candidate, with the two commits and the command', () => {
    const step = skillSection(read('bug-fix'), '7.');
    expect(gaps(step, [
      'For a proven candidate',
      'Fixed by #<n>',
      'Red at <short sha> (before #<n>), green at <short sha>: `<the reproduction\'s command>`',
      '`Fixed by <PR URL>` one elsewhere',
      'starts its line, stands alone on it and is written once',
    ])).toEqual([]);
  });

  it('with no proven candidate no line starts with Fixed by: each candidate is a Maybe: line and the two readings stay', () => {
    const step = skillSection(read('bug-fix'), '7.');
    expect(gaps(step, [
      '**No proven candidate:**',
      'no line starts with `Fixed by`',
      '`Maybe: #<n>`',
      'the reproduction misses the bug or the bug is already gone',
    ])).toEqual([]);
    const maybe = step.slice(step.indexOf('**No proven candidate:**'));
    expect(maybe.split('\n').filter((line: string) => /^\s*Fixed by\b/.test(line))).toEqual([]);
  });

  it('never closes the issue, and says so in the stop rule and in Never', () => {
    const text = read('bug-fix');
    expect(skillSection(text, '7.')).toContain('**The skill never closes the issue.**');
    expect(skillSection(text, 'Stop rules')).toContain('Never close the issue.');
    expect(skillSection(text, 'Stop rules')).toContain('only for a pull request proven red at its merge\'s first parent and green at its merge');
    expect(skillSection(text, 'Never')).toContain('**Never write a `Fixed by` line for a pull request that is not proven**, and never close the issue.');
  });

  it('/omni:mega-bug-fix writes the same comment in the plan repository, proving with the target\'s own committed commands', () => {
    const step = skillSection(read('mega-bug-fix'), '7.');
    expect(gaps(step, [
      '**Stop rule 3 names the fix,**',
      '`/omni:bug-fix`\'s **Who fixed it**',
      'the same comment on the issue in the plan repository',
      '`Fixed by <PR URL>`',
      'red at its merge commit\'s first parent and green at its merge commit',
      '`Maybe: #<n>`',
      'own committed setup, then its own committed preflight',
      'The skill never closes the issue',
    ])).toEqual([]);
  });
});
