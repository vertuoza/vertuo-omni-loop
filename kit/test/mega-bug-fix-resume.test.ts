// `/omni:mega-bug-fix` run again on an issue whose fix plan already names a pull request resumes the
// stopped fix on its pushed branches instead of starting over, and a stop that a rerun can finish ends
// its hand-off on the line that resumes it, which the runner reads as stopped mid-way (log.ts,
// `fixOutcome`), so the Omni page offers Resume.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const TEXT = readFileSync(new URL('../plugin/skills/mega-bug-fix/SKILL.md', import.meta.url), 'utf8');

/** A text with each run of whitespace made one space: prose wraps its lines anywhere. */
const flat = (text: string) => text.replace(/\s+/g, ' ');

/** The `## ` section whose heading starts with `start`, up to the next `## ` heading outside a fence. */
function section(start: string) {
  const lines = TEXT.split('\n');
  let fenced = false;
  let from = -1;
  for (const [index, line] of lines.entries()) {
    if (line.trim().startsWith('```')) fenced = !fenced;
    else if (!fenced && line.startsWith('## ')) {
      if (from >= 0) return flat(lines.slice(from, index).join('\n'));
      if (line.startsWith(`## ${start}`)) from = index;
    }
  }
  return from < 0 ? '' : flat(lines.slice(from).join('\n'));
}

/** The mentions of `order` missing from `text` or out of order: empty when all appear in turn. */
const gaps = (text: string, order: string[]) => {
  let at = 0;
  return order.filter((mention) => {
    const found = text.indexOf(mention, at);
    if (found < 0) return true;
    at = found + mention.length;
    return false;
  });
};

describe('/omni:mega-bug-fix: a rerun resumes a stopped fix', () => {
  it('step 1 sends an issue whose fix plan names a PR, or whose triage names a branch, to the resume', () => {
    expect(gaps(section('1. Issue'), [
      'fix plan (step 5\'s lookup) already names a pull request in a row',
      'triage\'s **Branch** line already names a fix branch',
      'follow **Resuming a stopped fix** from here, not steps 2 to 6',
      'a rerun never starts the fix over',
    ])).toEqual([]);
  });

  it('keeps the triage and the fix plan, and takes each row by its pull request', () => {
    const resume = section('Resuming a stopped fix');
    expect(resume).toContain('The triage, the fix plan and the boundary stand as they are');
    expect(gaps(resume, [
      '| merged, or open and not a draft | nothing: it is done |',
      '| open and a draft, labelled `labels.needsFix` or not | resumed on its branch, below |',
      '| `—`, with its fix branch on the target\'s remote | resumed on that branch',
      '| `—`, with no fix branch | step 7, as written |',
      '| closed unmerged | stop: a person closed it.',
    ])).toEqual([]);
    expect(resume).toContain('a rerun never opens a second one');
  });

  it('resumes on the pushed branch, keeps the red, and starts the attempts again', () => {
    expect(gaps(section('Resuming a stopped fix'), [
      'The pushed branch is what resumes',
      'git -C <clone> worktree add -B <fix branch> <worktrees>/targets/<name>--fix-<n> <clone remote>/<fix branch>',
      'The branch\'s first commit over the target\'s default branch is the reproduction',
      '**The branch holds the reproduction alone:** prove red on it as step 7 says',
      '**It holds more** (a fix was tried, so red was seen first): the red stands.',
      'That run spends no attempt.',
      'A rerun is a job of its own, so `limits.attempts` starts again.',
      '`git push <clone remote> <fix branch>`, never forced',
      '`gh pr ready <pr>`',
      '`gh pr edit <pr> --remove-label "<labels.needsFix>"`',
      '`Resumed: green at <sha>`',
    ])).toEqual([]);
  });

  it('ends a stop a rerun can finish on the line that resumes it, and only such a stop', () => {
    const handOff = section('10. Hand off');
    expect(gaps(handOff, [
      '**A stop a rerun can finish** (stop rule 5 in any target, or a target that could not be cloned or pushed to',
      'ends on exactly one last line, nothing after it',
      '/omni:mega-bug-fix #<n>',
      'Every other stop keeps its own last line',
    ])).toEqual([]);
  });

  it('Never starts a fix over, rewrites a resumed branch or forces a push', () => {
    expect(section('Never')).toContain(
      '**Never start a fix over on an issue whose fix plan names a pull request:** resume it. Never rewrite a resumed branch, and never force a push.',
    );
  });
});
