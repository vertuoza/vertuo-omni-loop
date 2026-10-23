// PRD 2346, slice s6: `/omni:invade` proposes the knowledge map (layers, areas, domain folders with
// kept ids, ADR layers) and `/omni:mega-invade` copies each target's `layers` beside its `flow`. Kept
// out of plugin.test.ts, which proves locked laws.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const read = (skill: string) => readFileSync(join(repoRoot, 'kit/plugin/skills', skill, 'SKILL.md'), 'utf8');

/** The `## <heading>` section whose heading starts with `start`, up to the next `## ` heading. */
const sectionOf = (text: string, start: string): string => {
  const [, ...after] = text.split(`\n## ${start}`);
  return after.length === 0 ? '' : `## ${start}${after.join('').split('\n## ')[0] ?? ''}`;
};

describe('the knowledge map in /omni:invade and /omni:mega-invade (PRD 2346)', () => {
  it('/omni:invade proposes layers, areas, domain folders with Kept id: and ADR layers, as proposed entries', () => {
    const section = sectionOf(read('invade'), 'The knowledge map');
    for (const word of ['`layers:`', 'knowledge:', 'Domain folders', 'Kept id:', 'byte for byte', '**Layers:**', '**Domain:**', 'Proposed: invade', 'TODO(human)', 'omni.mjs check config']) {
      expect(section, word).toContain(word);
    }
    expect(section).toContain('ten layers and nine roles');
  });

  it('/omni:invade --refresh redoes the map from evidence only', () => {
    expect(sectionOf(read('invade'), '--refresh')).toContain('knowledge map');
  });

  it("/omni:mega-invade copies each target's `layers` beside its `flow`", () => {
    const text = read('mega-invade');
    expect(text).toContain('`layers`');
    expect(text).toContain('`layers` key beside its `flow`');
  });
});

describe('/omni:invade leaves unproven pages to the Omni-settings default (PRD 2417)', () => {
  it('writes only the pages it proves, names the rest from omni kb status, and still copies no default text', () => {
    const text = read('invade');
    const section = `### Pages it cannot prove${text.split('\n### Pages it cannot prove')[1]?.split('\n## ')[0] ?? ''}`;
    for (const word of ['left unwritten', 'Omni-settings default', 'kit default', 'omni.mjs kb status', 'reads the Omni settings', 'never copies']) {
      expect(section, word).toContain(word);
    }
    expect(text).toContain('Never copies a kit default or an Omni-settings default into a form');
  });
});
