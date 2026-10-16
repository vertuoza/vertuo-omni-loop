// PRD 1972, s4: `/omni:bug-fix` films every bug and opens its pull request with `## Proof` (the
// before/after GIF and the failing and passing lines), or as a draft that says why; `/omni:mega-bug-fix`
// leaves `## Proof` out. These tests live apart from the law proofs of BR-PRODUCT-3, BR-PRODUCT-5 and
// N-PRODUCT-15 in `plugin.test.ts`, and change none of them.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

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

describe('the bug-fix skill films the bug and shows it in the pull request', () => {
  const gaps = (text: string, mentions: string[]) => {
    const out: string[] = [];
    let from = 0;
    mentions.forEach((mention: string, index: number) => {
      const at = text.indexOf(mention, from);
      if (at < 0) out.push(`${mention} after ${mentions[index - 1] ?? 'the start'}`);
      else from = at + mention.length;
    });
    return out;
  };

  it('step 7 writes the red output to red.txt in the run folder, and films a component bug to before.webm', () => {
    const step = skillSection(read('bug-fix'), '7.');
    expect(gaps(step, ['<worktrees>/proof-bug-<n>/<run>/', '`red.txt`', 'component bug', 'Storybook', 'Playwright', '1280×720', '`before.webm`'])).toEqual([]);
  });

  it('step 8 writes green.txt, films the same story to after.webm, then stops Storybook', () => {
    const step = skillSection(read('bug-fix'), '8.');
    expect(gaps(step, ['`green.txt`', '`after.webm`', 'stops Storybook'])).toEqual([]);
  });

  it('step 12 pushes, sends the dossier, films, pushes the proof, then opens the pull request', () => {
    const step = skillSection(read('bug-fix'), '12.');
    expect(gaps(step, [
      'git push -u <remote> <fix branch>',
      '/omni:dossier-push <n> --kind bug',
      'omni.mjs bug film',
      'omni.mjs proof push --kind bug <n> <folder>',
      'Open the PR through `/omni:pr`',
    ])).toEqual([]);
  });

  it('the body has ## Proof right after What was wrong, with the GIF and the failing and passing lines', () => {
    const step = skillSection(read('bug-fix'), '12.');
    expect(gaps(step, ['## What was wrong', '## Proof', '![Before and after the fix](<the GIF\'s stable link>)', '**Before the fix** (red): `<the failing line>`', '**After the fix** (green, `<short sha>`): `<the passing line>`', '## Bug'])).toEqual([]);
  });

  it('a story that cannot be filmed falls back to the two outputs and says so', () => {
    const step = skillSection(read('bug-fix'), '12.');
    expect(step).toContain('Storybook not filmed - <reason>');
    expect(step).toContain('the two outputs');
  });

  it('a GIF that is not made opens the pull request as a draft that says why, never stopping the skill', () => {
    const step = skillSection(read('bug-fix'), '12.');
    expect(step).toContain('GIF not produced - <reason>');
    expect(step).toContain('as a **draft**');
    for (const reason of [
      '`ffmpeg not found`',
      '`the pinned omni is too old: run omni update`',
      '`proof push: <its line>`',
      '`red not proven here`',
    ]) expect(step, reason).toContain(reason);
  });

  it('/omni:mega-bug-fix takes the body from What was wrong on without ## Proof', () => {
    expect(read('mega-bug-fix')).toContain('without its `## Proof` section');
  });
});
