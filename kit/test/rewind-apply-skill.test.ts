// The contract of `/omni:rewind-apply` (PRD 2498, s3), read as text, as retro-apply-skill.test.ts reads
// retro-apply's: what it refuses, the three outcomes it records once with `omni rewind outcome`, the knowledge
// branch and its one docs-only pull request, its boundary (this repository's own knowledge only, never the
// kit, never a locked law, never a merge) and how it signs. The runner lists that name it are tested where
// they live (kit/lib/runner/line.test.ts, runners.contract.test.ts, guide.test.ts).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { COMMAND_TABLE } from '../bin/commands/index.ts';

const TEXT = readFileSync(fileURLToPath(new URL('../plugin/skills/rewind-apply/SKILL.md', import.meta.url)), 'utf8');
const FLAT = TEXT.replace(/\s+/g, ' ');

describe('the rewind-apply skill', () => {
  it('parses, is named for its folder and says when it runs', () => {
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(TEXT);
    const data = parseYaml(match?.[1] ?? '') as { name?: unknown; description?: unknown };
    expect(data.name).toBe('rewind-apply');
    expect(String(data.description)).toMatch(/Triggers on .*\/omni:rewind-apply/);
  });

  it('takes the PRD and the finding, the line Approve queues, and reads the finding with omni rewind facts', () => {
    expect(FLAT).toContain('/omni:rewind-apply <prd> <finding>');
    expect(FLAT).toContain('omni.mjs rewind facts <prd> --json');
  });

  it('refuses, in one line and writing nothing, a finding it cannot settle', () => {
    expect(FLAT).toContain('rewind-apply: no finding <finding> on PRD <prd>: nothing to settle.');
    expect(FLAT).toContain('rewind-apply: finding <finding> is <state>, not approved: nothing to settle.');
    expect(FLAT).toContain('rewind-apply: finding <finding> already has its outcome: nothing to settle.');
    expect(FLAT).toContain('rewind-apply: finding <finding> started in <origin>, not in knowledge: nothing to settle.');
  });

  it('proposes one playbook bullet ending (rewind of PRD <prd>), or one register entry marked Proposed: rewind <date>', () => {
    expect(FLAT).toContain('ending `(rewind of PRD <prd>)`');
    expect(FLAT).toContain('`Proposed: rewind <YYYY-MM-DD>`');
    expect(FLAT).toContain('never a `Locked:` line');
  });

  it('commits it on the knowledge branch, rewind-<prd>-<finding>, cut from the default branch, as one docs-only pull request', () => {
    expect(FLAT).toContain('`branches.knowledge` with `{topic}` = `rewind-<prd>-<short>`');
    expect(FLAT).toContain('<remote>/<default branch>');
    expect(FLAT).toContain('one docs-only pull request into the default branch');
    expect(FLAT).toContain('exactly one file, under `paths.knowledge`');
  });

  it('records exactly one of three outcomes, once, with omni rewind outcome', () => {
    expect(FLAT).toContain('rewind outcome <finding> --pr <n>');
    expect(FLAT).toContain("rewind outcome <finding> --already '<rule>'");
    expect(FLAT).toContain("rewind outcome <finding> --asks '<question>'");
    expect(FLAT).toContain('An outcome is never rewritten');
  });

  it('asks, writing nothing, when no slot or register fits, the lesson contradicts a rule, or it would change a locked law', () => {
    expect(FLAT).toMatch(/\*\*Asks\.\*\* No slot or register fits, the lesson contradicts a written rule, or it would change a locked law/);
    expect(FLAT).toContain('a glossary term or a Legal entry');
  });

  it('writes only in this repository\'s own knowledge: never the kit, never another repository, never a locked law, never a merge', () => {
    expect(FLAT).toContain('It writes only in this repository\'s own knowledge');
    expect(FLAT).toContain('never the kit');
    expect(FLAT).toContain('never another repository');
    expect(FLAT).toContain('never a locked law');
    expect(FLAT).toMatch(/It never merges/);
    expect(FLAT).not.toMatch(/gh pr merge|--admin|--auto/);
  });

  it('names only commands the CLI has', () => {
    for (const command of ['rewind', 'check', 'kb', 'config', 'session', 'sign', 'knowledge']) expect(COMMAND_TABLE, command).toHaveProperty(command);
  });

  it('signs every commit and its pull request, and speaks in no person\'s name', () => {
    expect(FLAT).toContain('omni sign trailer');
    expect(FLAT).toContain('omni sign footer');
    expect(FLAT).toContain('signed as an agent\'s');
  });
});
