// PRD 2608, s6: `/omni:brainstorm` asks about a Tech Approval last, after its plan is pushed, for a ◆ PRD only.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const skill = readFileSync(new URL('../plugin/skills/brainstorm/SKILL.md', import.meta.url), 'utf8');
const flat = (text: string) => text.replace(/\s+/g, ' ');
const words = flat(skill);

/** The `## <heading>` section starting with `start`, up to the next one. */
function section(start: string) {
  const lines = skill.split('\n');
  const from = lines.findIndex((line: string) => line.startsWith(`## ${start}`));
  const to = lines.findIndex((line: string, index: number) => index > from && line.startsWith('## '));
  return flat(lines.slice(from, to < 0 ? undefined : to).join('\n'));
}

describe('the brainstorm skill asks about a Tech Approval last (PRD 2608)', () => {
  const step8 = () => section('8.');

  it('asks after the plan is pushed, in step 8, after the proof and e2e questions of step 1', () => {
    expect(step8()).toContain('The Tech Approval question');
    expect(words.indexOf('**The e2e question**')).toBeLessThan(words.indexOf('**The Tech Approval question**'));
    expect(words.indexOf('## 8. Plan it')).toBeLessThan(words.indexOf('**The Tech Approval question**'));
    expect(words.indexOf('**The Tech Approval question**')).toBeLessThan(words.indexOf('## 9. The phase-0 PR'));
  });

  it('asks only under phase 0: server', () => {
    expect(step8()).toContain('only when step 0 read `phase 0: server`');
    expect(step8()).toContain('Under `phase 0: pr`');
  });

  it('a no, or no answer, changes nothing', () => {
    expect(step8()).toContain('**No, or no answer,** changes nothing');
  });

  it('a yes lists the members, then sends the request through omni approval tech request', () => {
    expect(step8()).toContain('approval tech request <n>');
    expect(step8()).toContain('approval tech request <n> --to <login>');
    expect(step8()).toContain('prints the workspace\'s members, one per line');
  });

  it('the hand-off names who it waits on and /omni:tech-review <n>', () => {
    expect(section('10.')).toContain('waits for <login>\'s tech approval');
    expect(section('10.')).toContain('/omni:tech-review <n>');
  });

  it('the proof and e2e questions stay in step 1', () => {
    expect(section('1.')).toContain('**The proof question**');
    expect(section('1.')).toContain('**The e2e question**');
  });
});
