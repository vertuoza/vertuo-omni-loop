// The contract of `/omni:rewind` (PRD 2410, s6), read as text, as retro-apply-skill.test.ts reads
// retro-apply's: it starts from the break, runs the seven checks in order, tests the premise before it
// names a cause, names each finding's origin and, for a repository finding, the strongest level that
// would have stopped it, pushes through `omni rewind push`, writes nothing to the repository, never
// merges, and signs every finding as an agent's. The runner lists that name it are tested where they
// live (kit/lib/runner/line.test.ts, runners.contract.test.ts, guide.test.ts).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { COMMAND_TABLE } from '../bin/commands/index.ts';
import { REWIND_CHECKS, REWIND_ORIGINS } from '../lib/rewind/findings.ts';

const TEXT = readFileSync(fileURLToPath(new URL('../plugin/skills/rewind/SKILL.md', import.meta.url)), 'utf8');
const FLAT = TEXT.replace(/\s+/g, ' ');

/** Where `needle` first appears in the skill, failing the test when it does not. */
function at(needle: string): number {
  const index = FLAT.indexOf(needle);
  expect(index, needle).toBeGreaterThanOrEqual(0);
  return index;
}

describe('the rewind skill', () => {
  it('parses, is named for its folder and says when it runs', () => {
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(TEXT);
    const data = parseYaml(match?.[1] ?? '') as { name?: unknown; description?: unknown };
    expect(data.name).toBe('rewind');
    expect(String(data.description)).toMatch(/Triggers on .*\/omni:rewind/);
  });

  it('refuses, in one line and writing nothing, a PRD that did not break main', () => {
    expect(FLAT).toContain('rewind: PRD <n> did not break main: nothing to rewind.');
    expect(FLAT).toContain('push nothing and stop');
  });

  it('starts from the break, read with omni rewind facts, before the first check', () => {
    expect(at('rewind facts <n>')).toBeLessThan(at('### 1. The reviews'));
    expect(FLAT).toContain('Start from the break');
  });

  it('runs the seven checks in order: reviews, CI, bodies against the pull-requests form, waves, plan, spec and answers, knowledge', () => {
    const headings = ['### 1. The reviews', '### 2. The CI', '### 3. The pull request bodies', '### 4. The waves', '### 5. The plan', '### 6. The spec and its answers', '### 7. The knowledge'];
    const places = headings.map(at);
    expect(places).toEqual([...places].sort((a, b) => a - b));
    expect(FLAT).toContain('kb show pull-requests');
    expect(FLAT).toContain('kb laws --paths');
    for (const word of ['kept', 'drifted', 'broken']) expect(FLAT).toContain(`**${word}**`);
  });

  it('names every check and origin the push takes, and no other', () => {
    for (const check of REWIND_CHECKS) expect(FLAT, check).toContain(`\`${check}\``);
    for (const origin of REWIND_ORIGINS) expect(FLAT, origin).toContain(`\`${origin}\``);
  });

  it('writes the premise every failed fix assumed and tests it before naming the one cause', () => {
    const premise = at('**The premise.**');
    expect(premise).toBeLessThan(at('**The cause.**'));
    expect(FLAT).toContain('write the premise every earlier fix assumed');
    expect(FLAT).toContain('test it against the evidence');
    expect(FLAT).toContain('name the one cause the evidence points to');
  });

  it('gives a repository finding the strongest level that would have stopped it, docs last', () => {
    expect(FLAT).toContain('architecture, then types, then a lint, then a test, and docs last');
  });

  it('pushes the findings from a scratch file outside the repository, once each', () => {
    expect(FLAT).toContain('rewind push <n> --file <findings file>');
    expect(FLAT).toContain('outside the repository');
    expect(FLAT).toContain('already proposed');
  });

  it('writes nothing to the repository and never merges', () => {
    expect(FLAT).toContain('writes nothing to the repository');
    expect(FLAT).toMatch(/never merges/);
    for (const verb of [/\bgit\s+(?:commit|push|add|stash)\b/, /\bgh\s+pr\s+(?:merge|create|edit|ready|comment|review)\b/, /\bgh\s+issue\s+(?:create|edit|comment|close)\b/, /--add-label/, /--remove-label/]) {
      expect(TEXT).not.toMatch(verb);
    }
  });

  it('signs every finding as written by an agent, never in a person\'s name', () => {
    expect(TEXT).toContain('Written by an agent (/omni:rewind), not by a person.');
    expect(FLAT).toContain('speaks in no person\'s name');
  });

  it('asks nothing on a runner, and leaves an Omni-setup finding free of the workspace\'s names', () => {
    expect(FLAT).toContain('OMNI_UNATTENDED');
    expect(FLAT).toContain('asks nothing');
    expect(FLAT).toContain('names no repository, no code of the workspace and no person');
  });

  it('names only commands the CLI has', () => {
    for (const command of ['rewind', 'config', 'session', 'prd', 'kb', 'dossier', 'board']) expect(COMMAND_TABLE, command).toHaveProperty(command);
  });
});
