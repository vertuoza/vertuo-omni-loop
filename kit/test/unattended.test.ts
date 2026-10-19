// PRD 2175: an unattended run never asks, in the words the agents read.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const read = (path: string) => readFileSync(join(repoRoot, path), 'utf8');

describe('the unattended rule', () => {
  it('/omni:yolo skips the end question under OMNI_UNATTENDED', () => {
    const yolo = read('kit/plugin/skills/yolo/SKILL.md');
    const from = yolo.indexOf('### Answer here, when the gate ends red');
    expect(from).toBeGreaterThan(0);
    const section = yolo.slice(from, yolo.indexOf('**Answer here now.**', from));
    expect(section).toContain('OMNI_UNATTENDED');
    expect(section).toContain('ask no question');
  });

  it('the briefing says to ask nothing and record an outbox item', () => {
    const briefing = read('kit/templates/playbook/briefing.md');
    expect(briefing).toMatch(/Under `OMNI_UNATTENDED`, ask\s+nothing[^]*outbox item/);
  });

  it('the any-agent guide says the same', () => {
    const guide = read('docs/guide/any-agent.md');
    expect(guide).toContain('OMNI_UNATTENDED');
    expect(guide).toContain('`unattended`');
  });
});
