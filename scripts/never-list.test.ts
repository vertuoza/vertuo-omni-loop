// The Never list is written once (#2398): the briefing holds every rule, and AGENTS.md points to it
// rather than restating it in its own words, which drifted. And a floor the briefing protects is one
// the repository has: it named a coverage floor, which never existed; the floors are the mutation
// floors of mutation/floor.json.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (path: string): string => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

/** The lines of the `## <heading>` section of a Markdown text, up to the next `## `. */
function section(text: string, heading: string): string[] {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.startsWith(`## ${heading}`));
  if (start === -1) return [];
  const end = lines.findIndex((line, at) => at > start && line.startsWith('## '));
  return lines.slice(start + 1, end === -1 ? undefined : end);
}

describe('the Never list', () => {
  it('names only a floor the repository has: the mutation floors of mutation/floor.json', () => {
    const never = section(read('.omni-loop/knowledge/playbook/briefing.md'), 'Never').join('\n');
    expect(never).not.toMatch(/coverage floor/);
    expect(never).toContain('mutation floor (`mutation/floor.json`)');
    expect(existsSync(fileURLToPath(new URL('../mutation/floor.json', import.meta.url)))).toBe(true);
  });

  it('is written once: AGENTS.md points to the briefing and restates no rule', () => {
    const never = section(read('AGENTS.md'), 'Never');
    expect(never.some((line) => line.includes('omni.mjs kb show briefing'))).toBe(true);
    expect(never.filter((line) => /^\s*[-*] /.test(line))).toEqual([]);
  });
});
