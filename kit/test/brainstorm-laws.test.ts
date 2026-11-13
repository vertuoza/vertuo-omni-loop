// Bug #2793: `/omni:brainstorm` reads the business laws verdict of the spec it pushed, with `omni prd <n>`,
// and reworks the spec on a red before it hands off, at step 7 and in **Rework**.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const skill = readFileSync(new URL('../plugin/skills/brainstorm/SKILL.md', import.meta.url), 'utf8');
const flat = (text: string) => text.replace(/\s+/g, ' ');

/** The `## <heading>` section starting with `start`, up to the next one. */
function section(start: string) {
  const lines = skill.split('\n');
  const from = lines.findIndex((line: string) => line.startsWith(`## ${start}`));
  const to = lines.findIndex((line: string, index: number) => index > from && line.startsWith('## '));
  return flat(lines.slice(from, to < 0 ? undefined : to).join('\n'));
}

describe('the brainstorm skill reads the business laws verdict after it pushes the spec (bug #2793)', () => {
  for (const [name, start] of [['step 7', '7.'], ['Rework', 'Rework']] as const) {
    it(`${name} reads it with omni prd <n> after the dossier push`, () => {
      const text = section(start);
      expect(text.indexOf('**The business laws.**')).toBeGreaterThan(text.indexOf('/omni:dossier-push <n>'));
      expect(text).toContain('node .omni-loop/bin/omni.mjs prd <n>');
    });

    it(`${name} reworks the spec on a red until it is not red, or asks for the amendment`, () => {
      const text = section(start);
      expect(text).toContain('`laws: red`');
      expect(text).toContain('/omni:knowledge-add amend <id>');
      expect(text).toContain('until it is not red');
    });

    it(`${name} reads a spec not judged yet once more, then carries on`, () => {
      expect(section(start)).toContain('`laws: not judged yet` is read once more, then carried on');
    });
  }
});
