import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Context } from '../context.ts';
import { assertDefined } from '../../test/assert.ts';
import { flatCtx as untypedFlatCtx } from '../../test/flat-layout.ts';
import { makeMarkers } from '../markers.ts';
import { formatNumbersMarker } from './comment.ts';
import { adoptItem, parseSettledEntries } from './settle.ts';
import {
  formatRoundComment,
  interpretAnswer,
  parseReplyLines,
  planReplies,
  readReplies,
  WRITER_ASSOCIATIONS,
} from './replies.ts';

/** The flat test layout's context, typed as the kit's own (it carries every field the code reads). */
const flatCtx = (root: string): Context => untypedFlatCtx(root) as unknown as Context;

type OptionedSpec = { rank?: string; options?: string[] };

const PRD = 1071;
const PR = 1080;

// flatCtx (kit/test/flat-layout.ts) is configured with prefix `vertuo-outbox` — the exact prefix
// upstream hard-coded — so every marker literal below reproduces upstream's own text byte for byte.
const markers = makeMarkers('vertuo-outbox');

function withFixtureRoot<T>(run: (root: string) => T): T {
  const root = mkdtempSync(join(tmpdir(), 'outbox-replies-'));
  try {
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function writeItem(
  root: string,
  id: string,
  {
    rank = 'medium',
    questionPlain = `Is ${id} the right call?`,
    choice = 'Kept the default country.',
  }: { rank?: string; questionPlain?: string; choice?: string } = {},
) {
  const dir = join(root, 'docs/outbox', String(PRD));
  mkdirSync(dir, { recursive: true });
  const text = [
    '---',
    `id: ${id}`,
    `prd: ${PRD}`,
    `slice: ${id.split('-')[0]}`,
    `rank: ${rank}`,
    'bears-on: none',
    'raised: 2026-09-22',
    'wave: 1',
    '---',
    '',
    '## The question, in plain words',
    '',
    questionPlain,
    '',
    '## The decision, in plain words',
    '',
    'We kept what was there.',
    '',
    '## What I had to decide',
    '',
    'x',
    '',
    '## What I did meanwhile',
    '',
    choice,
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
  writeFileSync(join(dir, `${id}.md`), text);
  return `docs/outbox/${PRD}/${id}.md`;
}

/** The pull request comment s2 writes, carrying only what s3 reads off it: the numbering. */
function prComment(numbering: { number: number; id: string; since: string }[], { id = 1 }: { id?: number } = {}) {
  return {
    id,
    body: `${markers.prComment}\n${formatNumbersMarker(numbering, markers)}\n\n## Outbox questions`,
    user: { login: 'github-actions[bot]' },
    author_association: 'NONE',
    created_at: '2026-09-23T08:00:00Z',
    html_url: `https://github.com/o/r/pull/${PR}#issuecomment-${id}`,
  };
}

let nextReplyId = 100;
function reply(
  body: string,
  {
    at = '2026-09-23T10:00:00Z',
    login = 'pierre',
    association = 'MEMBER',
  }: { at?: string; login?: string; association?: string } = {},
) {
  const id = nextReplyId++;
  return {
    id,
    body,
    user: { login },
    author_association: association,
    created_at: at,
    html_url: `https://github.com/o/r/pull/${PR}#issuecomment-${id}`,
  };
}

function roundComment(round: number, numbers: number[], { at }: { at: string }) {
  return {
    id: nextReplyId++,
    body: `${markers.round(round, numbers)}\n**Outbox round ${round}**`,
    user: { login: 'github-actions[bot]' },
    author_association: 'NONE',
    created_at: at,
    html_url: 'https://github.com/o/r/pull/1#round',
  };
}

const EARLY = '2026-09-23T07:00:00.000Z';

function numbering(...ids: string[]) {
  return ids.map((id, index) => ({ number: index + 1, id, since: EARLY }));
}

function fakeClient(comments: object[]) {
  const all: object[] = [...comments];
  return {
    listComments: vi.fn(() => [...all]),
    createComment: vi.fn((body: string) => {
      const created = { id: 9999, body, html_url: 'https://github.com/o/r/pull/1#new' };
      all.push(created);
      return created;
    }),
    updateComment: vi.fn(),
  };
}

function settledOf(root: string) {
  const file = join(root, 'docs/outbox', String(PRD), 'settled.md');
  return existsSync(file) ? parseSettledEntries(readFileSync(file, 'utf8'), markers) : [];
}

describe('parseReplyLines', () => {
  it('reads numbered lines and approve all, ignoring every other line', () => {
    expect(
      parseReplyLines(
        'Thanks!\n1: ok\n  2 :  no, because the quote wins\nAPPROVE ALL\nnot a reply',
      ),
    ).toEqual([
      { kind: 'numbered', number: 1, text: 'ok' },
      { kind: 'numbered', number: 2, text: 'no, because the quote wins' },
      { kind: 'approve-all', text: 'approve all' },
    ]);
  });

  it('does not read "approve all" inside a sentence', () => {
    expect(parseReplyLines('I approve all of this')).toEqual([]);
  });
});

describe('readReplies — one reply answers several questions', () => {
  it('agrees with "1: ok" and drifts on "2: no, because …", through settleItem', () => {
    withFixtureRoot((root) => {
      const first = writeItem(root, 's1-01-country');
      const second = writeItem(root, 's2-01-currency');
      const answer = reply('1: ok\n2: no, because the quote should decide');
      const client = fakeClient([prComment(numbering('s1-01-country', 's2-01-currency')), answer]);

      const result = readReplies({ ctx: flatCtx(root), prd: PRD, pr: PR }, client);

      expect(result.settled.map((s) => [s.number, s.verdict])).toEqual([
        [1, 'agreed'],
        [2, 'drifted'],
      ]);
      expect(existsSync(join(root, first))).toBe(false);
      expect(existsSync(join(root, second))).toBe(false);
      const entries = settledOf(root);
      expect(entries.map((e) => [e.id, e.verdict])).toEqual([
        ['s1-01-country', 'agreed'],
        ['s2-01-currency', 'drifted'],
      ]);
      assertDefined(entries[0], 'entries[0]');
      expect(entries[0].fields.Channel).toMatch(/feature pull request #1080/);
      expect(entries[0].fields['Approved by']).toBe('pierre');
      expect(entries[0].fields['Approved at']).toBe('2026-09-23T10:00:00Z');
      expect(entries[0].answerText).toBe('ok');
      assertDefined(entries[1], 'entries[1]');
      expect(entries[1].answerText).toBe('no, because the quote should decide');
      expect(result.round).toBeNull();
      expect(client.createComment).not.toHaveBeenCalled();
    });
  });
});

describe('readReplies — approve all', () => {
  it('agrees with every listed question, recording the answer as "approve all"', () => {
    withFixtureRoot((root) => {
      writeItem(root, 's1-01-country', { rank: 'high' });
      writeItem(root, 's2-01-currency');
      const client = fakeClient([
        prComment(numbering('s1-01-country', 's2-01-currency')),
        reply('Approve all'),
      ]);

      const result = readReplies({ ctx: flatCtx(root), prd: PRD, pr: PR }, client);

      expect(result.settled.map((s) => [s.number, s.verdict])).toEqual([
        [1, 'agreed'],
        [2, 'agreed'],
      ]);
      expect(settledOf(root).map((e) => e.answerText)).toEqual(['approve all', 'approve all']);
    });
  });

  it('does not cover a question first listed after the reply was written', () => {
    withFixtureRoot((root) => {
      writeItem(root, 's1-01-country');
      writeItem(root, 's3-01-late');
      const list = [
        { number: 1, id: 's1-01-country', since: EARLY },
        { number: 2, id: 's3-01-late', since: '2026-09-23T11:00:00.000Z' },
      ];
      const client = fakeClient([prComment(list), reply('approve all')]);

      const result = readReplies({ ctx: flatCtx(root), prd: PRD, pr: PR }, client);

      expect(result.settled.map((s) => s.number)).toEqual([1]);
      expect(existsSync(join(root, 'docs/outbox/1071/s3-01-late.md'))).toBe(true);
    });
  });
});

describe('readReplies — a numbered answer beats approve all', () => {
  it.each([
    ['approve all first, then the numbered answer', ['approve all', '2: no, use the quote']],
    ['the numbered answer first, then approve all', ['2: no, use the quote', 'approve all']],
  ])('%s', (_name, [firstBody, secondBody]) => {
    withFixtureRoot((root) => {
      writeItem(root, 's1-01-country');
      writeItem(root, 's2-01-currency');
      assertDefined(firstBody, 'the first reply');
      assertDefined(secondBody, 'the second reply');
      const client = fakeClient([
        prComment(numbering('s1-01-country', 's2-01-currency')),
        reply(firstBody, { at: '2026-09-23T10:00:00Z' }),
        reply(secondBody, { at: '2026-09-23T10:05:00Z' }),
      ]);

      const result = readReplies({ ctx: flatCtx(root), prd: PRD, pr: PR }, client);

      expect(result.settled.map((s) => [s.number, s.verdict, s.answer])).toEqual([
        [1, 'agreed', 'approve all'],
        [2, 'drifted', 'no, use the quote'],
      ]);
    });
  });

  it('the later of two numbered answers wins', () => {
    withFixtureRoot((root) => {
      writeItem(root, 's1-01-country');
      const client = fakeClient([
        prComment(numbering('s1-01-country')),
        reply('1: no, wrong country', { at: '2026-09-23T10:00:00Z' }),
        reply('1: ok', { at: '2026-09-23T10:05:00Z' }),
      ]);

      const result = readReplies({ ctx: flatCtx(root), prd: PRD, pr: PR }, client);

      expect(result.settled.map((s) => [s.verdict, s.answer])).toEqual([['agreed', 'ok']]);
    });
  });
});

describe('readReplies — an unclear answer is asked again in a new round', () => {
  it('holds it, settles nothing, and produces a round-2 body', () => {
    withFixtureRoot((root) => {
      const file = writeItem(root, 's1-01-country', {
        rank: 'human-action',
        questionPlain: 'Which country should a new contact get?',
      });
      const client = fakeClient([
        prComment(numbering('s1-01-country')),
        reply('1: use the contact country'),
      ]);

      const result = readReplies({ ctx: flatCtx(root), prd: PRD, pr: PR }, client);

      expect(result.settled).toEqual([]);
      expect(existsSync(join(root, file))).toBe(true);
      expect(settledOf(root)).toEqual([]);
      expect(result.round).not.toBeNull();
      assertDefined(result.round, 'the round');
      expect(result.round.number).toBe(2);
      const body = result.round.body;
      expect(body.split('\n')[0]).toBe('<!-- vertuo-outbox-round: 2 1 -->');
      expect(body).toContain('**Outbox round 2**');
      expect(body).toContain('**Question 1** · needs a person');
      expect(body).toContain('Which country should a new contact get?');
      expect(body).toContain('You answered: “use the contact country”');
      expect(body).toContain('nothing was changed');
      expect(body).toContain(
        '**Are you okay? If not, why?** Reply `1: ok` to keep it, or `1: no, because …`',
      );
      expect(client.createComment).not.toHaveBeenCalled();
    });
  });

  it('posts the round comment only with post: true', () => {
    withFixtureRoot((root) => {
      writeItem(root, 's1-01-country');
      const client = fakeClient([prComment(numbering('s1-01-country')), reply('1: hmm')]);

      const result = readReplies({ ctx: flatCtx(root), prd: PRD, pr: PR, post: true }, client);

      expect(client.createComment).toHaveBeenCalledTimes(1);
      assertDefined(result.round, 'the round');
      expect(client.createComment).toHaveBeenCalledWith(result.round.body);
      expect(client.updateComment).not.toHaveBeenCalled();
    });
  });

  it('numbers the next round one past the highest round seen', () => {
    withFixtureRoot((root) => {
      writeItem(root, 's1-01-country');
      const client = fakeClient([
        prComment(numbering('s1-01-country')),
        reply('1: hmm', { at: '2026-09-23T09:00:00Z' }),
        roundComment(2, [1], { at: '2026-09-23T09:10:00Z' }),
        roundComment(3, [7], { at: '2026-09-23T09:20:00Z' }),
        reply('1: still unsure', { at: '2026-09-23T10:00:00Z' }),
      ]);

      const result = readReplies({ ctx: flatCtx(root), prd: PRD, pr: PR }, client);

      assertDefined(result.round, 'the round');
      expect(result.round.number).toBe(4);
      expect(result.round.body.split('\n')[0]).toBe('<!-- vertuo-outbox-round: 4 1 -->');
      expect(result.round.body).toContain('You answered: “still unsure”');
    });
  });

  it('with no new reply since the round that re-asked it, nothing is due and nothing is posted', () => {
    withFixtureRoot((root) => {
      writeItem(root, 's1-01-country');
      const client = fakeClient([
        prComment(numbering('s1-01-country')),
        reply('1: hmm', { at: '2026-09-23T09:00:00Z' }),
        roundComment(2, [1], { at: '2026-09-23T09:10:00Z' }),
      ]);

      const result = readReplies({ ctx: flatCtx(root), prd: PRD, pr: PR, post: true }, client);

      expect(result.settled).toEqual([]);
      expect(result.held.map((h) => h.number)).toEqual([1]);
      expect(result.round).toBeNull();
      expect(client.createComment).not.toHaveBeenCalled();
    });
  });

  it('re-running after a settlement settles and posts nothing', () => {
    withFixtureRoot((root) => {
      writeItem(root, 's1-01-country');
      const client = fakeClient([prComment(numbering('s1-01-country')), reply('1: ok')]);

      readReplies({ ctx: flatCtx(root), prd: PRD, pr: PR }, client);
      const again = readReplies({ ctx: flatCtx(root), prd: PRD, pr: PR, post: true }, client);

      expect(again.settled).toEqual([]);
      expect(again.round).toBeNull();
      expect(settledOf(root)).toHaveLength(1);
      expect(client.createComment).not.toHaveBeenCalled();
    });
  });
});

describe('readReplies — what is not a reply', () => {
  it('ignores a reply from someone who cannot write to the repository', () => {
    withFixtureRoot((root) => {
      writeItem(root, 's1-01-country');
      const client = fakeClient([
        prComment(numbering('s1-01-country')),
        reply('1: ok', { association: 'CONTRIBUTOR', login: 'drive-by' }),
        reply('approve all', { association: 'NONE', login: 'stranger' }),
      ]);

      const result = readReplies({ ctx: flatCtx(root), prd: PRD, pr: PR }, client);

      expect(result.settled).toEqual([]);
      expect(result.held).toEqual([]);
      expect(settledOf(root)).toEqual([]);
    });
  });

  it('counts OWNER, MEMBER and COLLABORATOR as writers', () => {
    expect([...WRITER_ASSOCIATIONS].sort()).toEqual(['COLLABORATOR', 'MEMBER', 'OWNER']);
  });

  it('ignores a writer comment that carries an outbox marker', () => {
    withFixtureRoot((root) => {
      writeItem(root, 's1-01-country');
      const marked = reply(`${markers.round(2, [1])}\n1: ok\napprove all`, {
        association: 'OWNER',
      });
      const client = fakeClient([
        { ...prComment(numbering('s1-01-country')), author_association: 'OWNER' },
        marked,
      ]);
      // The PR comment itself carries "Reply `1: ok`" text in s2's real rendering; make sure a
      // marker comment is never read even when it holds reply-shaped lines.
      client.listComments.mockReturnValue([
        {
          ...prComment(numbering('s1-01-country')),
          author_association: 'OWNER',
          body: `${prComment(numbering('s1-01-country')).body}\n1: ok\napprove all`,
        },
        marked,
      ]);

      const result = readReplies({ ctx: flatCtx(root), prd: PRD, pr: PR }, client);

      expect(result.settled).toEqual([]);
      expect(result.held).toEqual([]);
    });
  });

  it('ignores a number that names no open question', () => {
    withFixtureRoot((root) => {
      writeItem(root, 's1-01-country');
      const client = fakeClient([
        prComment([...numbering('s1-01-country'), { number: 2, id: 's0-01-gone', since: EARLY }]),
        reply('2: ok\n7: no'),
      ]);

      const result = readReplies({ ctx: flatCtx(root), prd: PRD, pr: PR }, client);

      expect(result.settled).toEqual([]);
      expect(result.held).toEqual([]);
      expect(existsSync(join(root, 'docs/outbox/1071/s1-01-country.md'))).toBe(true);
    });
  });

  it('does nothing when the pull request carries no outbox comment yet', () => {
    withFixtureRoot((root) => {
      writeItem(root, 's1-01-country');
      const client = fakeClient([reply('approve all')]);

      const result = readReplies({ ctx: flatCtx(root), prd: PRD, pr: PR }, client);

      expect(result.settled).toEqual([]);
      expect(result.round).toBeNull();
    });
  });
});

describe('planReplies — pure', () => {
  it('decides without touching disk, and is stable for the same input', () => {
    const items = [
      {
        id: 's1-01-country',
        rank: 'medium',
        file: 'docs/outbox/1071/s1-01-country.md',
        sections: { whatIDidMeanwhile: 'Kept it.', questionPlain: 'Which one?' },
      },
    ];
    const comments = [prComment(numbering('s1-01-country')), reply('1: yes')];
    const once = planReplies({ comments, items, markers });
    expect(once).toEqual(planReplies({ comments, items, markers }));
    expect(once.settle.map((s) => [s.number, s.judgement.verdict])).toEqual([[1, 'agreed']]);
  });

  it('parses the rows it is handed: an item comes back as it went in, and a malformed row is refused', () => {
    const item = { id: 's1-01-country', rank: 'medium', file: 'docs/outbox/1071/s1-01-country.md', sections: { whatIDidMeanwhile: 'Kept it.', questionPlain: 'Which one?' } };
    const comments = [prComment(numbering('s1-01-country')), reply('1: yes')];
    expect(planReplies({ comments, items: [item], markers }).settle[0]?.item).toEqual(item);
    const { rank: _rank, ...noRank } = item;
    expect(() => planReplies({ comments, items: [noRank], markers })).toThrow();
    expect(() => planReplies({ comments, items: [{ ...item, sections: { ...item.sections, questionPlain: 7 } }], markers })).toThrow();
    expect(() => planReplies({ comments, items: [{ ...item, id: null }], markers })).toThrow();
    expect(() => planReplies({ comments: [...comments, { ...reply('1: no'), id: '9' }], items: [item], markers })).toThrow();
    expect(() => planReplies({ comments: [...comments, { ...reply('1: no'), user: { login: null } }], items: [item], markers })).toThrow();
  });
});

describe('formatRoundComment', () => {
  it('re-asks every question in number order, each with its reply line', () => {
    const body = formatRoundComment({
      round: 3,
      questions: [
        { number: 4, rank: 'high', questionPlain: 'Second?', answerText: 'maybe' },
        { number: 2, rank: 'medium', questionPlain: 'First?', answerText: 'hmm' },
      ],
      markers,
    });
    expect(body.split('\n')[0]).toBe('<!-- vertuo-outbox-round: 3 2,4 -->');
    expect(body.indexOf('**Question 2** · medium')).toBeLessThan(
      body.indexOf('**Question 4** · high'),
    );
    expect(body).toContain('Reply `4: ok` to keep it, or `4: no, because …`');
  });
});

// ---- Options, recommendation and objections ----

/** An item with its options — A is the one built. */
function optionedText(id: string, { rank = 'high', options = ['Keep what was built', 'Change it'] }: OptionedSpec = {}) {
  return [
    '---',
    `id: ${id}`,
    `prd: ${PRD}`,
    `slice: ${id.split('-')[0]}`,
    `rank: ${rank}`,
    'bears-on: none',
    'raised: 2026-09-22',
    'wave: 1',
    '---',
    '',
    '## The question, in plain words',
    '',
    `Is ${id} the right call?`,
    '',
    '## The decision, in plain words',
    '',
    'We kept what was there.',
    '',
    '## The options, in plain words',
    '',
    ...options.map((text, index) => `${'ABCD'[index]}. ${text}`),
    '',
    '## What I had to decide',
    '',
    'x',
    '',
    '## What I did meanwhile',
    '',
    'Kept the default country.',
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

function writeOptioned(root: string, id: string, spec?: OptionedSpec) {
  const dir = join(root, 'docs/outbox', String(PRD));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.md`), optionedText(id, spec));
  return `docs/outbox/${PRD}/${id}.md`;
}

function adopt(root: string, id: string, spec: OptionedSpec = {}) {
  const result = adoptItem({
    ctx: flatCtx(root),
    itemText: optionedText(id, { rank: 'medium', ...spec }),
  });
  if (!result.ok) throw new Error(result.errors.join('; '));
}

function settledText(root: string) {
  return readFileSync(join(root, 'docs/outbox', String(PRD), 'settled.md'), 'utf8');
}

/** Every entry the ledger holds, repeats included — `parseSettledEntries` keeps only the latest. */
function rawEntryCount(root: string) {
  return settledText(root).match(/^<!-- vertuo-outbox-settled: /gm)?.length ?? 0;
}

describe('parseReplyLines — go with recommendation', () => {
  it('reads "go with recommendation" as approve all, whatever its case', () => {
    expect(parseReplyLines('Go with recommendation\nthanks')).toEqual([
      { kind: 'approve-all', text: 'go with recommendation' },
    ]);
    expect(parseReplyLines('go with the recommendation')).toEqual([
      { kind: 'approve-all', text: 'go with recommendation' },
    ]);
  });

  it('does not read it inside a sentence', () => {
    expect(parseReplyLines('I would not go with recommendation here')).toEqual([]);
  });
});

describe('interpretAnswer', () => {
  const options = [
    { letter: 'A', text: 'Hide the cost' },
    { letter: 'B', text: 'Always return it' },
  ];

  it.each([
    ['A', 'agreed', 'A. Hide the cost'],
    ['a', 'agreed', 'A. Hide the cost'],
    ['go with recommendation', 'agreed', 'go with recommendation'],
    ['B', 'drifted', 'B. Always return it'],
    [
      'b because the cost is confidential',
      'drifted',
      'B. Always return it — because the cost is confidential',
    ],
    [
      'B, because the cost is confidential',
      'drifted',
      'B. Always return it — because the cost is confidential',
    ],
    ['B: because it is', 'drifted', 'B. Always return it — because it is'],
  ])('"%s" reads as %s, recorded as "%s"', (text, verdict, recorded) => {
    expect(interpretAnswer({ text, options })).toEqual({ statedVerdict: verdict, recorded });
  });

  it('a letter the question does not offer is not an answer', () => {
    expect(interpretAnswer({ text: 'D', options })).toEqual({ undetermined: true, recorded: 'D' });
  });

  it('a letter on a question with no options is not an answer', () => {
    expect(interpretAnswer({ text: 'B', options: undefined })).toEqual({
      undetermined: true,
      recorded: 'B',
    });
  });

  it('prose is left to the comparison, recorded as written', () => {
    expect(interpretAnswer({ text: 'ok', options })).toEqual({
      statedVerdict: null,
      recorded: 'ok',
    });
    expect(interpretAnswer({ text: 'no, because x', options })).toEqual({
      statedVerdict: null,
      recorded: 'no, because x',
    });
  });
});

describe('readReplies — options and recommendation', () => {
  it('Scenario: Going with the recommendation agrees to every listed question', () => {
    withFixtureRoot((root) => {
      const first = writeOptioned(root, 's1-01-cost');
      const second = writeOptioned(root, 's2-01-order');
      const client = fakeClient([
        prComment(numbering('s1-01-cost', 's2-01-order')),
        reply('go with recommendation'),
      ]);

      const result = readReplies({ ctx: flatCtx(root), prd: PRD, pr: PR }, client);

      expect(result.settled.map((s) => [s.number, s.verdict])).toEqual([
        [1, 'agreed'],
        [2, 'agreed'],
      ]);
      expect(existsSync(join(root, first))).toBe(false);
      expect(existsSync(join(root, second))).toBe(false);
      expect(settledOf(root).map((e) => e.answerText)).toEqual([
        'go with recommendation',
        'go with recommendation',
      ]);
    });
  });

  it('go with recommendation loses to a numbered answer, and covers only questions listed before it', () => {
    withFixtureRoot((root) => {
      writeOptioned(root, 's1-01-cost');
      writeOptioned(root, 's2-01-order');
      writeOptioned(root, 's3-01-late');
      const list = [
        { number: 1, id: 's1-01-cost', since: EARLY },
        { number: 2, id: 's2-01-order', since: EARLY },
        { number: 3, id: 's3-01-late', since: '2026-09-23T11:00:00.000Z' },
      ];
      const client = fakeClient([
        prComment(list),
        reply('2: B because we sort by name', { at: '2026-09-23T09:00:00Z' }),
        reply('go with recommendation', { at: '2026-09-23T10:00:00Z' }),
      ]);

      const result = readReplies({ ctx: flatCtx(root), prd: PRD, pr: PR }, client);

      expect(result.settled.map((s) => [s.number, s.verdict])).toEqual([
        [1, 'agreed'],
        [2, 'drifted'],
      ]);
      expect(existsSync(join(root, 'docs/outbox/1071/s3-01-late.md'))).toBe(true);
    });
  });

  it('"<n>: A" and "<n>: go with recommendation" agree to that question', () => {
    withFixtureRoot((root) => {
      writeOptioned(root, 's1-01-cost', { options: ['Hide the cost', 'Always return it'] });
      writeOptioned(root, 's2-01-order');
      const client = fakeClient([
        prComment(numbering('s1-01-cost', 's2-01-order')),
        reply('1: a\n2: go with recommendation'),
      ]);

      const result = readReplies({ ctx: flatCtx(root), prd: PRD, pr: PR }, client);

      expect(result.settled.map((s) => [s.number, s.verdict])).toEqual([
        [1, 'agreed'],
        [2, 'agreed'],
      ]);
      expect(settledOf(root).map((e) => e.answerText)).toEqual([
        'A. Hide the cost',
        'go with recommendation',
      ]);
    });
  });

  it('Scenario: Choosing another option sends the question back for rework', () => {
    withFixtureRoot((root) => {
      writeOptioned(root, 's1-01-scopes');
      writeOptioned(root, 's2-01-cost', {
        options: ['Hide the cost unless the user may see prices', 'Always return it'],
      });
      const client = fakeClient([
        prComment(numbering('s1-01-scopes', 's2-01-cost')),
        reply('2: B because the cost is confidential'),
      ]);

      const result = readReplies({ ctx: flatCtx(root), prd: PRD, pr: PR }, client);

      expect(result.settled.map((s) => [s.number, s.verdict])).toEqual([[2, 'drifted']]);
      const [entry] = settledOf(root);
      assertDefined(entry, 'the entry');
      expect(entry.id).toBe('s2-01-cost');
      expect(entry.verdict).toBe('drifted');
      expect(entry.answerText).toBe('B. Always return it — because the cost is confidential');
    });
  });

  it('a letter the question does not offer settles nothing and is asked again in a round', () => {
    withFixtureRoot((root) => {
      const file = writeOptioned(root, 's1-01-cost');
      const client = fakeClient([prComment(numbering('s1-01-cost')), reply('1: D')]);

      const result = readReplies({ ctx: flatCtx(root), prd: PRD, pr: PR }, client);

      expect(result.settled).toEqual([]);
      expect(existsSync(join(root, file))).toBe(true);
      expect(result.held.map((h) => [h.number, h.answer, h.due])).toEqual([[1, 'D', true]]);
      assertDefined(result.round, 'the round');
      expect(result.round.body.split('\n')[0]).toBe('<!-- vertuo-outbox-round: 2 1 -->');
    });
  });
});

describe('readReplies — an adopted item', () => {
  it('Scenario: An objection reopens an adopted item', () => {
    withFixtureRoot((root) => {
      writeOptioned(root, 's1-01-cost');
      writeOptioned(root, 's2-01-order');
      adopt(root, 's3-01-components', {
        options: ['None, and it says so', 'All of them, costs hidden'],
      });
      const before = settledText(root);
      const client = fakeClient([
        prComment(numbering('s1-01-cost', 's2-01-order', 's3-01-components')),
        reply('3: B because we need all of them'),
      ]);

      const result = readReplies({ ctx: flatCtx(root), prd: PRD, pr: PR }, client);

      expect(result.settled.map((s) => [s.number, s.id, s.verdict])).toEqual([
        [3, 's3-01-components', 'drifted'],
      ]);
      // Append-only: the adopted entry is untouched, and a drifted one follows it.
      const after = settledText(root);
      expect(after.startsWith(before)).toBe(true);
      expect(rawEntryCount(root)).toBe(2);
      const [entry] = settledOf(root);
      assertDefined(entry, 'the entry');
      expect(entry.verdict).toBe('drifted');
      expect(entry.closed).toBe(false);
      expect(entry.answerText).toBe('B. All of them, costs hidden — because we need all of them');
      expect(entry.fields['Approved by']).toBe('pierre');
      expect(entry.fields.Channel).toMatch(/feature pull request #1080/);
      expect(entry.itemText).toBe(
        optionedText('s3-01-components', {
          rank: 'medium',
          options: ['None, and it says so', 'All of them, costs hidden'],
        }),
      );

      // Re-running reads the same reply again and appends nothing.
      readReplies({ ctx: flatCtx(root), prd: PRD, pr: PR }, client);
      expect(rawEntryCount(root)).toBe(2);
    });
  });

  it.each([['3: A'], ['3: go with recommendation'], ['go with recommendation'], ['approve all']])(
    '"%s" on an adopted question changes nothing',
    (body) => {
      withFixtureRoot((root) => {
        writeOptioned(root, 's1-01-cost');
        writeOptioned(root, 's2-01-order');
        adopt(root, 's3-01-components');
        const before = settledText(root);
        const client = fakeClient([
          prComment(numbering('s1-01-cost', 's2-01-order', 's3-01-components')),
          reply(body),
        ]);

        const result = readReplies({ ctx: flatCtx(root), prd: PRD, pr: PR }, client);

        expect(result.settled.filter((s) => s.id === 's3-01-components')).toEqual([]);
        expect(result.round).toBeNull();
        const after = settledText(root);
        expect(after.slice(0, before.length)).toBe(before);
        expect(settledOf(root).find((e) => e.id === 's3-01-components')?.verdict).toBe('adopted');
      });
    },
  );

  it('an unoffered letter on an adopted question is asked again, and appends nothing', () => {
    withFixtureRoot((root) => {
      adopt(root, 's3-01-components');
      const client = fakeClient([prComment(numbering('s3-01-components')), reply('1: D')]);

      const result = readReplies({ ctx: flatCtx(root), prd: PRD, pr: PR }, client);

      expect(result.settled).toEqual([]);
      expect(rawEntryCount(root)).toBe(1);
      expect(result.held.map((h) => [h.number, h.due])).toEqual([[1, true]]);
      assertDefined(result.round, 'the round');
      expect(result.round.body).toContain('**Question 1** · medium');
    });
  });
});
