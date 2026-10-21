// PRD 2251: `/omni:yolo-runner <n>` builds a PRD on a runner and follows it from the terminal; the
// brainstorm's and the yolo-fix's hand-offs name it one line above their last line. Kept apart from
// plugin.test.ts, which proves locked laws: adding a skill does not change their proof.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const PLUGIN_DIR = 'kit/plugin';

const isFields = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** A SKILL.md's front matter, or null when it has none that reads. */
function frontmatter(text: string): Record<string, unknown> | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) return null;
  try {
    const data: unknown = parseYaml(String(match[1]));
    return isFields(data) ? data : null;
  } catch {
    return null;
  }
}

/** The `## <heading>` section of a SKILL.md whose heading starts with `start`, up to the next one. */
function skillSection(text: string, start: string) {
  const lines = text.split('\n');
  const from = lines.findIndex((line: string) => line.startsWith(`## ${start}`));
  if (from < 0) return '';
  const to = lines.findIndex((line: string, index: number) => index > from && line.startsWith('## '));
  return lines.slice(from, to < 0 ? undefined : to).join('\n');
}

/** The last non-blank line of a section's last fenced block, or null when it has none. */
function lastFencedLine(section: string) {
  let open = false;
  let block: string[] = [];
  let last: string | null = null;
  for (const line of section.split('\n')) {
    if (line.trim().startsWith('```')) {
      if (open) last = block.filter((text) => text.trim() !== '').at(-1)?.trim() ?? null;
      open = !open;
      block = [];
    } else if (open) block.push(line);
  }
  return last;
}
// brainstorm's and the yolo-fix's hand-offs name it one line above their last line.
describe('/omni:yolo-runner and the hand-offs that name it', () => {
  const read = (skill: string) => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills', skill, 'SKILL.md'), 'utf8');
  const RUNNER_LINE = 'To build it on a runner instead: `/omni:yolo-runner <n>`.';
  const runner = read('yolo-runner');

  it('has the front matter of a skill named for its command', () => {
    const data = frontmatter(runner);
    expect(data?.['name']).toBe('yolo-runner');
    expect(String(data?.['description'])).toContain('/omni:yolo-runner');
  });

  it('follows a job before sending one, then follows it and hands off on each ending', () => {
    expect(runner.indexOf('omni.mjs runner follow <n>')).toBeLessThan(runner.indexOf('omni.mjs runner send'));
    expect(runner).toContain("runner send '/omni:yolo <n>'");
    expect(runner).toContain('`OMNI_UNATTENDED`');
    for (const ending of ['Waiting on answers', 'Held', 'Ready', 'Failed', 'Runner lost']) expect(runner).toContain(ending);
    expect(runner).toContain('/omni:yolo-fix <n>');
    expect(runner).toContain('/omni:yolo-runner <n>');
  });

  it('/omni:brainstorm step 10 names it above the command in both What is next? blocks, keeping the last line', () => {
    const step = skillSection(read('brainstorm'), '10.');
    expect(step.split(RUNNER_LINE).length - 1).toBe(2);
    const blocks = step.split('```markdown\n**What is next?**').slice(1).map((block: string) => block.slice(0, block.indexOf('```')));
    expect(blocks).toHaveLength(2);
    for (const block of blocks) {
      expect(block.indexOf(RUNNER_LINE)).toBeGreaterThan(-1);
      expect(block.indexOf(RUNNER_LINE)).toBeLessThan(block.indexOf('/omni:yolo <n>'));
    }
    expect(lastFencedLine(step)).toBe('/omni:yolo <n>');
  });

  it("/omni:yolo-fix step 8 names it above the held ending's command, which stays /omni:yolo-fix <n>", () => {
    const step = skillSection(read('yolo-fix'), '8. Hand off');
    expect(step).toContain('To build it on a runner');
    expect(step).toContain('`/omni:yolo-runner <n>`');
    expect(step).toContain('The last line stays `/omni:yolo-fix <n>`');
  });
});
