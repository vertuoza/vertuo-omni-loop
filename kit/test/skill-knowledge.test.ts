// PRD 2299: the skills that write a spec, a plan, a slice or a fix read the product's knowledge from
// the Omni page — its glossary always, its Legal entries where the work can touch them.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const read = (skill: string) => readFileSync(join(repoRoot, 'kit/plugin/skills', skill, 'SKILL.md'), 'utf8');

describe('the skills read the product knowledge (PRD 2299)', () => {
  it.each(['brainstorm', 'plan', 'do-work', 'bug-fix'])('/omni:%s reads kb glossary', (skill: string) => {
    expect(read(skill)).toContain('omni.mjs kb glossary');
  });

  it.each(['brainstorm', 'do-work'])('/omni:%s reads kb legal', (skill: string) => {
    expect(read(skill)).toContain('omni.mjs kb legal');
  });
});
