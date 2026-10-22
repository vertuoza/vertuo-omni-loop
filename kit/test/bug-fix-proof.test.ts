// PRD 1972, s4: `/omni:bug-fix` films every bug and opens its pull request with `## Proof` (the
// before/after GIF and the failing and passing lines), or as a draft that says why; `/omni:mega-bug-fix`
// leaves `## Proof` out. PRD 2100, s5: the body is checked by `omni bug <n> --body-file` before the pull
// request opens, clips that fail fall back to the GIF of the two outputs, a component bug's `## Proof`
// links its clips, and stop rule 3 names the pull request that already fixed the bug, only when proven.
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

  it('step 12 commits, pushes, sends the dossier, films, pushes the proof, checks the body, then opens the pull request', () => {
    const step = skillSection(read('bug-fix'), '12.');
    expect(gaps(step, [
      '**Commit**',
      'git push -u <remote> <fix branch>',
      '/omni:dossier-push <n> --kind bug',
      'omni.mjs bug film',
      'omni.mjs proof push --kind bug <n> <folder>',
      '**Write the body**',
      'omni.mjs bug <n> --body-file <file>',
      'Open the PR through `/omni:pr`',
    ])).toEqual([]);
  });

  it('the body has ## Proof right after What was wrong, with the GIF, the Clips line and the failing and passing lines', () => {
    const step = skillSection(read('bug-fix'), '12.');
    expect(gaps(step, [
      '## What was wrong',
      '## Proof',
      '![Before and after the fix](<the GIF\'s stable link>)',
      'Clips: [before](<the before.webm link>) · [after](<the after.webm link>)',
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

describe('step 12 checks the body before the pull request opens', () => {
  it('runs omni bug <n> --body-file until ok, and opens the pull request with that same file', () => {
    const step = skillSection(read('bug-fix'), '12.');
    expect(gaps(step, [
      '`node .omni-loop/bin/omni.mjs bug <n> --body-file <file>`. Run it until it prints',
      '`ok`',
      '**Open the PR through `/omni:pr`**',
      'only once',
      '`omni bug <n> --body-file <file>` printed `ok`',
      '**that same file**',
      '`gh pr create --body-file <file>`',
    ])).toEqual([]);
  });

  it('writes the body to a file before it is checked, ending with the sign footer', () => {
    const step = skillSection(read('bug-fix'), '12.');
    expect(gaps(step, ['**Write the body**', 'to a file outside the repository', '`omni sign footer`', 'This one file is checked, then opened'])).toEqual([]);
  });

  it('mends a proof fault in the body file, and any other on the branch', () => {
    const step = skillSection(read('bug-fix'), '12.');
    for (const fault of [
      '`no ## Proof section`',
      '`## Proof has no image and no "GIF not produced - <reason>" line`',
      '`## Proof\'s image has no "Before the fix" or "After the fix" line`',
    ]) expect(step, fault).toContain(fault);
    expect(step).toContain('is mended in the body file: no commit');
    expect(step).toContain('commit, push again');
  });

  it('a pinned omni that refuses the flag (exit 2) gets omni bug <n> without it, and the hand-off says it did not check the body', () => {
    const step = skillSection(read('bug-fix'), '12.');
    expect(gaps(step, [
      '`2`',
      '`omni bug: unknown flag --body-file.`',
      '`node .omni-loop/bin/omni.mjs bug <n>` without it',
      'did not check the body',
      'Any other exit 2',
      'say so and stop',
    ])).toEqual([]);
  });

  it('never opens the pull request before the check says ok, unless the flag was refused', () => {
    const text = read('bug-fix');
    expect(skillSection(text, 'Never')).toContain('**Never open the PR before `omni bug <n> --body-file` printed `ok`**, unless the pinned omni refused the flag.');
  });

  it('names the commands step 12 runs, as the skill-steps guard reads them', () => {
    expect(stepsOf(read('bug-fix')).commands).toEqual(expect.arrayContaining(['bug', 'proof', 'dossier', 'sign']));
  });
});

describe('clips that fail fall back to the GIF of the two outputs', () => {
  it('a story that cannot be filmed, or clips ffmpeg cannot stitch, make the GIF of red.txt and green.txt and say so', () => {
    const step = skillSection(read('bug-fix'), '12.');
    expect(gaps(step, [
      '**Clips that fail make the GIF of the two outputs.**',
      '`ffmpeg not found`',
      '`ffmpeg failed: <its last line>`',
      'no reason for a draft',
      '`red.txt` and `green.txt`',
      'leave out the `Clips:` line',
      '`Storybook not filmed - <reason>`',
      '`ffmpeg not found` included',
    ])).toEqual([]);
  });

  it('the draft\'s reason table has no ffmpeg not found row', () => {
    const rows = tableRows(skillSection(read('bug-fix'), '12.'));
    expect(rows.filter((row: string) => row.includes('ffmpeg not found'))).toEqual([]);
    expect(rows.some((row: string) => row.includes('the pinned omni is too old: run omni update'))).toBe(true);
  });

  it('a GIF that is not made opens the pull request as a draft that says why, never stopping the skill', () => {
    const step = skillSection(read('bug-fix'), '12.');
    expect(step).toContain('GIF not produced - <reason>');
    expect(step).toContain('as a **draft**');
    for (const reason of [
      '`the pinned omni is too old: run omni update`',
      '`proof push: <its line>`',
      '`red not proven here`',
    ]) expect(step, reason).toContain(reason);
    expect(step).not.toContain('`ffmpeg not found` |');
  });

  it('/omni:mega-bug-fix takes the body from What was wrong on without ## Proof', () => {
    expect(read('mega-bug-fix')).toContain('without its `## Proof` section');
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
