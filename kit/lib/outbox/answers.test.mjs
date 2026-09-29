import { describe, expect, it } from 'vitest';
import { makeMarkers } from '../markers.mjs';
import { formatNumbersMarker } from './comment.mjs';
import { parseOutboxItem } from './outbox.mjs';
import { planReplies } from './replies.mjs';
import { answerableQuestions, askBatches, cleanLine, REASON_MAX_LENGTH, writeReply } from './answers.mjs';

const PRD = 251;
const markers = makeMarkers('omni-outbox');

/** An item's text, as `omni item new` writes it: options for a decision, steps for a human action. */
function itemText(id, { rank = 'high', letters = ['A', 'B', 'C'] } = {}) {
  const body = rank === 'human-action'
    ? ['## What a person must do', '', '1. Add the secret to the project.', '']
    : ['## The options, in plain words', '', ...letters.map((letter) => `${letter}. Option ${letter} for ${id}.`), ''];
  return [
    '---',
    `id: ${id}`,
    `prd: ${PRD}`,
    `slice: ${id.split('-')[0]}`,
    `rank: ${rank}`,
    'bears-on: none',
    'raised: 2026-09-27',
    'wave: 1',
    '---',
    '',
    '## The question, in plain words',
    '',
    `Which way for ${id}?`,
    '',
    '## The decision, in plain words',
    '',
    'We kept the first way.',
    '',
    ...body,
    '## What I had to decide',
    '',
    'x',
    '',
    '## What I did meanwhile',
    '',
    'Kept the first way.',
    '',
    '## What it costs to change later',
    '',
    'z',
    '',
    '## What I could not know',
    '',
    '(author) w',
    '',
  ].join('\n');
}

function item(id, options) {
  const parsed = parseOutboxItem(itemText(id, options), { file: `.omni-loop/delivery/outbox/x/${id}.md` });
  if (!parsed.ok) throw new Error(parsed.errors.join('\n'));
  return parsed.item;
}

const ITEMS = [
  item('s1-01', { rank: 'high' }),
  item('s1-02', { rank: 'high', letters: ['A', 'B'] }),
  item('s2-01', { rank: 'human-action' }),
  item('s2-02', { rank: 'medium' }),
];
const NUMBERING = [
  { number: 1, id: 's1-01', since: '2026-09-27T08:00:00Z' },
  { number: 2, id: 's1-02', since: '2026-09-27T08:00:00Z' },
  { number: 5, id: 's2-02', since: '2026-09-27T08:00:00Z' },
  { number: 19, id: 's2-01', since: '2026-09-27T08:00:00Z' },
];
const QUESTIONS = answerableQuestions({ numbering: NUMBERING, items: ITEMS });

const write = (picks, door = 'terminal') => writeReply({ prd: PRD, door, questions: QUESTIONS, picks });

describe('writeReply (PRD 251)', () => {
  it('writes each pick on its own line, in the order of the numbers, then the door', () => {
    const result = write([
      { number: 19, pick: 'done' },
      { number: 5, pick: 'prose', text: 'keep it, it reads well' },
      { number: 2, pick: 'b', reason: 'the list is shorter' },
      { number: 1, pick: 'A' },
    ]);
    expect(result).toEqual({
      ok: true,
      reply: [
        '1: A',
        '2: B because the list is shorter',
        '5: keep it, it reads well',
        '19: ok',
        '',
        '_answered in the terminal · PRD 251_',
      ].join('\n'),
    });
  });

  it('writes not done with its reason, and names the Omni page as the door', () => {
    expect(write([{ number: 19, pick: 'not-done', reason: 'no access yet' }], 'page')).toEqual({
      ok: true,
      reply: '19: no, because no access yet\n\n_answered on the Omni page · PRD 251_',
    });
  });

  it('refuses a number the numbering does not hold', () => {
    expect(write([{ number: 7, pick: 'A' }])).toEqual({ ok: false, reason: 'question 7 is not open on this pull request' });
  });

  it('refuses a letter the question does not offer', () => {
    expect(write([{ number: 2, pick: 'C' }])).toEqual({ ok: false, reason: 'question 2 offers no option C' });
  });

  it('refuses done or not done on a decision, and a letter on a human action', () => {
    expect(write([{ number: 1, pick: 'done' }])).toEqual({ ok: false, reason: 'question 1 is a decision: pick one of its options' });
    expect(write([{ number: 1, pick: 'not-done', reason: 'x' }])).toMatchObject({ ok: false });
    expect(write([{ number: 19, pick: 'A' }])).toEqual({ ok: false, reason: 'question 19 needs a person: answer done or not-done' });
  });

  it('refuses not done without a reason, and prose without text', () => {
    expect(write([{ number: 19, pick: 'not-done' }])).toEqual({ ok: false, reason: 'question 19: not-done needs a reason' });
    expect(write([{ number: 19, pick: 'not-done', reason: ' <!-- --> ' }])).toMatchObject({ ok: false });
    expect(write([{ number: 5, pick: 'prose', text: '\n' }])).toEqual({ ok: false, reason: 'question 5: a prose answer needs its text' });
  });

  it('refuses no picks, a question answered twice, an unknown door and a malformed pick', () => {
    expect(write([])).toEqual({ ok: false, reason: 'no answer to write' });
    expect(write([{ number: 1, pick: 'A' }, { number: 1, pick: 'B' }])).toEqual({ ok: false, reason: 'question 1 is answered twice' });
    expect(write([{ number: 1, pick: 'A' }], 'slack')).toMatchObject({ ok: false, reason: expect.stringMatching(/door/) });
    expect(write([{ number: 'one', pick: 'A' }])).toMatchObject({ ok: false, reason: expect.stringMatching(/number/) });
    expect(write([{ number: 1 }])).toMatchObject({ ok: false, reason: expect.stringMatching(/pick/) });
  });

  it('makes a reason one clean line of at most 500 characters, with no marker in it', () => {
    const reason = `first line\nsecond <!-- omni-outbox-pr --> line\r\n3: B${'x'.repeat(600)}`;
    const cleaned = cleanLine(reason);
    expect(cleaned).toHaveLength(REASON_MAX_LENGTH);
    expect(cleaned).not.toMatch(/\n|\r|<!--|-->/);
    expect(cleaned.startsWith('first line second omni-outbox-pr line 3: Bxx')).toBe(true);
    expect(cleanLine('<!<!---->- x')).not.toMatch(/<!--|-->/);

    const { reply } = write([{ number: 2, pick: 'B', reason }]);
    const answerLines = reply.split('\n').filter((line) => /^\s*\d+\s*:/.test(line));
    expect(answerLines).toHaveLength(1);
    expect(reply).not.toContain('<!--');
  });
});

describe('the reply writer and planReplies agree (PRD 251)', () => {
  const prComment = {
    id: 1,
    body: `${markers.prComment}\n${formatNumbersMarker(NUMBERING, markers)}\n\n## Outbox questions`,
    user: { login: 'omni-loop[bot]' },
    author_association: 'NONE',
    created_at: '2026-09-27T08:00:00Z',
    html_url: 'https://github.com/o/r/pull/9#issuecomment-1',
  };
  const read = (reply) => {
    const comment = {
      id: 2,
      body: reply,
      user: { login: 'pierre' },
      author_association: 'MEMBER',
      created_at: '2026-09-27T09:00:00Z',
      html_url: 'https://github.com/o/r/pull/9#issuecomment-2',
    };
    const plan = planReplies({ comments: [prComment, comment], items: ITEMS, markers });
    expect(plan.held).toEqual([]);
    return new Map(plan.settle.map((entry) => [entry.number, { verdict: entry.judgement.verdict, text: entry.answer.recorded }]));
  };

  it.each([
    ['A, no reason', { number: 1, pick: 'A' }, 1, { verdict: 'agreed', text: 'A. Option A for s1-01.' }],
    ['A, with a reason', { number: 1, pick: 'A', reason: 'it is simpler' }, 1, { verdict: 'agreed', text: 'A. Option A for s1-01. — because it is simpler' }],
    ['another letter, with a reason', { number: 2, pick: 'B', reason: 'shorter' }, 2, { verdict: 'drifted', text: 'B. Option B for s1-02. — because shorter' }],
    ['another letter, no reason', { number: 1, pick: 'C' }, 1, { verdict: 'drifted', text: 'C. Option C for s1-01.' }],
    ['done', { number: 19, pick: 'done' }, 19, { verdict: 'agreed', text: 'ok' }],
    ['not done', { number: 19, pick: 'not-done', reason: 'the grant is missing' }, 19, { verdict: 'drifted', text: 'no, because the grant is missing' }],
    ['prose that agrees', { number: 5, pick: 'prose', text: 'yes, keep it' }, 5, { verdict: 'agreed', text: 'yes, keep it' }],
    ['prose that disagrees', { number: 1, pick: 'prose', text: 'use the other list instead' }, 1, { verdict: 'drifted', text: 'use the other list instead' }],
    ['a cleaned reason', { number: 2, pick: 'B', reason: 'one\ntwo <!-- x -->' }, 2, { verdict: 'drifted', text: 'B. Option B for s1-02. — because one two x' }],
  ])('%s reads back as the same answer', (_name, pick, number, expected) => {
    const { reply } = write([pick]);
    expect(read(reply).get(number)).toEqual(expected);
  });

  it('a reply answering several numbers answers each of them', () => {
    const { reply } = write([
      { number: 1, pick: 'A' },
      { number: 2, pick: 'B', reason: 'shorter' },
      { number: 5, pick: 'prose', text: 'ok' },
      { number: 19, pick: 'done' },
    ], 'page');
    const settled = read(reply);
    expect([...settled.keys()].sort((a, b) => a - b)).toEqual([1, 2, 5, 19]);
    expect(settled.get(2).verdict).toBe('drifted');
    expect(settled.get(19)).toEqual({ verdict: 'agreed', text: 'ok' });
  });
});

describe('askBatches (PRD 251)', () => {
  it('asks the open human actions first, then the highs by number, at most four at a time, and never a medium', () => {
    const items = [
      ...['a', 'b', 'c', 'd', 'e'].map((x) => item(`s3-0${x}`, { rank: 'high' })),
      item('s4-01', { rank: 'human-action' }),
      item('s4-02', { rank: 'medium' }),
    ];
    const numbering = [
      { number: 3, id: 's3-0c', since: 't' },
      { number: 1, id: 's3-0a', since: 't' },
      { number: 2, id: 's3-0b', since: 't' },
      { number: 4, id: 's3-0d', since: 't' },
      { number: 6, id: 's3-0e', since: 't' },
      { number: 7, id: 's4-01', since: 't' },
      { number: 8, id: 's4-02', since: 't' },
      { number: 9, id: 'gone', since: 't' },
    ];
    const batches = askBatches({ numbering, items });
    expect(batches.map((batch) => batch.map((question) => question.number))).toEqual([[7, 1, 2, 3], [4, 6]]);
    const [action, high] = batches[0];
    expect(action).toMatchObject({
      number: 7,
      id: 's4-01',
      header: 'Q7 · action',
      text: 'Which way for s4-01? We kept the first way.',
      steps: '1. Add the secret to the project.',
      options: [
        { pick: 'done', label: 'Done' },
        { pick: 'not-done', label: 'Not done' },
      ],
    });
    expect(high).toMatchObject({
      number: 1,
      header: 'Q1 · high',
      options: [
        { pick: 'A', label: 'A · built', text: 'Option A for s3-0a.' },
        { pick: 'B', label: 'B', text: 'Option B for s3-0a.' },
        { pick: 'C', label: 'C', text: 'Option C for s3-0a.' },
      ],
    });
  });

  it('asks nothing when nothing is open', () => {
    expect(askBatches({ numbering: [], items: ITEMS })).toEqual([]);
    expect(askBatches({ numbering: [{ number: 5, id: 's2-02', since: 't' }], items: ITEMS })).toEqual([]);
  });
});
