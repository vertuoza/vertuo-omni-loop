import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePrd, parseProductPrdId } from '../ids.ts';
import { makeMarkers } from '../markers.ts';
import { renderSettledEntry } from '../outbox/settle.ts';
import {
  agreeSentence,
  decisionLists,
  decisionName,
  decisionsOf,
  deferredLines,
  deferredOf,
  overturnSentence,
  overturnWords,
  parseDecisionName,
  parseRef,
  refOf,
  reworkLine,
  reworksOf,
  trustLine,
  type DecisionEvent,
  type RecordedDecision,
} from './overturn.ts';
import { agreeEntry } from './overturn.agree.ts';

// What a decision of the fleet is called, how the mission's events say it, and the words that show it (PRD 2896 s11).

const approved = (prd: number, verdicts = 'pm yes, architect yes, reviewer yes'): DecisionEvent => ({ kind: 'decided', prd: parsePrd(prd), sentence: `The committee approved PRD ${String(prd)}: ${verdicts}.` });
const answered = (prd: number, item: string): DecisionEvent => ({
  kind: 'decided', prd: parsePrd(prd), sentence: `The committee answered ${item} of PRD ${String(prd)} with option A: pm yes, architect yes, reviewer yes.`, link: 'https://github.com/a/b/pull/9',
});
const overturned = (ref: string, actor = 'ada'): DecisionEvent => ({ kind: 'overturned', prd: parsePrd(Number(ref.split('/')[0])), sentence: `${actor} overturned fleet decision ${ref}: no.`, actor });

describe('a decision\'s name', () => {
  it('is a PRD\'s number for its approval and <prd>/<item> for an answer, and nothing else', () => {
    expect(parseRef('2901')).toEqual({ prd: 2901, item: null });
    expect(parseRef('2901/s2-01')).toEqual({ prd: 2901, item: 's2-01' });
    expect(refOf({ prd: parsePrd(7), item: 's1' })).toBe('7/s1');
    for (const bad of ['', '0', 'x', '7/', '7/S1', '7/s1/x', '-1']) expect(parseRef(bad)).toBeNull();
  });
});

describe('the decisions of a mission', () => {
  it('reads each carried decision with its verdicts, in order, and the person who overturned it', () => {
    const list = decisionsOf([approved(5), answered(5, 's1-01'), overturned('5/s1-01', 'ben'), { kind: 'escalated', prd: parsePrd(6), sentence: 'PRD 6 goes to a person: x' }]);
    expect(list.map(({ ref, verdicts, option, overturnedBy }) => ({ ref: refOf(ref), verdicts, option, overturnedBy }))).toEqual([
      { ref: '5', verdicts: 'pm yes, architect yes, reviewer yes', option: null, overturnedBy: null },
      { ref: '5/s1-01', verdicts: 'pm yes, architect yes, reviewer yes', option: 'A', overturnedBy: 'ben' },
    ]);
  });

  it('keeps the decision when it is overturned, and lets one made again stand on its own', () => {
    const list = decisionsOf([approved(5), overturned('5'), approved(5)]);
    expect(list.map((one) => one.overturnedBy)).toEqual(['ada', null]);
  });

  it('reads a decision recorded before verdicts were kept, and ignores an overturn that names none', () => {
    const old: DecisionEvent = { kind: 'decided', prd: parsePrd(5), sentence: 'The committee approved PRD 5: every member who sat answered yes.' };
    expect(decisionsOf([old, overturned('9')])).toMatchObject([{ verdicts: null, overturnedBy: null }]);
  });
});

describe('what a person sees', () => {
  it('counts decisions and overturns in the trust line', () => {
    expect(trustLine([])).toBe('0 decisions by the fleet · 0 overturned');
    expect(trustLine(decisionsOf([approved(5), answered(5, 'a-1'), overturned('5')]))).toBe('2 decisions by the fleet · 1 overturned');
  });

  it('opens the pull request with the two lists, each line with its verdicts and link', () => {
    const lines = decisionLists(decisionsOf([approved(5), answered(5, 's1-01'), overturned('5')]));
    expect(lines.join('\n')).toBe(
      [
        '**Approved by the fleet**',
        '',
        '- PRD 5: pm yes, architect yes, reviewer yes · overturned by ada. Overturn it with `omni mission overturn <mission> 5`',
        '',
        '**Answered by the fleet**',
        '',
        '- s1-01 of PRD 5, option A: pm yes, architect yes, reviewer yes ([link](https://github.com/a/b/pull/9)). Overturn it with `omni mission overturn <mission> 5/s1-01`',
        '',
      ].join('\n'),
    );
    expect(decisionLists([])).toEqual([]);
  });

  it('says what an overturn does', () => {
    const ref = { prd: parsePrd(5), item: null };
    expect(overturnWords({ ref, branch: 'mission/1-x', onBranch: true }).join('\n')).toContain('PRD 5 leaves mission/1-x');
    expect(overturnWords({ ref: { prd: parsePrd(5), item: 'a-1' }, branch: null, onBranch: false })).toEqual([
      expect.stringContaining('The decision stays as it was recorded') as string,
      'a-1 of PRD 5 is open again for you: answer it on the PRD\'s feature pull request.',
    ]);
    expect(overturnSentence('ada', ref, 'why')).toBe('ada overturned fleet decision 5: why');
  });
});

// PRD omni-loop-21 s12: the deferred decisions of a mission pull request, and a person's Agree and Overturn.

const product = parseProductPrdId('omni-loop-15');
const decision = (over: Partial<RecordedDecision> = {}): RecordedDecision => ({
  kind: 'answer',
  prd: parsePrd(7),
  item: 's1-01',
  outcome: 'deferred',
  why: ['on the escalation list: bears on business law BL-QUOTES-1', 'architect no: the shape is not settled'],
  option: 'A',
  ...over,
});
const links = (name: string, answer: string): string => `https://omni.example.com/answer?decision=${name}&answer=${answer}`;

describe('a decision\'s name on the mission pull request', () => {
  it('names a repository PRD by its number and a product PRD by its id, and reads both back', () => {
    expect(decisionName(parsePrd(7), 's1-01')).toBe('7/s1-01');
    expect(decisionName(product, 's2-01')).toBe('omni-loop-15/s2-01');
    expect(decisionName(product, null)).toBe('omni-loop-15');
    expect(parseDecisionName('omni-loop-15/s2-01')).toEqual({ prd: 'omni-loop-15', item: 's2-01' });
    expect(parseDecisionName('2901')).toEqual({ prd: 2901, item: null });
    for (const bad of ['', 'omni-loop', 'omni-loop-R3/s1', '0/s1', '7/S1', '7/s1/x']) expect(parseDecisionName(bad)).toBeNull();
  });
});

describe('the deferred decisions (AC-7)', () => {
  it('lists each item the meeting deferred or carried off the escalation list, never an approval, an escalation or a plain carried answer', () => {
    const listed = deferredOf(
      [
        decision(),
        decision({ prd: product, item: 's2-01', outcome: 'carried', option: null, why: ['on the escalation list: hard to revert'] }),
        decision({ item: 's1-02', outcome: 'carried', option: null, why: ['every member who sat answered yes: pm yes'] }),
        decision({ kind: 'approve', item: null, outcome: 'carried', why: [] }),
        decision({ item: 's1-03', outcome: 'escalated', option: null }),
      ],
      [],
    );
    expect(listed.map(({ prd, item, outcome, option }) => [decisionName(prd, item), outcome, option])).toEqual([
      ['7/s1-01', 'deferred', 'A'],
      ['omni-loop-15/s2-01', 'carried', 'A'],
    ]);
  });

  it('renders each with its option, its PRD, why, and the Agree and Overturn links', () => {
    const lines = deferredLines(deferredOf([decision(), decision({ prd: product, item: 's2-01', outcome: 'carried', option: null, why: ['on the escalation list: hard to revert.'] })], []), links);
    expect(lines[0]).toBe('**Deferred decisions**');
    expect(lines).toContain(
      '- s1-01 of PRD 7 · deferred, option A taken meanwhile · on the escalation list: bears on business law BL-QUOTES-1; architect no: the shape is not settled. [Agree](https://omni.example.com/answer?decision=7/s1-01&answer=agree) · [Overturn](https://omni.example.com/answer?decision=7/s1-01&answer=overturn)',
    );
    expect(lines).toContain(
      '- s2-01 of PRD omni-loop-15 · carried by the fleet, option A · on the escalation list: hard to revert. [Agree](https://omni.example.com/answer?decision=omni-loop-15/s2-01&answer=agree) · [Overturn](https://omni.example.com/answer?decision=omni-loop-15/s2-01&answer=overturn)',
    );
    expect(deferredLines([], links)).toEqual([]);
  });

  it('shows the person\'s latest answer in place of the links, signed with their login', () => {
    const events: DecisionEvent[] = [
      { kind: 'agreed', prd: parsePrd(7), sentence: agreeSentence('ada', '7/s1-01'), actor: 'ada' },
      { kind: 'overturned', prd: null, sentence: 'ben overturned fleet decision omni-loop-15/s2-01: no, red.', actor: 'ben' },
    ];
    const listed = deferredOf([decision(), decision({ prd: product, item: 's2-01' })], events);
    expect(listed.map((one) => one.answer)).toEqual([{ answer: 'agree', by: 'ada' }, { answer: 'overturn', by: 'ben' }]);
    const lines = deferredLines(listed, links).join('\n');
    expect(lines).toContain('Agreed by ada.');
    expect(lines).toContain('Overturned by ben: the fleet reworks PRD omni-loop-15 on the mission branch.');
    expect(lines).not.toContain('[Agree]');
  });
});

describe('an overturn reworks its PRD on the mission branch (AC-8)', () => {
  it('reworks each PRD with an overturned decision, once, with the fix skill on the mission branch', () => {
    const events: DecisionEvent[] = [
      { kind: 'overturned', prd: parsePrd(7), sentence: overturnSentence('ada', { prd: parsePrd(7), item: 's1-01' }, 'no'), actor: 'ada' },
      { kind: 'overturned', prd: parsePrd(7), sentence: overturnSentence('ada', { prd: parsePrd(7), item: 's1-02' }, 'no'), actor: 'ada' },
    ];
    const listed = deferredOf([decision(), decision({ item: 's1-02' }), decision({ prd: product, item: 's2-01' })], events);
    expect(reworksOf(listed)).toEqual([7]);
    expect(reworkLine(parsePrd(7), { branch: 'mission/12-quotes' })).toBe('/omni:yolo-fix 7 --base mission/12-quotes');
    expect(reworkLine(product, { bases: [{ repo: 'acme/a', branch: 'mission/12-quotes' }, { repo: 'acme/b', branch: 'mission/12-quotes' }] })).toBe(
      '/omni:ultra-yolo-fix omni-loop-15 --base-of acme/a=mission/12-quotes,acme/b=mission/12-quotes',
    );
  });
});

describe('Agree settles the item on the mission branch as the person\'s (AC-8)', () => {
  const markers = makeMarkers('omni-outbox');
  const itemText = [
    '---', 'id: s1-01-colour', 'prd: 7', 'slice: s1', 'rank: high', 'bears-on: none', 'raised: 2027-01-22', 'wave: 1', '---', '',
    '## The question, in plain words', '', 'Which colour?', '',
    '## The decision, in plain words', '', 'Blue.', '',
    '## The options, in plain words', '', 'A. Blue (built).', 'B. Red.', '',
    ...['What I had to decide', 'What I did meanwhile', 'What it costs to change later', 'What I could not know'].flatMap((heading) => [`## ${heading}`, '', '(author) The colour.', '']),
  ].join('\n');
  const fleetEntry = renderSettledEntry({
    item: { id: 's1-01-colour', rank: 'high', bearsOn: 'none', raised: '2027-01-22', slice: undefined, wave: 1 },
    itemText,
    answer: { text: 'A. Blue (built).\n\nAnswered by fleet night-shift for mission/12-quotes: every member who sat answered yes.', approvedBy: 'fleet night-shift', approvedAt: '2027-01-22T09:00:00Z', channel: null },
    judgement: { verdict: 'agreed', basis: 'fleet', reason: 'every member who sat answered yes' },
    markers,
  });
  const settled = `# Settled\n\n${fleetEntry}`;

  it('appends the person\'s entry after the fleet\'s, the item as raised and the option the fleet took', () => {
    const agreed = agreeEntry({ settled, markers, item: 's1-01-colour', login: 'ada', at: '2027-01-23T10:00:00Z' });
    if (!agreed.ok) throw new Error(agreed.why);
    expect(agreed.text.startsWith(settled)).toBe(true);
    expect(agreed.entry).toContain('- Approved by: ada');
    expect(agreed.entry).toContain('A. Blue (built).');
    expect(agreed.entry).toContain('ada agreed with the answer fleet night-shift gave, on the mission pull request.');
    expect(agreed.entry).toContain('Which colour?');
  });

  it('refuses an item a person answered already, and one never settled there', () => {
    const once = agreeEntry({ settled, markers, item: 's1-01-colour', login: 'ada', at: '2027-01-23T10:00:00Z' });
    if (!once.ok) throw new Error(once.why);
    expect(agreeEntry({ settled: once.text, markers, item: 's1-01-colour', login: 'ben', at: '2027-01-23T11:00:00Z' })).toEqual({ ok: false, why: 's1-01-colour: ada answered it already', gone: true });
    expect(agreeEntry({ settled, markers, item: 's9-01-other', login: 'ada', at: '2027-01-23T10:00:00Z' })).toEqual({ ok: false, why: 's9-01-other: it has no settled entry on the mission branch', gone: true });
  });
});

describe('the browser bundles overturn.ts (the arcade\'s Missions tab)', () => {
  it('reaches no node: module through its imports, so the arcade\'s build can bundle it', () => {
    const seen = new Set<string>();
    const reached: string[] = [];
    const walk = (file: string): void => {
      if (seen.has(file)) return;
      seen.add(file);
      for (const [, spec] of readFileSync(file, 'utf8').matchAll(/^import (?!type )[^'"]*['"]([^'"]+)['"]/gm)) {
        if (spec === undefined) continue;
        if (spec.startsWith('node:')) reached.push(`${file} imports ${spec}`);
        else if (spec.startsWith('.')) walk(join(dirname(file), spec));
      }
    };
    walk(fileURLToPath(new URL('./overturn.ts', import.meta.url)));
    expect(reached).toEqual([]);
  });
});
