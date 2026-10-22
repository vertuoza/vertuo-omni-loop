// PRD 2030 s7: /omni:pitch writes the scenes' new fields — titles with one accent, bodies, a step's own
// media, the team asked once, figures only from the spec, the release note or the person, each with its
// source — in the new default arc, and the storyboard its example describes passes `omni pitch check`.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkRunFolder } from '../lib/pitch/check.ts';
import { STORYBOARD_FILE, mediaOf, parseStoryboard } from '../lib/pitch/storyboard.ts';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const read = () => readFileSync(join(repoRoot, 'kit', 'plugin', 'skills', 'pitch', 'SKILL.md'), 'utf8');
const flat = (text: string) => text.replace(/\s+/g, ' ');

/** The lines of `text` from the `## <start>` heading up to the next `## ` heading. */
function skillSection(text: string, start: string) {
  const lines = text.split('\n');
  const from = lines.findIndex((line) => line.startsWith(`## ${start}`));
  if (from < 0) return '';
  const to = lines.findIndex((line, index) => index > from && line.startsWith('## '));
  return lines.slice(from, to < 0 ? undefined : to).join('\n');
}

/** The first fenced JSON block of `text` that holds a storyboard, parsed. */
function exampleStoryboard(text: string): unknown {
  const blocks = [...text.matchAll(/```json\n([\s\S]*?)\n```/g)].map((match) => String(match[1]));
  const block = blocks.find((body) => body.includes('"storyboard": 1'));
  if (block === undefined) throw new Error('no storyboard example in step 4');
  return JSON.parse(block);
}

describe('the pitch skill writes the scenes of PRD 2030', () => {
  const storyboardStep = () => flat(skillSection(read(), '4.'));

  it('holds the title rules: at most 8 words, one **accent** on the benefit, a finding and not a label', () => {
    const step = storyboardStep();
    for (const phrase of [
      'at most 8 words',
      'sentence case',
      'full stop',
      'exactly one `**accent**`',
      '"Three clicks, **one invoice**."',
      '"Invoice creation flow"',
      'No exclamation mark, no emoji',
    ]) expect(step, phrase).toContain(phrase);
  });

  it('holds the body rule: one plain sentence, from the spec and the release note only', () => {
    expect(storyboardStep()).toMatch(/\*\*Bodies:\*\* one plain sentence[^.]*from the spec and the release note only/);
  });

  it("gives a step that shows another moment its own media, cut from walk.webm, its times from the step's at", () => {
    const step = storyboardStep();
    expect(step).toMatch(/a step that shows a different moment of the walk-through brings its own `media`, cut from `walk\.webm` around that moment/);
    expect(step).toMatch(/counted from the step's `at`/);
  });

  it('asks "Which team built this?" once, before the outro, and writes no team without an answer', () => {
    const text = read();
    expect(text.split('"Which team built this?"')).toHaveLength(2);
    const step = storyboardStep();
    expect(step).toMatch(/before the outro, ask the person once: "Which team built this\?"/);
    expect(step).toContain('`outro.team`');
    expect(step).toContain('no answer, no team');
  });

  it('writes a stats scene only from the spec, the release note or the person asked once, each item with its source', () => {
    const text = read();
    expect(text.split('"Any figures to show (with where they come from)?"')).toHaveLength(2);
    const step = storyboardStep();
    for (const phrase of ['`source`', '`spec`', '`release`', '`asked`', 'No figure, no `stats` scene', '`meta.locale`']) expect(step, phrase).toContain(phrase);
    expect(step).toMatch(/comes from the spec and the release note only, whatever the instructions say/);
  });

  it('names the new default arc, in order: intro, a statement, feature and steps, beforeAfter, stats, outro', () => {
    const arc = /\*\*The arc:\*\*([^\n]*(?:\n(?!\n)[^\n]*)*)/.exec(skillSection(read(), '4.'));
    expect(arc).not.toBeNull();
    const line = flat(String(arc?.[1]));
    const order = ['intro', 'at most one statement', 'feature', 'steps', '`beforeAfter`', '`stats`', 'outro'].map((word) => line.indexOf(word));
    expect(order.every((at) => at >= 0), line).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('describes a storyboard that passes omni pitch check, with no error and no warning', () => {
    const example = exampleStoryboard(skillSection(read(), '4.'));
    const parsed = parseStoryboard(example);
    expect(parsed.problems).toBeUndefined();
    const dir = mkdtempSync(join(tmpdir(), 'omni-pitch-skill-'));
    writeFileSync(join(dir, STORYBOARD_FILE), JSON.stringify(example));
    const files = (parsed.storyboard?.scenes ?? []).flatMap((scene, index) => mediaOf(scene, index)).map(({ media }) => media.file);
    for (const file of files) {
      mkdirSync(dirname(join(dir, file)), { recursive: true });
      writeFileSync(join(dir, file), '');
    }
    const report = checkRunFolder(dir);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
    const types = (parsed.storyboard?.scenes ?? []).map((scene) => scene.type);
    for (const type of ['intro', 'steps', 'stats', 'outro']) expect(types, type).toContain(type);
  });
});
