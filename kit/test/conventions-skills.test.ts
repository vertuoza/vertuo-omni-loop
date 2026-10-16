// PRD 2049, s2: the three skills that name things read the repository's written conventions first.
// `/omni:brainstorm` reads them at step 1 and writes a `## Conventions` section after `## Solution`;
// `/omni:mega-brainstorm` reads each target's clone at step 3 and writes the section at step 5; and
// `/omni:plan`, in a plan repository, reads each target's clone at step 2. The text is read as the
// skills are, so a rewording that drops the command or the section fails here.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const skill = (name: string) => readFileSync(new URL(`../plugin/skills/${name}/SKILL.md`, import.meta.url), 'utf8');
const BRAINSTORM = skill('brainstorm');
const MEGA = skill('mega-brainstorm');
const PLAN = skill('plan');

/** A text with each run of whitespace made one space: prose wraps its lines anywhere. */
const flat = (text: string) => text.replace(/\s+/g, ' ');

/** The text from the first `start` up to the next `end` after it (or to the end when `end` is absent). */
function between(text: string, start: string, end?: string): string {
  const from = text.indexOf(start);
  if (from < 0) return '';
  const to = end === undefined ? -1 : text.indexOf(end, from + start.length);
  return flat(text.slice(from, to < 0 ? undefined : to));
}

describe('conventions in the naming skills (PRD 2049, s2)', () => {
  it('/omni:brainstorm runs `omni conventions` at step 1, before the design is shown', () => {
    const step1 = between(BRAINSTORM, '## 1. Brainstorm the design', '## 2. ');
    expect(step1).toContain('node .omni-loop/bin/omni.mjs conventions');
    expect(step1).toContain('before the design is shown');
  });

  it('/omni:brainstorm step 4 adds `## Conventions` after `## Solution`, with a source per name', () => {
    const step4 = between(BRAINSTORM, '## 4. Write the spec', '## 5. ');
    expect(step4.indexOf('## Solution')).toBeGreaterThan(-1);
    expect(step4.indexOf('## Conventions')).toBeGreaterThan(step4.indexOf('## Solution'));
    expect(step4.indexOf('## Decisions')).toBeGreaterThan(step4.indexOf('## Conventions'));
    expect(step4).toContain('no written convention: follows <file>');
    expect(step4).toContain('No name chosen.');
    expect(step4).toContain('never pick silently');
  });

  it('/omni:mega-brainstorm step 3 runs `omni conventions --root` on each clone', () => {
    const step3 = between(MEGA, '## 3. Clones', '## 4. ');
    expect(step3).toContain('node .omni-loop/bin/omni.mjs conventions --root <scratch>/<name>');
  });

  it('/omni:mega-brainstorm step 5 writes `## Conventions` after `## Repositories`', () => {
    const step5 = between(MEGA, '## 5. The spec', '## 6. ');
    expect(step5.indexOf('## Repositories')).toBeGreaterThan(-1);
    expect(step5.indexOf('`## Conventions`')).toBeGreaterThan(step5.indexOf('## Repositories'));
  });

  it('/omni:plan runs `omni conventions --root` on each target clone at step 2, in a plan repository', () => {
    const step2 = between(PLAN, '## 2. The feature branch', '## 3. The slices');
    expect(step2).toContain('node .omni-loop/bin/omni.mjs conventions --root <clone>');
    expect(step2).toContain('plan repository');
  });
});
