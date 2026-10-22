// The contract of `/omni:retro-apply` (PRD 2338, s5), read as text: what it refuses, the three outcomes
// it records, the guard it writes only with `retro.guards` on, and how it signs. The runner lists that
// name it are tested where they live (kit/lib/runner/line.test.ts, runners.contract.test.ts, guide.test.ts).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { COMMAND_TABLE } from '../../../bin/commands/index.ts';

const TEXT = readFileSync(fileURLToPath(new URL('./SKILL.md', import.meta.url)), 'utf8');
const FLAT = TEXT.replace(/\s+/g, ' ');

describe('the retro-apply skill', () => {
  it('parses, is named for its folder and says when it runs', () => {
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(TEXT);
    const data = parseYaml(match?.[1] ?? '') as { name?: unknown; description?: unknown };
    expect(data.name).toBe('retro-apply');
    expect(String(data.description)).toMatch(/Triggers on .*\/omni:retro-apply/);
  });

  it('refuses a retro PR already merged or closed in one line, writing nothing', () => {
    expect(FLAT).toContain('state` is `MERGED` or `CLOSED`');
    expect(FLAT).toContain('write nothing, post nothing and stop');
    expect(FLAT).toContain('retro-apply: retro PR #<n> is already <merged|closed>: nothing to settle.');
  });

  it('records a rule ending (retro of PRD <n>, #<issue>) with --became, or --stays-here with a reason, or asks one question', () => {
    expect(FLAT).toContain('ending `(retro of PRD <prd>, #<issue>)`');
    expect(FLAT).toContain('retro outcome <prd> <finding> --became playbook/<form>#<slot>');
    expect(FLAT).toContain("retro outcome <prd> <finding> --stays-here '<why>'");
    expect(FLAT).toContain('Record no outcome and post one question on the retro PR');
  });

  it('names only commands the CLI has', () => {
    for (const command of ['retro', 'check', 'kb', 'config', 'session', 'prd', 'sign']) expect(COMMAND_TABLE, command).toHaveProperty(command);
  });

  it('writes a guard test only with retro.guards on, proved red then green; off, no code', () => {
    expect(FLAT).toContain('config retro.guards');
    expect(FLAT).toContain('the test must go **red**');
    expect(FLAT).toContain('the test must go **green**');
    expect(FLAT).toContain('With guards off, write no code');
  });

  it('quotes each rule with its slot in the retro PR body, closes the issues and never merges', () => {
    expect(FLAT).toContain('quoted word for word with its slot');
    expect(FLAT).toContain('`Closes #<issue>`');
    expect(FLAT).toMatch(/never merges/);
  });

  it('signs every commit and speaks in no person\'s name', () => {
    expect(FLAT).toContain('omni sign trailer');
    expect(FLAT).toContain('omni sign footer');
    expect(FLAT).toContain('signed as an agent\'s');
  });
});
