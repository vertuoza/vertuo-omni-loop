// Bug #2658: a pull request `/omni:pr` opens in another repository (`--repo`, from `/omni:mega-bug-fix` or
// `/omni:ultra-yolo`) carries its issue's external reference (PRD 2648), in the target's own format:
// `omni ref` runs with `--repo <slug>`, `/omni:mega-bug-fix` names the plan repository's issue for each
// target PR, and its record PR is opened with `--issue <n>`. Read from the skills' text.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const PR = readFileSync(new URL('../plugin/skills/pr/SKILL.md', import.meta.url), 'utf8');
const MEGA = readFileSync(new URL('../plugin/skills/mega-bug-fix/SKILL.md', import.meta.url), 'utf8');
const GUIDE = readFileSync(new URL('../../docs/guide/flow.md', import.meta.url), 'utf8');

/** The part of `text` from the heading `## <name>` to the next `## `. */
function section(text: string, name: string): string {
  const start = text.indexOf(`\n## ${name}`);
  expect(start).toBeGreaterThan(-1);
  const end = text.indexOf('\n## ', start + 1);
  return text.slice(start, end === -1 ? undefined : end);
}

/** The bullet of `text` that starts with `- **<name>`, up to the next bullet or heading. */
function bullet(text: string, name: string): string {
  const start = text.indexOf(`\n- **${name}`);
  expect(start).toBeGreaterThan(-1);
  const rest = text.slice(start + 1);
  const end = rest.search(/\n(- \*\*|#)/);
  return end === -1 ? rest : rest.slice(0, end);
}

describe('a pull request opened in another repository carries its issue\'s reference (#2658)', () => {
  it("/omni:pr's --repo mode runs omni ref with --repo <slug>, so the target's pr.ref formats the title", () => {
    const repo = section(PR, '`--repo <slug>`');
    expect(repo).toMatch(/omni ref[^\n]*--repo <slug>/);
    expect(repo).toMatch(/target's[^\n]*`pr\.ref`|`pr\.ref`[^\n]*target's/);
  });

  it("/omni:pr's external reference names the plan repository's issue for a target pull request", () => {
    const opening = section(PR, 'Opening: point `pr.open`');
    expect(opening).toMatch(/plan repository's issue/);
  });

  it("/omni:mega-bug-fix hands /omni:pr the plan repository's issue for each target PR", () => {
    const target = bullet(MEGA, 'The PR,');
    expect(target).toMatch(/\/omni:pr --repo <slug> --issue <n>/);
  });

  it('/omni:mega-bug-fix opens its record PR with --issue <n>', () => {
    const record = section(MEGA, '9. Ship the record');
    expect(record).toMatch(/\/omni:pr --issue <n>/);
  });

  it('the guide says a pull request in another repository takes that repository\'s format', () => {
    expect(GUIDE).toMatch(/omni ref[^\n]*--repo/);
  });
});
