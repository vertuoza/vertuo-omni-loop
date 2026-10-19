// Plain git and gh in the skills (bug 2189): an agent isolated in a worktree runs a skill's commands
// under Claude Code's worktree guard, which refuses a `git` or `gh` it cannot see whole: one inside a
// command substitution, `$(gh … | head -n 1)`. So no skill wraps `git` or `gh` in `$(…)`; it runs
// the command plainly and reads what it prints. The rule is proven on fixtures first, then on every
// file of the plugin's skills.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const skillsDir = fileURLToPath(new URL('../plugin/skills', import.meta.url));

/** `git` or `gh` run inside a command substitution, as the guard sees it. */
const HIDDEN = /\$\(\s*(?:git|gh)\s/;

/** Each line of `text` that hides a `git` or `gh` in `$(…)`, as `<line>: <text>`. */
const hidden = (text: string): string[] =>
  text.split('\n').flatMap((line, index) => (HIDDEN.test(line) ? [`${String(index + 1)}: ${line.trim()}`] : []));

/** Every Markdown file under `dir`. */
const markdownUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => join(entry.parentPath, entry.name));

describe('a git or gh hidden in a command substitution', () => {
  it('is found in $(gh …) and $(git …), piped or not', () => {
    expect(hidden('ID=$(gh api "repos/x/issues/1/comments" --jq ".[] | .id" | head -n 1)')).toHaveLength(1);
    expect(hidden('OLD=$(gh pr view 3 --json headRefOid --jq .headRefOid)')).toHaveLength(1);
    expect(hidden('git diff --name-only $(git merge-base origin/main HEAD)..HEAD')).toHaveLength(1);
    expect(hidden('"$( git hash-object -- a.md | cut -c1-7)"')).toHaveLength(1);
  });

  it('is not found in a plain command, or a substitution of anything else', () => {
    expect(hidden('gh api repos/x/issues/1/comments --paginate --jq \'.[] | .id\'')).toEqual([]);
    expect(hidden('git merge-base origin/main HEAD')).toEqual([]);
    expect(hidden('BODY=$(mktemp)')).toEqual([]);
    expect(hidden('MARK="<!-- $(node .omni-loop/bin/omni.mjs config markers.prefix)-status -->"')).toEqual([]);
    expect(hidden('$(github-thing)')).toEqual([]);
  });
});

describe('the plugin\'s skills (bug 2189)', () => {
  it('run git and gh as plain commands, never inside $(…)', () => {
    const found = markdownUnder(skillsDir).flatMap((path) => hidden(readFileSync(path, 'utf8')).map((line) => `${relative(skillsDir, path)}:${line}`));
    expect(found).toEqual([]);
  });
});
