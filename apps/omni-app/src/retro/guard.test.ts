import { describe, expect, it } from 'vitest';
import { DROPPED, guard as guardProse } from './guard.ts';
import type { DroppedField, GuardSheet } from './guard.ts';
import { FIELD_CAPS } from './rules.ts';

/** A reply as the tests bend it: any field, of any type. */
type Reply = Record<string, any>;

/** `guard`, its prose read as the tests read it: every field open to look at. */
const guard = ({ reply, sheet }: { reply: unknown; sheet: unknown }) =>
  guardProse({ reply, sheet: sheet as GuardSheet }) as { prose: Reply; dropped: DroppedField[] };

const RUN_7001 = 'https://github.com/acme/widgets/actions/runs/7001';
const RUN_7002 = 'https://github.com/acme/widgets/actions/runs/7002';
const PR_15 = 'https://github.com/acme/widgets/pull/15';

/** A fact sheet as `detect` makes it: two findings, their evidence, one with a log excerpt. */
const sheet = {
  run: 'merge',
  prd: { number: 7, title: 'Widgets that remember their colour' },
  findings: [
    {
      ref: 'F1',
      id: 'repeated-red:e2e',
      kind: 'repeated-red',
      source: 'ci',
      title: 'The check e2e went red again and again',
      happened: 'The check e2e was red on 4 commits in 2 slices.',
      evidence: [
        { label: 'run 7001', url: RUN_7001, excerpt: 'FAIL test/cart.spec.ts > adds 2 items to the cart' },
        { label: 'run 7002', url: RUN_7002 },
      ],
    },
    {
      ref: 'F2',
      id: 'slow-slice:s3',
      kind: 'slow-slice',
      source: 'timeline',
      title: 'Slice s3 took far longer than the others',
      happened: 'Slice s3 took 120 minutes from its claim to its merge.',
      evidence: [{ label: '#15', url: PR_15 }],
    },
  ],
};

/** A reply the model could give, every field clean. */
const clean = (): Reply => ({
  summary: 'The widgets shipped, but one check kept failing and one slice dragged on.',
  findings: {
    'repeated-red:e2e': {
      title: 'The end-to-end check kept failing',
      whyItMatters: 'Each red run held a slice back and hid whether the change itself was sound.',
      lesson: 'Fix the unsteady step before the next wave starts.',
      keep: true,
      why: 'No earlier lesson asks for the unsteady step to be fixed first.',
    },
    'slow-slice:s3': { title: 'One slice dragged on', whyItMatters: 'The last slice kept the whole feature waiting.', keep: false },
  },
  lessons: [{ text: 'Keep the end-to-end check green between waves.', findings: ['repeated-red:e2e'] }],
  verdict: { worthIt: true, reason: 'One lesson about the end-to-end check is new.' },
});

/** The clean reply with its verdict and its findings' keep and why changed by `edit`. */
function judged(edit: (reply: Reply) => unknown): Reply {
  const reply = clean();
  edit(reply);
  return reply;
}

/** The prose `guard` gives for a verdict it drops: the verdict replaced by its reason, no keep and no why. */
function withoutJudgement(reply: Reply, reason: string): Reply {
  const prose = structuredClone(reply);
  prose.verdict = { dropped: reason };
  for (const words of Object.values<Reply>(prose.findings)) {
    delete words.keep;
    delete words.why;
  }
  return prose;
}

/** The clean reply with one prose field replaced. */
function withTitle(text: unknown, id = 'repeated-red:e2e'): Reply {
  const reply = clean();
  reply.findings[id].title = text;
  return reply;
}

describe('guard — a clean reply', () => {
  it('accepts every field, field by field, and drops nothing', () => {
    const { prose, dropped } = guard({ reply: clean(), sheet });
    expect(prose).toEqual(clean());
    expect(dropped).toEqual([]);
  });

  it('gives no prose, and drops nothing, without a reply', () => {
    expect(guard({ reply: null, sheet })).toEqual({ prose: null, dropped: [] });
  });

  it('never changes the reply it is given', () => {
    const reply = withTitle('Red on 4 commits');
    const before = structuredClone(reply);
    guard({ reply, sheet });
    expect(reply).toEqual(before);
  });
});

describe('guard — a digit', () => {
  it('drops a field holding a digit, and keeps its neighbours', () => {
    const { prose, dropped } = guard({ reply: withTitle('Red on 4 commits'), sheet });
    expect(prose.findings['repeated-red:e2e']).toEqual({
      title: { dropped: DROPPED.digit },
      whyItMatters: clean().findings['repeated-red:e2e'].whyItMatters,
      lesson: clean().findings['repeated-red:e2e'].lesson,
      keep: true,
      why: clean().findings['repeated-red:e2e'].why,
    });
    expect(prose.summary).toBe(clean().summary);
    expect(dropped).toEqual([{ field: 'findings.repeated-red:e2e.title', reason: DROPPED.digit }]);
  });

  it('sets aside a backtick span copied verbatim from the evidence, and a finding id it was given', () => {
    const text = 'The test `test/cart.spec.ts > adds 2 items` failed in `repeated-red:e2e` again.';
    const reply = clean();
    reply.findings['repeated-red:e2e'].whyItMatters = text;
    reply.findings['slow-slice:s3'].whyItMatters = 'The finding `slow-slice:s3` held the merge back.';
    const { prose, dropped } = guard({ reply, sheet });
    expect(dropped).toEqual([]);
    expect(prose.findings['repeated-red:e2e'].whyItMatters).toBe(text);
    expect(prose.findings['slow-slice:s3'].whyItMatters).toBe('The finding `slow-slice:s3` held the merge back.');
  });

  it('drops a backtick span the evidence does not hold, and a bare number in backticks', () => {
    for (const title of ['The test `adds 3 items` failed', 'Run `7001` failed']) {
      const { dropped } = guard({ reply: withTitle(title), sheet });
      expect(dropped).toEqual([{ field: 'findings.repeated-red:e2e.title', reason: DROPPED.digit }]);
    }
  });

  it('sets aside an evidence link it was given, but not the digits around it', () => {
    const kept = guard({ reply: withTitle(`See ${RUN_7001} for the log`), sheet });
    expect(kept.dropped).toEqual([]);
    const refused = guard({ reply: withTitle(`See [run 7001](${RUN_7001})`), sheet });
    expect(refused.dropped).toEqual([{ field: 'findings.repeated-red:e2e.title', reason: DROPPED.digit }]);
  });
});

describe('guard — an id, a link, a length, a word', () => {
  it('drops a field naming a finding the retro did not find', () => {
    const { prose, dropped } = guard({ reply: withTitle('Worse than `churn:src/cart.ts` suggests'), sheet });
    expect(prose.findings['repeated-red:e2e'].title).toEqual({ dropped: DROPPED.unknownFinding });
    expect(dropped).toEqual([{ field: 'findings.repeated-red:e2e.title', reason: DROPPED.unknownFinding }]);
  });

  it('drops the prose of a finding the retro did not find, whatever it says', () => {
    const reply = clean();
    reply.findings['flaky:lint'] = { title: 'Lint wobbled', whyItMatters: 'It wobbled.' };
    const { prose, dropped } = guard({ reply, sheet });
    expect(Object.keys(prose.findings)).toEqual(['repeated-red:e2e', 'slow-slice:s3']);
    expect(dropped).toEqual([{ field: 'findings', reason: DROPPED.unknownFinding }]);
  });

  it('drops a link that is not one of the evidence URLs', () => {
    const { prose, dropped } = guard({ reply: withTitle('See https://example.com/why'), sheet });
    expect(prose.findings['repeated-red:e2e'].title).toEqual({ dropped: DROPPED.foreignLink });
    expect(dropped).toEqual([{ field: 'findings.repeated-red:e2e.title', reason: DROPPED.foreignLink }]);
  });

  it('drops a field longer than its cap in rules', () => {
    const reply = clean();
    reply.summary = 'A'.repeat(FIELD_CAPS.summary + 1);
    reply.findings['repeated-red:e2e'].title = 'A'.repeat(FIELD_CAPS.title + 1);
    reply.findings['repeated-red:e2e'].whyItMatters = 'A'.repeat(FIELD_CAPS.whyItMatters);
    const { prose, dropped } = guard({ reply, sheet });
    expect(prose.summary).toEqual({ dropped: DROPPED.tooLong });
    expect(prose.findings['repeated-red:e2e'].whyItMatters).toBe('A'.repeat(FIELD_CAPS.whyItMatters));
    expect(dropped).toEqual([
      { field: 'summary', reason: DROPPED.tooLong },
      { field: 'findings.repeated-red:e2e.title', reason: DROPPED.tooLong },
    ]);
  });

  it('drops a field holding a word the rules refuse', () => {
    const { prose, dropped } = guard({ reply: withTitle('The team let the check fail'), sheet });
    expect(prose.findings['repeated-red:e2e'].title).toEqual({ dropped: DROPPED.refusedWord });
    expect(dropped).toEqual([{ field: 'findings.repeated-red:e2e.title', reason: DROPPED.refusedWord }]);
  });

  it('drops a field that is not text', () => {
    const { prose, dropped } = guard({ reply: withTitle({ nested: 'object' }), sheet });
    expect(prose.findings['repeated-red:e2e'].title).toEqual({ dropped: DROPPED.notText });
    expect(dropped).toEqual([{ field: 'findings.repeated-red:e2e.title', reason: DROPPED.notText }]);
  });

  it('never repeats the refused words or text in a reason', () => {
    for (const reason of Object.values(DROPPED)) {
      expect(reason).not.toMatch(/\d/);
      expect(reason).toMatch(/^it /);
    }
  });
});

describe('guard — the lessons', () => {
  it('replaces a lesson citing no finding, or one the retro did not find, by one line naming the reason', () => {
    const reply = clean();
    reply.lessons = [
      { text: 'Keep the end-to-end check green between waves.', findings: ['repeated-red:e2e'] },
      { text: 'Plan smaller slices.', findings: [] },
      { text: 'Watch the lint check.', findings: ['flaky:lint', 'slow-slice:s3'] },
      { text: 'Read the log of run 7001 first.', findings: ['repeated-red:e2e'] },
    ];
    const { prose, dropped } = guard({ reply, sheet });
    expect(prose.lessons).toEqual([
      { text: 'Keep the end-to-end check green between waves.', findings: ['repeated-red:e2e'] },
      { text: `_Dropped: ${DROPPED.noFinding}._`, findings: [] },
      { text: `_Dropped: ${DROPPED.unknownFinding}._`, findings: ['slow-slice:s3'] },
      { text: `_Dropped: ${DROPPED.digit}._`, findings: ['repeated-red:e2e'] },
    ]);
    expect(dropped).toEqual([
      { field: 'lessons.1', reason: DROPPED.noFinding },
      { field: 'lessons.2', reason: DROPPED.unknownFinding },
      { field: 'lessons.3', reason: DROPPED.digit },
    ]);
  });

  it('caps a lesson like a finding’s lesson', () => {
    const reply = clean();
    reply.lessons = [{ text: 'A'.repeat(FIELD_CAPS.lesson + 1), findings: ['repeated-red:e2e'] }];
    expect(guard({ reply, sheet }).dropped).toEqual([{ field: 'lessons.0', reason: DROPPED.tooLong }]);
  });
});

describe('guard — the verdict', () => {
  it('keeps a verdict not worth it with no finding kept', () => {
    const reply = judged((r: Reply) => {
      r.verdict = { worthIt: false, reason: 'Both lessons are in the knowledge already.' };
      r.findings['repeated-red:e2e'].keep = false;
    });
    const { prose, dropped } = guard({ reply, sheet });
    expect(prose.verdict).toEqual(reply.verdict);
    expect(prose.findings['repeated-red:e2e'].keep).toBe(false);
    expect(dropped).toEqual([]);
  });

  it('drops a missing verdict: the retro is not judged', () => {
    const reply = judged((r: Reply) => delete r.verdict);
    const { prose, dropped } = guard({ reply, sheet });
    expect(prose).toEqual(withoutJudgement(reply, DROPPED.noVerdict));
    expect(dropped).toEqual([{ field: 'verdict', reason: DROPPED.noVerdict }]);
  });

  it('drops a verdict whose worthIt is not true or false', () => {
    const reply = judged((r: Reply) => (r.verdict.worthIt = 'yes'));
    const { prose, dropped } = guard({ reply, sheet });
    expect(prose.verdict).toEqual({ dropped: DROPPED.notYesOrNo });
    expect(dropped).toEqual([{ field: 'verdict.worthIt', reason: DROPPED.notYesOrNo }]);
  });

  it('drops a verdict worth it that keeps no finding', () => {
    const reply = judged((r: Reply) => (r.findings['repeated-red:e2e'].keep = false));
    const { prose, dropped } = guard({ reply, sheet });
    expect(prose).toEqual(withoutJudgement(reply, DROPPED.nothingKept));
    expect(dropped).toEqual([{ field: 'verdict', reason: DROPPED.nothingKept }]);
  });

  it('drops a verdict worth it whose only kept finding keeps an unknown finding', () => {
    const reply = judged((r: Reply) => {
      r.findings['repeated-red:e2e'].keep = false;
      r.findings['flaky:lint'] = { title: 'Lint wobbled', lesson: 'Watch lint.', keep: true };
    });
    expect(guard({ reply, sheet }).prose.verdict).toEqual({ dropped: DROPPED.nothingKept });
  });

  it('drops a verdict that keeps a finding with no lesson, or a lesson it dropped', () => {
    const none = judged((r: Reply) => (r.findings['slow-slice:s3'].keep = true));
    expect(guard({ reply: none, sheet }).dropped).toEqual([{ field: 'findings.slow-slice:s3.keep', reason: DROPPED.keptNoLesson }]);
    expect(guard({ reply: none, sheet }).prose.verdict).toEqual({ dropped: DROPPED.keptNoLesson });

    const refused = judged((r: Reply) => (r.findings['repeated-red:e2e'].lesson = 'Fix it within 2 days.'));
    const { prose, dropped } = guard({ reply: refused, sheet });
    expect(prose.verdict).toEqual({ dropped: DROPPED.keptNoLesson });
    expect(dropped).toEqual([
      { field: 'findings.repeated-red:e2e.lesson', reason: DROPPED.digit },
      { field: 'findings.repeated-red:e2e.keep', reason: DROPPED.keptNoLesson },
    ]);
  });

  it('drops a verdict whose reason passes its cap, or breaks a rule of the prose', () => {
    const long = judged((r: Reply) => (r.verdict.reason = 'A'.repeat(FIELD_CAPS.reason + 1)));
    expect(guard({ reply: long, sheet }).dropped).toEqual([{ field: 'verdict.reason', reason: DROPPED.tooLong }]);
    expect(guard({ reply: long, sheet }).prose.verdict).toEqual({ dropped: DROPPED.tooLong });
    const atCap = judged((r: Reply) => (r.verdict.reason = 'A'.repeat(FIELD_CAPS.reason)));
    expect(guard({ reply: atCap, sheet }).dropped).toEqual([]);

    const link = judged((r: Reply) => (r.verdict.reason = 'See https://example.com for why.'));
    expect(guard({ reply: link, sheet }).prose.verdict).toEqual({ dropped: DROPPED.foreignLink });
    const notText = judged((r: Reply) => (r.verdict.reason = 4));
    expect(guard({ reply: notText, sheet }).prose.verdict).toEqual({ dropped: DROPPED.notText });
  });

  it('drops the verdict when a why passes its cap, or is not text', () => {
    const long = judged((r: Reply) => (r.findings['repeated-red:e2e'].why = 'A'.repeat(FIELD_CAPS.why + 1)));
    const { prose, dropped } = guard({ reply: long, sheet });
    expect(prose).toEqual(withoutJudgement(long, DROPPED.tooLong));
    expect(dropped).toEqual([{ field: 'findings.repeated-red:e2e.why', reason: DROPPED.tooLong }]);

    const atCap = judged((r: Reply) => (r.findings['repeated-red:e2e'].why = 'A'.repeat(FIELD_CAPS.why)));
    expect(guard({ reply: atCap, sheet }).dropped).toEqual([]);
    const notText = judged((r: Reply) => (r.findings['slow-slice:s3'].why = ['new']));
    expect(guard({ reply: notText, sheet }).prose.verdict).toEqual({ dropped: DROPPED.notText });
  });

  it('keeps a verdict whose reason and whys hold digits, as #500 wrote them', () => {
    const reply = judged((r: Reply) => {
      r.verdict.reason = 'Slices s1 and s2 left their territory, a pattern PRD 400 already showed; nothing new.';
      r.findings['repeated-red:e2e'].why = 'The e2e check went red on 3 commits for a cause no entry names.';
    });
    const { prose, dropped } = guard({ reply, sheet });
    expect(dropped).toEqual([]);
    expect(prose.verdict.reason).toBe(reply.verdict.reason);
    expect(prose.findings['repeated-red:e2e'].why).toBe(reply.findings['repeated-red:e2e'].why);
  });

  it('keeps the other prose when it drops the verdict', () => {
    const reply = judged((r: Reply) => delete r.verdict);
    const { prose } = guard({ reply, sheet });
    expect(prose.summary).toBe(clean().summary);
    expect(prose.lessons).toEqual(clean().lessons);
    expect(prose.findings['repeated-red:e2e'].lesson).toBe(clean().findings['repeated-red:e2e'].lesson);
  });
});
