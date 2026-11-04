// PRD 2648, slice s3: `/omni:bug-fix`'s triage comment shows `- **Ref:**` from `omni ref --json` when `pr.ref`
// is set and has no Ref line when it is null; step 12 hands `/omni:pr` the issue with `--issue`. Read from the
// skill's text and the skill-steps snapshot.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SKILL = readFileSync(new URL('../plugin/skills/bug-fix/SKILL.md', import.meta.url), 'utf8');
const SNAPSHOT = JSON.parse(readFileSync(new URL('./skill-steps.snapshot.json', import.meta.url), 'utf8')) as Record<
  string,
  { commands: string[] }
>;

/** The part of `text` from the heading `## <from>` to the heading `## <to>` (or the end). */
function section(text: string, from: string, to: string | null): string {
  const start = text.indexOf(`\n## ${from}`);
  expect(start).toBeGreaterThan(-1);
  const end = to === null ? -1 : text.indexOf(`\n## ${to}`, start + 1);
  expect(end === -1 && to !== null).toBe(false);
  return text.slice(start, end === -1 ? undefined : end);
}

describe('/omni:bug-fix carries its issue\'s external reference', () => {
  const triage = section(SKILL, '3. Triage', '4. The boundary');
  const reproduce = section(SKILL, '7. Prove red', '8. Fix');

  it('the triage template has a Ref line filled from omni ref --json', () => {
    expect(triage).toMatch(/- \*\*Ref:\*\* <ref \| none \| unreadable \(gh\)>/);
    expect(triage).toMatch(/omni\.mjs ref <n> --title "<the issue's title>" --json/);
  });

  it('the Ref line is there only when pr.ref is set', () => {
    expect(triage).toMatch(/config\s+pr\.ref`? prints `null`/);
    expect(triage).toMatch(/has no Ref line/);
  });

  it('only the marker counts for the Ref line', () => {
    expect(triage).toMatch(/Only the marker counts/);
  });

  it('the draft is opened through /omni:pr with --issue, so its pr.open step titles it', () => {
    expect(reproduce).toMatch(/`\/omni:pr`/);
    expect(reproduce).toMatch(/with `--issue <n>`/);
  });

  it('the skill-steps snapshot lists the omni ref step of /omni:bug-fix', () => {
    expect(SNAPSHOT['bug-fix']?.commands).toContain('ref');
  });
});
