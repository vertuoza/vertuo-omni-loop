// The contract of `/omni:committee` (PRD omni-loop-21 s2), read as text, as review-skill.test.ts reads its skill: the
// escalation list's cases go to the members, then to a person at landing, never to a person mid-mission, but a PRD
// approved by its phase-0 pull request; the members run whatever the list names; every sitting yes carries a case on the
// list, recorded `carried · on the escalation list`; any no or unsure defers an item with option A, the most
// reversible, and sends a PRD to a person. The words it records are the ones `decisionLine` writes.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { decide, decisionLine, type AnswerFacts } from '../lib/committee/escalation.ts';
import { COMMITTEE_ROLES, type MemberVerdict } from '../lib/committee/vote.ts';

const TEXT = readFileSync(fileURLToPath(new URL('../plugin/skills/committee/SKILL.md', import.meta.url)), 'utf8');
const FLAT = TEXT.replace(/\s+/g, ' ');

/** The `## <heading>` section whose heading starts with `start`, flattened, up to the next one. */
function section(start: string): string {
  const from = TEXT.indexOf(`\n## ${start}`);
  expect(from, start).toBeGreaterThanOrEqual(0);
  const to = TEXT.indexOf('\n## ', from + 1);
  return TEXT.slice(from, to < 0 ? undefined : to).replace(/\s+/g, ' ');
}

const description = (): string => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(TEXT);
  return String((parseYaml(match?.[1] ?? '') as { description?: unknown }).description);
};

const item = (over: Partial<AnswerFacts> = {}): AnswerFacts => ({
  kind: 'answer', rank: 'high', lockedLaws: [], legal: [], redBusinessLaws: [], businessLaws: ['BL-GATE-1'], dataMigrations: [], hardToRevert: 0.2, bound: 0.6, ...over,
});
const yes: MemberVerdict[] = COMMITTEE_ROLES.map((role) => ({ role, answer: 'yes', sentence: 'In scope.' }));

describe('the committee skill', () => {
  it('sends the escalation list to the members, then to a person at landing, in its description and its body', () => {
    expect(description()).toContain('goes to the members, then to a person at landing, never to a person mid-mission');
    expect(FLAT).toContain('**The escalation list goes to the members, then to a person at landing**');
    expect(FLAT).toContain('the decision stays open for the person on the mission pull request');
    expect(FLAT).not.toContain('all go to a person, no member running');
  });

  it('keeps a PRD approved by its phase-0 pull request a person\'s, escalated by rule', () => {
    expect(FLAT).toContain('The one case still a person\'s at once is a PRD approved by its phase-0 pull request, which only a person merges');
    expect(section('4. Record it')).toContain('escalated by rule first, for a PRD approved by its phase-0 pull request only');
  });

  it('runs the members whatever the list names, and never shows them the list', () => {
    const list = section('2. The escalation list');
    expect(list).toContain('**the members still run** (step 3)');
    expect(list).not.toContain('no member runs');
    expect(list).toContain('The members never see the list.');
    expect(section('3. Each member, alone')).toContain('Never pass it another member\'s verdict, this skill\'s own view, or the escalation list.');
  });

  it('AC-5: says the words the decision is recorded in: carried on the list on every yes, deferred with option A otherwise', () => {
    const carried = decisionLine(decide(item(), yes, null));
    const deferred = decisionLine(decide(item(), [...yes.slice(0, 2), { role: 'reviewer', answer: 'unsure', sentence: 'Cannot tell.' }], null));
    expect(carried).toBe('carried · on the escalation list');
    expect(deferred).toBe('deferred · option A');
    expect(FLAT).toContain(`| every sitting member \`yes\`, the case on the list | \`${carried}\` | \`${carried}\` |`);
    expect(FLAT).toContain('| any `no` or `unsure` (a member failed or timed out counts `unsure`) | `deferred`, with option A, the most reversible: the mission carries on | `escalated`: never approved without every yes, it goes to a person |');
    expect(FLAT).toContain('the item is deferred with option A, its sentence kept for the person at landing');
  });

  it('still asks nothing, approves nothing on the page, settles nothing itself and never merges', () => {
    expect(FLAT).toContain('**It asks nothing,**');
    expect(FLAT).toContain('and the item is deferred, or the PRD goes to a person');
    expect(FLAT).toContain('**It never approves on the page**, never settles an item, never merges');
  });
});
