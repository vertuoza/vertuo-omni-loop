// PRD 2239, s4: the brainstorms write the before/after page through `omni before-after`, in two tabs.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const PLUGIN_DIR = 'kit/plugin';

/** The `## <heading>` section of a SKILL.md whose heading starts with `start`, up to the next one. */
function skillSection(text: string, start: string) {
  const lines = text.split('\n');
  const from = lines.findIndex((line: string) => line.startsWith(`## ${start}`));
  if (from < 0) return '';
  const to = lines.findIndex((line: string, index: number) => index > from && line.startsWith('## '));
  return lines.slice(from, to < 0 ? undefined : to).join('\n');
}

describe('the before/after page in the brainstorm skills', () => {
  const read = (skill: string) => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills', skill, 'SKILL.md'), 'utf8');
  const stepFive = () => skillSection(read('brainstorm'), '5.');

  it('/omni:brainstorm step 5 runs new, then render, then the word pass, in the two tabs and three states', () => {
    const step = stepFive();
    const order = ['before-after new <n> --services', 'before-after render <n>', 'design words'].map((m) => step.indexOf(m));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    for (const phrase of ['Functional & design', '**Technical**', '`filled`', '`na`', '`gap`', 'breaking', 'diagram not rendered', '<details>']) {
      expect(step, phrase).toContain(phrase);
    }
  });

  it('keeps the pixel-perfect rules and never names the skeleton path', () => {
    const step = stepFive();
    for (const phrase of ['The Pixel perfect section', 'The design memory', 'The marks and the word pass', 'The draft screens']) {
      expect(step, phrase).toContain(phrase);
    }
    for (const skill of ['brainstorm', 'mega-brainstorm']) expect(read(skill), skill).not.toContain('templates/before-after');
  });

  it('Rework writes the page the same way and keeps the old shape of a page without the meta', () => {
    const rework = skillSection(read('brainstorm'), 'Rework');
    expect(rework).toContain('before-after new <n> --force');
    expect(rework).toContain('omni-before-after');
  });

  it("/omni:mega-brainstorm step 6 makes each repository a service, in the plan's build order", () => {
    const step = skillSection(read('mega-brainstorm'), '6.');
    expect(step).toContain('before-after new <n> --services');
    expect(step).toContain('one **service**');
    expect(step).toContain('order the plan builds them');
  });
});
