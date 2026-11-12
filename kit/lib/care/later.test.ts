// PRD 2739, s3: what a `later` care reply leaves behind — the review point, the person's comment word
// for word, and the high item a person answers.
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readFollowUps } from '../follow-ups/follow-ups.ts';
import { parsePrd } from '../ids.ts';
import { plainWordsProblems } from '../outbox/outbox.ts';
import { askedComment, planReviewPoint, postponeItem, postponeItemId, readPostponed, replyFirstWords, reviewSource, writeReviewPoint } from './later.ts';

const ASKED = 'Please rename `fooBar` — it reads like a typo.\nAnd keep the old name as an alias, for now!';
const NOTE = 'Low value for this PR: naming preference. Happy to take it as a follow-up.';
const URL = 'https://github.com/acme/widgets/pull/9#discussion_r9';

describe('askedComment', () => {
  it("is the thread's first comment that carries no care marker", () => {
    const comments = [
      { body: 'Earlier reply.\n\n<!-- omni-care: asked -->' },
      { body: ASKED },
      { body: 'A second remark.' },
    ];
    expect(askedComment(comments)).toBe(comments[1]);
  });

  it('is null when every comment is a care reply', () => {
    expect(askedComment([{ body: 'Done.\n\n<!-- omni-care: fixed -->' }])).toBeNull();
    expect(askedComment([])).toBeNull();
  });
});

describe('reviewSource', () => {
  it('is PRD #<n> · <thread url>', () => {
    expect(reviewSource(parsePrd(7), URL)).toBe(`PRD #7 · ${URL}`);
  });
});

describe('planReviewPoint and writeReviewPoint', () => {
  const dir = () => join(mkdtempSync(join(tmpdir(), 'later-')), 'follow-ups');
  const write = (folder: string, input: { source: string; date: string; asked: string; note: string }) => {
    const point = planReviewPoint(folder, input);
    writeReviewPoint(point);
    return point;
  };
  const INPUT = { source: reviewSource(parsePrd(7), URL), date: '2026-11-12', asked: ASKED, note: NOTE };

  it("keeps the person's comment byte for byte under Asked, and the agent's words apart under Agent's note", () => {
    const folder = dir();
    const { file } = write(folder, INPUT);
    expect(file).toBe(join(folder, '2026-11-12-please-rename-foobar-it-reads-like.md'));
    const text = readFileSync(file, 'utf8');
    expect(text).toBe(`---\nsource: PRD #7 · ${URL}\ndate: 2026-11-12\n---\n\n## Asked\n\n${ASKED}\n\n## Agent's note\n\n${NOTE}\n`);
  });

  it('writes nothing until asked to', () => {
    const folder = dir();
    planReviewPoint(folder, INPUT);
    expect(existsSync(folder)).toBe(false);
  });

  it('reads back as a follow-up of the folder, its source intact', () => {
    const folder = dir();
    write(folder, INPUT);
    const [point] = readFollowUps(folder);
    expect(point?.source).toBe(`PRD #7 · ${URL}`);
    expect(point?.text.startsWith('## Asked')).toBe(true);
  });

  it('reuses the same point planned twice, and never overwrites another', () => {
    const folder = dir();
    const first = write(folder, INPUT);
    expect(planReviewPoint(folder, INPUT)).toEqual({ file: first.file, text: null });
    const other = write(folder, { ...INPUT, note: 'Another reason.' });
    expect(other.file).toBe(join(folder, '2026-11-12-please-rename-foobar-it-reads-like-2.md'));
    expect(readdirSync(folder)).toHaveLength(2);
  });

  it('names a point whose comment has no word', () => {
    expect(planReviewPoint(dir(), { ...INPUT, asked: '👍' }).file).toMatch(/2026-11-12-review-point\.md$/);
  });
});

describe('postponeItemId', () => {
  it('takes the smallest number its slice has not spent, whatever the slug', () => {
    expect(postponeItemId(new Set(), 'postpone-x')).toBe('care-s0-01-postpone-x');
    expect(postponeItemId(new Set(['care-s0-01-postpone-a', 's1-02-b', 'care-s0-03-c']), 'postpone-x')).toBe('care-s0-02-postpone-x');
  });

  it('refuses once every number is spent', () => {
    const spent = new Set(Array.from({ length: 99 }, (_, n) => `care-s0-${String(n + 1).padStart(2, '0')}-a`));
    expect(() => postponeItemId(spent, 'x')).toThrow(/every item number/);
  });
});

describe('replyFirstWords', () => {
  it("is a reply's first eight words, its marker dropped", () => {
    expect(replyFirstWords(`${NOTE}\n\n<!-- omni-care: later -->`)).toBe('Low value for this PR: naming preference. Happy…');
    expect(replyFirstWords('Later.\n\n<!-- omni-care: later -->')).toBe('Later.');
  });
});

describe('postponeItem', () => {
  const item = postponeItem({ threadId: 'PRRT_1', url: URL, followUp: '.omni-loop/delivery/follow-ups/2026-11-12-x.md', asked: ASKED, note: NOTE });

  it('asks a person to agree, in plain words', () => {
    expect(item.questionPlain).toContain('Postpone this to a follow-up, or fix it in this PRD?');
    for (const field of [item.questionPlain, item.decisionPlain, item.introFun, item.punchlineFun]) expect(plainWordsProblems(field)).toEqual([]);
    expect(item.options).toHaveLength(2);
  });

  it('names the thread, its url, the follow-up file, the comment word for word and why', () => {
    expect(item.decide).toContain('PRRT_1');
    expect(item.decide).toContain(URL);
    expect(item.decide).toContain('.omni-loop/delivery/follow-ups/2026-11-12-x.md');
    expect(item.decide).toContain('> Please rename `fooBar` — it reads like a typo.\n> And keep the old name as an alias, for now!');
    expect(item.decide).toContain(`> ${NOTE}`);
  });

  it('takes its slug from the follow-up file', () => {
    expect(item.slug).toBe('postpone-x');
  });
});

describe('readPostponed', () => {
  const item = postponeItem({ threadId: 'PRRT_1', url: URL, followUp: '.omni-loop/delivery/follow-ups/2026-11-12-x.md', asked: ASKED, note: `${NOTE}\n\nSecond paragraph.` });

  it("reads back the thread's url and the agent's note from the item it wrote", () => {
    expect(readPostponed(`## What I had to decide\n\n${item.decide}\n\n## What I did meanwhile\n`)).toEqual({ url: URL, note: `${NOTE}\n\nSecond paragraph.` });
  });

  it('is null for an item no later reply wrote', () => {
    expect(readPostponed('## What I had to decide\n\nThread `T1`: https://example.com mentioned in passing.\n')).toBeNull();
  });
});
