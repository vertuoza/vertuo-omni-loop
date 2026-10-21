// PRD 2268, s4: `/omni:knowledge-add` writes one item of a product's knowledge per Yes, from the
// terminal, through the commands of s2 and s3. Read against its SKILL.md, apart from plugin.test.ts,
// which proves locked laws.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

/** The skill's front matter, as YAML. */
function frontmatter(text: string): { name?: unknown; description?: unknown } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  return match ? (parseYaml(String(match[1])) as { name?: unknown; description?: unknown }) : {};
}

describe('the knowledge-add skill in this repository', () => {
  const text = readFileSync(new URL('../plugin/skills/knowledge-add/SKILL.md', import.meta.url), 'utf8');
  const flat = text.replace(/\s+/g, ' ');

  it('is named knowledge-add, and its description says what triggers it', () => {
    const { name, description } = frontmatter(text);
    expect(name).toBe('knowledge-add');
    expect(description).toMatch(/\bTriggers on\b.*"\/omni:knowledge-add"/);
  });

  it('writes one item per Yes, shows it whole and asks Yes / Change / Cancel', () => {
    expect(flat).toContain('exactly one');
    expect(flat).toContain('One Yes writes one item');
    expect(flat).toContain('Never write two items from one Yes');
    expect(flat).toContain('Show the item whole: its kind');
    expect(flat).toContain('**Yes / Change / Cancel**');
  });

  it('asks for a field the person did not give, never fills one, and leaves avoid words empty unless named', () => {
    expect(flat).toContain('never filled in by you');
    expect(flat).toContain('Never fill in a field the person did not give');
    expect(flat).toContain('**Avoid words** are left empty unless the person names them');
  });

  it('writes nothing under OMNI_UNATTENDED, edits only the item named, and takes the next item only after the last line printed', () => {
    expect(flat).toContain('Never write under `OMNI_UNATTENDED`');
    expect(flat).toContain('Never edit an item the person did not name');
    expect(flat).toContain('Only after the line of step 4 printed does the next item start');
  });

  it('runs the commands of s2 and s3 with --json', () => {
    for (const command of ['omni constituents add', 'omni constituents edit', 'omni kb legal add', 'omni kb legal edit', 'omni kb glossary add', 'omni kb glossary edit']) {
      expect(text, command).toContain(command);
    }
    expect(text.match(/--json/g)?.length).toBeGreaterThanOrEqual(8);
  });
});
