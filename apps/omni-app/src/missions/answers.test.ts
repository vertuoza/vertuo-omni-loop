import { describe, expect, it } from 'vitest';
import { committeeLine } from 'omni-loop/kit/lib/committee/record.ts';
import { parseOutboxItemId, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { answeredOf, answerEvents, answersNext, askLine, itemOfLine, itemsOpen, withDecisions, type ItemCommittee } from './answers.ts';

// The committee's answer to a high item, in a mission's run (PRD 2896 s10, criteria 14 to 16): pure. Three yes to option A
// carry; the escalation list, any other option, a no, an unsure, a failed or silent job send the item to a person.

const prd = parsePrd(7);
const ITEM = 's3-01-keep-the-cap';
const one = (over: Partial<ItemCommittee> = {}): ItemCommittee => ({
  prd,
  item: ITEM,
  job: 'job-9',
  attempt: { id: 'job-9', status: 'done', outcome: null, reason: null, prUrl: null },
  decision: null,
  ...over,
});
const yes = [
  { role: 'pm' as const, answer: 'yes' as const, sentence: 'In scope.' },
  { role: 'architect' as const, answer: 'yes' as const, sentence: 'Reversible.' },
  { role: 'reviewer' as const, answer: 'yes' as const, sentence: 'Tested.' },
];
const logOf = (over: Record<string, unknown> = {}) =>
  committeeLine({ v: 1, prd, kind: 'answer', item: parseOutboxItemId(ITEM), option: 'A', author: null, read: [{ kind: 'item', sha256: 'a'.repeat(64) }], escalations: [], verdicts: yes, outcome: 'carried', ...over });

describe('the line', () => {
  it('names the PRD, the item and the bound, and reads back', () => {
    expect(askLine(prd, ITEM, 0.6)).toBe('/omni:committee 7 --item s3-01-keep-the-cap --bound 0.6');
    expect(itemOfLine(askLine(prd, ITEM, 0.6))).toEqual({ prd, item: ITEM });
    expect(itemOfLine('/omni:committee 7 --approve')).toBeNull();
    expect(itemOfLine('/omni:yolo 7')).toBeNull();
  });
});

describe('what the open items wait on', () => {
  it('sends each high item with no committee yet, and leaves a human-action one to a person', () => {
    expect(answersNext([{ id: ITEM, rank: 'high' }, { id: 's3-02-set-the-key', rank: 'human-action' }], [])).toEqual({
      send: [ITEM],
      deciding: false,
      person: ['s3-02-set-the-key is a human-action item: only a person can act on it'],
    });
  });

  it('waits on a committee at work, and sends an escalated item to a person, never twice', () => {
    expect(answersNext([{ id: ITEM, rank: 'high' }], [one({ decision: null })])).toEqual({ send: [], deciding: true, person: [] });
    expect(answersNext([{ id: ITEM, rank: 'high' }], [one({ decision: { outcome: 'escalated', why: [] } })])).toEqual({ send: [], deciding: false, person: [`the committee sent ${ITEM} to you`] });
  });

  it('sends a person an item that does not read', () => {
    expect(answersNext([{ id: null, rank: null }], []).person).toEqual(['an item of its outbox does not read']);
  });

  it('is held by a high, a human-action or an unread item, never by a medium one', () => {
    expect(itemsOpen([{ id: 'x', rank: 'medium' }])).toBe(false);
    expect(itemsOpen([{ id: 'x', rank: 'high' }])).toBe(true);
    expect(itemsOpen([{ id: null, rank: null }])).toBe(true);
    expect(itemsOpen([])).toBe(false);
  });

  it('reads a decision back from its event', () => {
    const [carried, escalated, none] = withDecisions(
      [one({ job: 'a' }), one({ job: 'b' }), one({ job: 'c' })],
      [{ kind: 'decided', prd, job: 'a' }, { kind: 'escalated', prd, job: 'b' }, { kind: 'dispatched', prd, job: 'c' }],
    );
    expect([carried?.decision?.outcome, escalated?.decision?.outcome, none?.decision]).toEqual(['carried', 'escalated', null]);
  });
});

describe('the decision, taken again from the job\'s log', () => {
  it('carries three yes to option A (criterion 14)', () => {
    expect(answeredOf(prd, one(), logOf())).toEqual({ verdicts: yes, decision: { outcome: 'carried', why: [] } });
  });

  it('carries two yes when the hero that raised it sat out', () => {
    expect(answeredOf(prd, one(), logOf({ author: 'pm', verdicts: yes.slice(1) })).decision.outcome).toBe('carried');
  });

  it('escalates what the list named, although every member answered yes (criterion 15)', () => {
    expect(answeredOf(prd, one(), logOf({ escalations: ['its hard-to-revert score is unknown'] })).decision).toEqual({ outcome: 'escalated', why: ['its hard-to-revert score is unknown'] });
  });

  it('escalates a no with the verdicts, and never takes the job\'s own word on the outcome (criterion 16)', () => {
    const no = [yes[0], { role: 'architect' as const, answer: 'no' as const, sentence: 'B is safer.' }, yes[2]];
    expect(answeredOf(prd, one(), logOf({ verdicts: no, outcome: 'carried' })).decision).toEqual({ outcome: 'escalated', why: ['the Architect answered no: B is safer.'] });
  });

  it('escalates any option but A', () => {
    expect(answeredOf(prd, one(), logOf({ option: 'B' })).decision.why).toEqual(['it was answered with option B: the fleet settles an item with option A, as built, only']);
  });

  it('escalates a job that failed, or left no record for this item, each member counted failed', () => {
    expect(answeredOf(prd, one({ attempt: { id: 'j', status: 'failed', outcome: null, reason: 'boom', prUrl: null } }), null).decision.why).toEqual([
      'the PM failed, counted unsure: Its job failed.',
      'the Architect failed, counted unsure: Its job failed.',
      'the Reviewer failed, counted unsure: Its job failed.',
    ]);
    expect(answeredOf(prd, one({ item: 's3-02-other' }), logOf()).decision.outcome).toBe('escalated');
  });
});

describe('the events', () => {
  it('says what was sent, then what was decided, signed by the chair', () => {
    const events = answerEvents([one({ decision: { outcome: 'carried', why: [] } }), one({ job: 'job-10', item: 's3-02-other', decision: { outcome: 'escalated', why: ['the Reviewer answered unsure: No test.'] } })], "the night-shift fleet's runners");
    expect(events.map(({ kind, role, sentence }) => [kind, role, sentence])).toEqual([
      ['dispatched', 'supervisor', "Sent /omni:committee 7 --item s3-01-keep-the-cap to the night-shift fleet's runners."],
      ['decided', 'pm', 'The committee answered s3-01-keep-the-cap of PRD 7 with option A: every member who sat answered yes.'],
      ['dispatched', 'supervisor', "Sent /omni:committee 7 --item s3-02-other to the night-shift fleet's runners."],
      ['escalated', 'pm', 's3-02-other of PRD 7 goes to a person: the Reviewer answered unsure: No test.'],
    ]);
  });
});
