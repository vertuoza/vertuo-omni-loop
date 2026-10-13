// PRD 1858, s3: no skill names a Claude tool outside an `(in Claude: …)` bracket.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CLAUDE_NAMES, agentNeutralHits, claudeNamesIn } from './agent-neutral.ts';

const SKILLS = fileURLToPath(new URL('../plugin/skills', import.meta.url));

/** A skills folder holding `wave/SKILL.md` and `pixel-perfect/reference/review.md`, saying `text`. */
function skillsFolder(text: string): string {
  const root = mkdtempSync(join(tmpdir(), 'omni-agent-neutral-'));
  mkdirSync(join(root, 'wave'));
  mkdirSync(join(root, 'pixel-perfect', 'reference'), { recursive: true });
  writeFileSync(join(root, 'wave', 'SKILL.md'), '# Wave\n\nNothing here.\n');
  writeFileSync(join(root, 'pixel-perfect', 'reference', 'review.md'), text);
  return root;
}

describe('agent-neutral skills', () => {
  it('every skill file names a Claude tool only inside an `(in Claude: …)` bracket', () => {
    expect(agentNeutralHits(SKILLS)).toEqual([]);
  });

  it('fails on `type /clear`, naming the file and the line', () => {
    const root = skillsFolder('# Review\n\nWhen it is done,\ntype /clear (or open a new terminal).\n');
    expect(agentNeutralHits(root)).toEqual(['pixel-perfect/reference/review.md:4: /clear']);
  });

  it('passes on `start a fresh session (in Claude: `/clear`)`', () => {
    expect(claudeNamesIn('Then start a fresh session (in Claude: `/clear`), or open a new terminal.')).toEqual([]);
  });

  it('fails on a name in a code block outside a bracket', () => {
    const text = ['Run it:', '', '```', 'Bash run_in_background: true', '```', ''].join('\n');
    expect(claudeNamesIn(text)).toEqual([{ line: 4, name: 'run_in_background' }]);
  });

  it('reads a bracket across lines and backticks, to its matching parenthesis', () => {
    const text = [
      'Start one agent per slice (in Claude: one message with several Agent calls,',
      'each `isolation: "worktree"` (see `wave`), in the background). Then a Claude Code terminal.',
    ].join('\n');
    expect(claudeNamesIn(text)).toEqual([{ line: 2, name: 'Claude Code' }]);
  });

  it('holds a bracket that never closes to the end of the file', () => {
    expect(claudeNamesIn('(in Claude: `/loop /omni:drive`\nand AskUserQuestion')).toEqual([]);
  });

  it('knows every name the spec lists', () => {
    for (const name of CLAUDE_NAMES) expect(claudeNamesIn(`say ${name} here`)).toEqual([{ line: 1, name }]);
  });
});
