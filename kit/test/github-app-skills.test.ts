// PRD 2433, s8: a job that runs as an API key's own GitHub App never names a person on GitHub. While
// `OMNI_GITHUB_APP` is set, `/omni:pr`, `/omni:bug-fix` and `/omni:mega-bug-fix` request no reviewer
// (even one the `pull-requests` form names), add no assignee and mention no `@login`: each skill
// says so in a paragraph of its own, and this guard fails when one of the three loses it. Kept out
// of `plugin.test.ts`, the test of locked laws BR-PRODUCT-3 and BR-PRODUCT-5.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');

/** The three skills whose words the guard holds. */
const SKILLS = ['pr', 'bug-fix', 'mega-bug-fix'] as const;

/** The bold lead every one of the three skills opens the paragraph with. */
const LEAD = '**Under `OMNI_GITHUB_APP`.**';

/** What the paragraph must say: each claim by its words, which are also what finds it. */
const CLAIMS: readonly string[] = [
  'request no reviewer',
  'even one the `pull-requests` form names',
  'add no assignee',
  'mention no `@login`',
];

/** The paragraph of `text` that starts at the lead, to the next blank line; `null` when there is none. */
function paragraphOf(text: string): string | null {
  const start = text.indexOf(LEAD);
  if (start === -1) return null;
  const end = text.indexOf('\n\n', start);
  return text.slice(start, end === -1 ? undefined : end);
}

/** What `text` lacks of the paragraph: one line per claim it does not say, or the missing paragraph. */
function lacks(text: string): string[] {
  const paragraph = paragraphOf(text);
  if (paragraph === null) return [`no paragraph starting with ${LEAD}`];
  return CLAIMS.filter((words) => !paragraph.includes(words)).map((words) => `the paragraph does not say "${words}"`);
}

const PARAGRAPH = [
  `${LEAD} While \`OMNI_GITHUB_APP\` is set, request no reviewer, even one the \`pull-requests\` form names,`,
  'add no assignee, and mention no `@login` in anything written on GitHub.',
].join('\n');

describe('the guard on a skill\'s words', () => {
  it('finds nothing missing in the whole paragraph', () => {
    expect(lacks(`# A skill\n\n${PARAGRAPH}\n\nThe next paragraph.`)).toEqual([]);
  });

  it('fails on a skill that lost the paragraph', () => {
    expect(lacks('# A skill\n\nThe next paragraph.')).toEqual([`no paragraph starting with ${LEAD}`]);
  });

  it.each(CLAIMS)('fails on a paragraph that dropped "%s"', (words) => {
    expect(lacks(PARAGRAPH.replace(words, 'something else'))).toEqual([`the paragraph does not say "${words}"`]);
  });

  it('does not take a claim from outside the paragraph', () => {
    const outside = `${PARAGRAPH.replace('add no assignee', 'assign nobody')}\n\nIt may add no assignee elsewhere.`;
    expect(lacks(outside)).toEqual(['the paragraph does not say "add no assignee"']);
  });
});

describe('/omni:pr, /omni:bug-fix and /omni:mega-bug-fix under OMNI_GITHUB_APP (PRD 2433)', () => {
  it.each(SKILLS)('/omni:%s requests no reviewer, adds no assignee and mentions no @login', (skill) => {
    const text = readFileSync(join(ROOT, 'kit', 'plugin', 'skills', skill, 'SKILL.md'), 'utf8');
    expect(lacks(text)).toEqual([]);
  });
});
