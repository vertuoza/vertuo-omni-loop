// PRD 2425, slice s2: how `/omni:bug-fix` and `/omni:mega-bug-fix` end is one word on the hand-off's
// `Outcome:` line, and a bug that was already fixed names the pull request that fixed it on one `Fixed by:`
// line. The words are `BUG_FIX_OUTCOMES`, which a runner reads back with `bugFixReading`. Each skill's text
// is held to them here: a stop rule that names no word, a word the runner would not know, or a `Fixed by:`
// line anywhere but beside the proven pull request of stop rule 3 fails. The checks are plain functions of
// a skill's text, so the broken copies at the end show each one failing.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BUG_FIX_OUTCOMES, bugFixReading } from '../lib/runner/log.ts';

const WORDS: ReadonlySet<string> = new Set(BUG_FIX_OUTCOMES);

/** The words of `/omni:bug-fix`'s stop rules: the ones each rule's `Outcome:` line may carry, and no other. */
const RULES: Readonly<Record<number, readonly string[]>> = {
  1: ['not-a-bug'],
  2: ['need-human'],
  3: ['already-fixed'],
  4: ['needs-brainstorm', 'need-human'],
  5: ['stuck'],
  6: ['blocked'],
  7: ['blocked'],
};

/** Where each skill names its words outside the stop rules: the heading each part starts with, and the words it names. */
const PLACES: Readonly<Record<string, readonly (readonly [string, readonly string[]])[]>> = {
  'bug-fix': [
    ['13. Hand off', ['pr-opened']],
    ['Asking on a runner', ['need-human', 'needs-brainstorm']],
    ['Resuming with answers', ['blocked', 'needs-brainstorm']],
  ],
  'mega-bug-fix': [
    ['6. The boundary', ['needs-brainstorm', 'need-human']],
    ['7. Each target', ['already-fixed', 'blocked']],
    ['10. Hand off', ['pr-opened']],
    ['Asking on a runner', ['need-human', 'needs-brainstorm']],
    ['Resuming with answers', ['blocked', 'needs-brainstorm']],
  ],
};

/** The only sections of each skill where a `Fixed by:` line may be written: the ones that say who fixed a bug. */
const FIXED_BY: Readonly<Record<string, readonly string[]>> = {
  'bug-fix': ['7. Prove red', 'The outcome line', 'Stop rules'],
  'mega-bug-fix': ['7. Each target'],
};

const read = (name: string) => readFileSync(new URL(`../plugin/skills/${name}/SKILL.md`, import.meta.url), 'utf8');

/** A text with each run of whitespace made one space: prose wraps its lines anywhere. */
const flat = (text: string) => text.replace(/\s+/g, ' ').trim();

type Part = { heading: string; body: string };

/** The text before the first `## ` heading (its heading is empty), then each `## ` section, a fenced block never ending one. */
function sections(text: string): Part[] {
  const parts: Part[] = [{ heading: '', body: '' }];
  let fenced = false;
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('```')) fenced = !fenced;
    if (!fenced && line.startsWith('## ')) parts.push({ heading: line.slice(3), body: '' });
    else {
      const last = parts.at(-1);
      if (last !== undefined) last.body += `${line}\n`;
    }
  }
  return parts;
}

/** The body of the section whose heading starts with `start`, or an empty text. */
const part = (text: string, start: string) => sections(text).find((each) => each.heading.startsWith(start))?.body ?? '';

/** The units of prose of `text`, each on one line: its paragraphs, split again before every list item, numbered or bulleted. */
const units = (text: string): string[] => text.split(/\n\s*\n|\n(?=(?:\d+\.|-) )/).map(flat).filter((unit) => unit !== '');

/** The words `Outcome: <word>` that `text` names in code spans, in order. */
const wordsIn = (text: string): string[] => [...text.matchAll(/`Outcome: ([a-z-]+)`/g)].flatMap((match) => match[1] ?? []);

const sameWords = (found: readonly string[], expected: readonly string[]) => [...new Set(found)].sort().join() === [...expected].sort().join();

/** What is wrong with `/omni:bug-fix`'s stop rules: each names the word or words of its end, a word the runner knows, and no `Fixed by:` but rule 3's. */
function stopRuleProblems(text: string): string[] {
  const items = units(part(text, 'Stop rules')).filter((unit) => /^\d+\. /.test(unit));
  const numbers = items.map((item) => Number(/^(\d+)\./.exec(item)?.[1]));
  const missing = Object.keys(RULES).filter((number) => !numbers.includes(Number(number))).map((number) => `stop rule ${number} is missing`);
  const wrong = items.flatMap((item) => {
    const number = Number(/^(\d+)\./.exec(item)?.[1]);
    const label = `stop rule ${String(number)}`;
    const named = wordsIn(item);
    if (named.length === 0) return [`${label} names no word`];
    const expected = RULES[number];
    return [
      ...named.filter((word) => !WORDS.has(word)).map((word) => `${label} names ${word}, which is no outcome word`),
      ...(expected === undefined || sameWords(named, expected) ? [] : [`${label} names ${named.join(', ')}, not ${expected.join(', ')}`]),
      ...(number !== 3 && item.includes('Fixed by:') ? [`${label} writes a Fixed by: line`] : []),
    ];
  });
  return [...missing, ...wrong];
}

/** What is wrong with where `text` writes a `Fixed by:` line: only in `allowed` sections, only beside a proven pull request. */
function fixedByProblems(text: string, allowed: readonly string[]): string[] {
  return sections(text).flatMap(({ heading, body }) =>
    units(body)
      .filter((unit) => unit.includes('Fixed by:'))
      .flatMap((unit) => {
        if (!allowed.some((start) => heading.startsWith(start))) return [`Fixed by: is written in "${heading}"`];
        return /\bproven\b/.test(unit) ? [] : [`Fixed by: is written beside no proven pull request: ${unit.slice(0, 60)}`];
      }),
  );
}

/** The words that `text`, a whole skill, names with `Outcome: <word>` and the runner would not know. */
const unknownWords = (text: string) => wordsIn(text).filter((word) => !WORDS.has(word));

/** What each place of a skill that should name words lacks. */
function placeProblems(name: string, text: string): string[] {
  return (PLACES[name] ?? []).flatMap(([heading, expected]) => {
    const named = wordsIn(part(text, heading));
    return expected.filter((word) => !named.includes(word)).map((word) => `"${heading}" does not name Outcome: ${word}`);
  });
}

describe('the bug fix outcome lines (PRD 2425, s2)', () => {
  const bugFix = read('bug-fix');
  const mega = read('mega-bug-fix');

  describe('/omni:bug-fix', () => {
    it('ends every stop rule on the word of its end', () => {
      expect(stopRuleProblems(bugFix)).toEqual([]);
    });

    it('writes the outcome line at its hand-off, its runner ask, its answers and its stop, and nowhere on a word the runner would not know', () => {
      expect(placeProblems('bug-fix', bugFix)).toEqual([]);
      expect(unknownWords(bugFix)).toEqual([]);
    });

    it('tells all seven words in its outcome section, as one plain line written once', () => {
      const body = flat(part(bugFix, 'The outcome line'));
      for (const word of BUG_FIX_OUTCOMES) expect(body).toContain(`| \`${word}\` |`);
      expect(body).toContain('`Outcome: <word>`');
      expect(body).toContain('no bullet, no quote, no bold, no code span');
      expect(body).toContain('written once');
    });

    it('writes Fixed by: only for the pull request it proved', () => {
      expect(fixedByProblems(bugFix, FIXED_BY['bug-fix'] ?? [])).toEqual([]);
      expect(flat(part(bugFix, 'The outcome line'))).toContain('A `Maybe:` candidate never gets one');
      expect(flat(part(bugFix, 'Never'))).toContain('Never write a `Fixed by` line for a pull request that is not proven');
    });
  });

  describe('/omni:mega-bug-fix', () => {
    it('writes blocked where all or nothing across targets stops the fix', () => {
      const paragraph = units(mega).find((unit) => unit.startsWith('**All or nothing across targets.**'));
      expect(wordsIn(paragraph ?? '')).toEqual(['blocked']);
    });

    it('names the same seven words, and no other, in one paragraph', () => {
      const paragraph = units(mega).find((unit) => unit.startsWith('**The outcome line**'));
      expect(sameWords(wordsIn(paragraph ?? ''), BUG_FIX_OUTCOMES)).toBe(true);
      expect(unknownWords(mega)).toEqual([]);
    });

    it('writes the outcome line at each end it has: the boundary, a target, the hand-off, the runner ask and the answers', () => {
      expect(placeProblems('mega-bug-fix', mega)).toEqual([]);
    });

    it('writes Fixed by: only for the pull request it proved', () => {
      expect(fixedByProblems(mega, FIXED_BY['mega-bug-fix'] ?? [])).toEqual([]);
    });
  });

  describe('the guard', () => {
    it('fails when a stop rule names no word', () => {
      expect(stopRuleProblems(bugFix.replace('`Outcome: stuck`', 'nothing'))).toEqual(['stop rule 5 names no word']);
    });

    it('fails when a stop rule is added with no word', () => {
      expect(stopRuleProblems(bugFix.replace('For rules 3, 4 and 7', '8. A new stop.\n\nFor rules 3, 4 and 7'))).toEqual(['stop rule 8 names no word']);
    });

    it('fails when a stop rule names a word the runner would not know, or another rule\'s', () => {
      const unknown = stopRuleProblems(bugFix.replace('`Outcome: stuck`', '`Outcome: gave-up`'));
      expect(unknown).toContain('stop rule 5 names gave-up, which is no outcome word');
      expect(unknown).toContain('stop rule 5 names gave-up, not stuck');
      expect(stopRuleProblems(bugFix.replace('`Outcome: stuck`', '`Outcome: blocked`'))).toEqual(['stop rule 5 names blocked, not stuck']);
    });

    it('fails when stop rule 4 names one of its two words only', () => {
      expect(stopRuleProblems(bugFix.replace(', or `Outcome: need-human` on a runner', ' on a runner'))).toEqual(['stop rule 4 names needs-brainstorm, not needs-brainstorm, need-human']);
    });

    it('fails when a stop rule is missing', () => {
      expect(stopRuleProblems(bugFix.replace('7. The bug lives in the build', 'The bug lives in the build'))).toEqual(['stop rule 7 is missing']);
    });

    it('fails when a Fixed by: line is written in another stop rule', () => {
      const problems = stopRuleProblems(bugFix.replace('`Outcome: stuck`', '`Outcome: stuck`, then `Fixed by: https://github.com/o/r/pull/1`'));
      expect(problems).toEqual(['stop rule 5 writes a Fixed by: line']);
    });

    it('fails when a Fixed by: line is written in a section that does not say who fixed a bug', () => {
      const problems = fixedByProblems(`${bugFix}\n## Extra\n\nWrite Fixed by: <PR URL> for the proven pull request.\n`, FIXED_BY['bug-fix'] ?? []);
      expect(problems).toEqual(['Fixed by: is written in "Extra"']);
      expect(fixedByProblems(mega.replace('10. Hand off\n', '10. Hand off\n\nEnd on Fixed by: <PR URL>, the proven one.\n'), FIXED_BY['mega-bug-fix'] ?? [])).toEqual(['Fixed by: is written in "10. Hand off"']);
    });

    it('fails when a Fixed by: line is written beside no proven pull request', () => {
      const edited = bugFix.replace('- **The skill never closes the issue.**', '- Write `Fixed by: <PR URL>` for each candidate.\n- **The skill never closes the issue.**');
      expect(fixedByProblems(edited, FIXED_BY['bug-fix'] ?? [])).toEqual(['Fixed by: is written beside no proven pull request: - Write `Fixed by: <PR URL>` for each candidate.']);
    });

    it('fails when a place loses its word', () => {
      expect(placeProblems('bug-fix', bugFix.replaceAll('`Outcome: pr-opened`', 'the outcome'))).toEqual(['"13. Hand off" does not name Outcome: pr-opened']);
      expect(placeProblems('mega-bug-fix', mega.replaceAll('`Outcome: pr-opened`', 'the outcome'))).toEqual(['"10. Hand off" does not name Outcome: pr-opened']);
    });
  });

  describe('what a runner reads of the lines the skills write', () => {
    const link = 'https://github.com/demo-org/example/pull/7';

    it.each(BUG_FIX_OUTCOMES)('reads %s from a hand-off, stamped or not', (word) => {
      expect(bugFixReading(`10:00:00 Done: ok · 4 turns\n10:00:01 Outcome: ${word}\n10:00:01 Review the PR and merge it if it is right.\n`)).toEqual({ outcome: word, fixedBy: null, prs: [] });
      expect(bugFixReading(`Outcome: ${word}\n`).outcome).toBe(word);
    });

    it('reads the proven pull request of stop rule 3 as the one that fixed the bug, and none of its Maybe: lines', () => {
      const log = `10:00:00 Done: ok · 4 turns\n10:00:01 Outcome: already-fixed\n10:00:01 Fixed by: ${link}\n10:00:01 Maybe: #9\n`;
      expect(bugFixReading(log)).toEqual({ outcome: 'already-fixed', fixedBy: link, prs: [] });
    });

    it('reads the comment\'s Fixed by #<n> and a Maybe: line as no pull request that fixed the bug', () => {
      expect(bugFixReading('Outcome: already-fixed\nFixed by #7\nMaybe: https://github.com/demo-org/example/pull/9\n')).toEqual({ outcome: 'already-fixed', fixedBy: null, prs: [] });
    });

    it('reads a formatted line as none, which is why the skill writes it plain', () => {
      for (const formatted of ['- Outcome: stuck', '> Outcome: stuck', '**Outcome: stuck**', '`Outcome: stuck`']) expect(bugFixReading(`${formatted}\n`).outcome).toBeNull();
    });
  });
});
