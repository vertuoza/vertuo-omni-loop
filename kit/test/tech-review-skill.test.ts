// The contract of `/omni:tech-review` (PRD 2608, s5), read as text, as rewind-skill.test.ts reads rewind's:
// it refuses in one line (no plan, no open request, not the named person, a merged sub-PR, a runner),
// reads before it asks, grills one question at a time with a recommended answer, changes only the coding
// parts, records each settled question under `### Tech review`, sends product questions to the PRD's issue
// naming the author, pushes with a signed commit and /omni:dossier-push, and has no way to approve.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { COMMAND_TABLE } from '../bin/commands/index.ts';

const TEXT = readFileSync(fileURLToPath(new URL('../plugin/skills/tech-review/SKILL.md', import.meta.url)), 'utf8');
const FLAT = TEXT.replace(/\s+/g, ' ');

/** Where `needle` first appears in the skill, failing the test when it does not. */
function at(needle: string): number {
  const index = FLAT.indexOf(needle);
  expect(index, needle).toBeGreaterThanOrEqual(0);
  return index;
}

describe('the tech-review skill', () => {
  it('parses, is named for its folder and says when it runs', () => {
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(TEXT);
    const data = parseYaml(match?.[1] ?? '') as { name?: unknown; description?: unknown };
    expect(data.name).toBe('tech-review');
    expect(String(data.description)).toMatch(/Triggers on .*\/omni:tech-review/);
  });

  it('refuses, in one line, a PRD with no plan, no open request, a merged sub-PR, anyone but the named person and a runner', () => {
    expect(FLAT).toContain('`tech-review: <why>`');
    for (const why of ['`OMNI_UNATTENDED` is set', 'has no `plan.md`', 'no open tech request', 'is not the member `tech` names', 'a sub-PR of the PRD is already merged']) expect(FLAT, why).toContain(why);
    expect(at('## 1. Refuse')).toBeLessThan(at('## 2. Read before you ask'));
  });

  it('reads the spec, the plan, the Technical tab, the four forms and the laws before it asks', () => {
    expect(at('## 2. Read before you ask')).toBeLessThan(at('## 4. Grill'));
    for (const form of ['architecture', 'testing', 'conventions', 'ci']) expect(FLAT, form).toContain(`kb show ${form}`);
    expect(FLAT).toContain('kb laws --slice');
    expect(FLAT).toContain('**Technical** tab');
    expect(FLAT).toContain('What the code or a playbook form answers is not asked');
  });

  it('shows the choices already made, in architecture and harness, before the first question', () => {
    expect(at('## 3. Show the choices already made')).toBeLessThan(at('## 4. Grill'));
    expect(FLAT).toContain('the approach, the data shape, the contracts, the deploy order, the risks');
    expect(FLAT).toContain('the test seams, the levels of test, the slices and their order');
  });

  it('grills one question at a time, each with a recommended answer and why, and stops when the reviewer says enough', () => {
    expect(FLAT).toContain('One question at a time');
    expect(FLAT).toContain('**recommended answer and why**');
    expect(FLAT).toContain('never the same thing twice');
    expect(FLAT).toContain('stops when the reviewer says enough');
  });

  it('says what the reviewer may and may not change', () => {
    expect(FLAT).toContain('| the reviewer may change | the reviewer may not change |');
    for (const part of ['**Conventions**', '**Test seams**', '**Risks**', 'the technical side of **Solution** and **Decisions**', '**Problem**, **User stories**, **Scope**, **Acceptance criteria**', 'its **Functional & design** tab', 'the `proof` and `e2e` front matter']) expect(FLAT, part).toContain(part);
  });

  it('grades the plan again and records each settled question under ### Tech review in the Decisions', () => {
    expect(FLAT).toContain('omni plan check <n>');
    expect(FLAT).toContain('under a `### Tech review` heading');
    expect(FLAT).toContain('the question, the answer, what changed, and who answered it');
  });

  it('hands a product question to the PRD\'s issue, naming the author, and changes nothing about it', () => {
    expect(FLAT).toContain('becomes one comment on the PRD\'s issue, naming the PRD\'s author');
    expect(FLAT).toContain('The spec, the plan and the page stay as they are for it');
  });

  it('pushes one signed commit, runs omni check inbox and /omni:dossier-push, and ends on the page\'s link', () => {
    expect(FLAT).toContain('`docs(prd): tech review <topic>`');
    expect(FLAT).toContain('omni sign trailer');
    expect(at('`omni check inbox`')).toBeLessThan(at('`/omni:dossier-push <n>`'));
    expect(at('`/omni:dossier-push <n>`')).toBeLessThan(at('`omni dossier link <n>`'));
  });

  it('gives no approval: it has no command that gives one, and never merges', () => {
    expect(FLAT).toContain('It never gives the Tech Approval');
    expect(FLAT).toContain('it has no way to give the approval');
    expect(FLAT).toContain('It never merges');
    for (const verb of [/omni\s+approval\s+(?!tech request|<n>|restore|flag)/, /dossier_approve/, /\bgh\s+pr\s+(?:merge|ready|review)\b/, /--add-label/]) expect(TEXT).not.toMatch(verb);
  });

  it('names only commands the CLI has', () => {
    for (const command of ['config', 'session', 'prd', 'kb', 'plan', 'check', 'dossier', 'board', 'approval', 'whoami']) expect(COMMAND_TABLE, command).toHaveProperty(command);
  });
});
