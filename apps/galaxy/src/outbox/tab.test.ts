import { describe, expect, it } from 'vitest';
import { itemText, outboxRow, STORED } from './fixtures';
import { openCount, outboxView, type OutboxShown, type QuestionCard } from './tab';

// The Outbox tab's view (PRD 251, "The Outbox tab"), as a pure function of the stored outbox the viewer
// may read: each state of the spec's table, and each card as the tab shows it.

const shown = (read: Parameters<typeof outboxView>[0]) => {
  const view = outboxView(read);
  if (view.state === 'none' || view.state === 'failed') throw new Error(`no outbox: ${view.state}`);
  return view as OutboxShown;
};
const card = (cards: QuestionCard[], number: number) => {
  const found = cards.find((c) => c.number === number);
  if (!found) throw new Error(`no card ${number}`);
  return found;
};

describe('the states', () => {
  it('no outbox stored', () => {
    expect(outboxView({ row: null })).toEqual({ state: 'none' });
    expect(openCount({ row: null })).toBe(0);
  });

  it('the read failed', () => {
    expect(outboxView({ failed: true })).toEqual({ state: 'failed' });
    expect(openCount({ failed: true })).toBe(0);
  });

  it('a stored outbox that no longer parses reads as failed, never as empty', () => {
    expect(outboxView({ row: outboxRow({ outbox: { open: 'nope' } }) })).toEqual({ state: 'failed' });
  });

  it('open: n open, not read-only', () => {
    const view = shown({ row: outboxRow() });
    expect(view.state).toBe('open');
    expect(view.readOnly).toBe(false);
    expect(view.note).toBeNull();
    expect(view.openCount).toBe(2);
    expect(openCount({ row: outboxRow() })).toBe(2);
    expect(view.pr).toEqual({ number: 12, url: 'https://github.com/acme/widgets/pull/12' });
  });

  it('nothing open', () => {
    const view = shown({ row: outboxRow({ outbox: { ...STORED, open: [], pending: [] } }) });
    expect(view.openCount).toBe(0);
    expect(view.open).toEqual([]);
    expect(view.adopted).toHaveLength(1);
    expect(view.settled).toHaveLength(1);
  });

  it('merged or closed: read-only, with the date, and no open count', () => {
    const merged = shown({ row: outboxRow({ state: 'merged', evaluated_at: '2026-09-28T08:00:00Z' }) });
    expect(merged.readOnly).toBe(true);
    expect(merged.note).toBe('The feature pull request merged on 28 Sep 2026: what was still open was adopted.');
    expect(openCount({ row: outboxRow({ state: 'merged' }) })).toBe(0);
    const closed = shown({ row: outboxRow({ state: 'closed', evaluated_at: '2026-09-28T08:00:00Z' }) });
    expect(closed.note).toBe('The feature pull request closed on 28 Sep 2026: what was still open was adopted.');
  });
});

describe('the cards', () => {
  const view = shown({ row: outboxRow() });

  it('lists the human action first, then the decisions, by number', () => {
    expect(view.open.map((c) => [c.number, c.kind])).toEqual([[1, 'action'], [2, 'decision']]);
  });

  it('a decision card: rank, intro and punchline, the question and the decision rendered, its options with A built and recommended', () => {
    const colour = card(view.open, 2);
    expect(colour).toMatchObject({ id: 's1-01-colour', rank: 'high', intro: 'The intro of s1-01-colour.', punchline: 'The punchline of s1-01-colour.' });
    expect(colour.question).toContain('<strong>late</strong>');
    expect(colour.decision).toContain('Red, like every warning.');
    expect(colour.options.map((o) => [o.letter, o.built])).toEqual([['A', true], ['B', false], ['C', false]]);
    expect(colour.options[1].html).toContain('Orange, softer.');
  });

  it('its bears-on entries as chips linking to /knowledge, and none for none', () => {
    expect(card(view.open, 2).bearsOn).toEqual([
      { id: 'P-PRODUCT-3', href: '/knowledge?entry=P-PRODUCT-3' },
      { id: 'ADR-0004', href: '/knowledge?entry=ADR-0004' },
    ]);
    expect(card(view.open, 1).bearsOn).toEqual([]);
  });

  it('its details, in the order the kit writes them', () => {
    expect(card(view.open, 2).details.map((d) => d.label)).toEqual([
      'What I had to decide', 'What I did meanwhile', 'What it costs to change later', 'What I could not know',
    ]);
    expect(card(view.open, 2).details[0].html).toContain('What s1-01-colour had to decide.');
  });

  it('a human-action card: its steps, and no letter to pick', () => {
    const secret = card(view.open, 1);
    expect(secret.kind).toBe('action');
    expect(secret.options).toEqual([]);
    expect(secret.steps).toContain('<code>OMNI_OUTBOX_SECRET</code>');
  });

  it('an answered card: what it said, who, where and when', () => {
    expect(card(view.open, 2).pending).toEqual({
      text: 'B because red frightens people', by: 'ada', where: 'on GitHub', when: '27 Sep 2026, 09:30 UTC',
      url: 'https://github.com/acme/widgets/pull/12#issuecomment-5',
    });
    expect(card(view.open, 1).pending).toBeNull();
  });

  it('names the door an answer came through', () => {
    const through = (via: 'page' | 'terminal' | 'github') => shown({
      row: outboxRow({ outbox: { ...STORED, pending: [{ ...STORED.pending[0], via }] } }),
    }).open.find((c) => c.number === 2)?.pending?.where;
    expect(through('page')).toBe('on the Omni page');
    expect(through('terminal')).toBe('in the terminal');
    expect(through('github')).toBe('on GitHub');
  });

  it('an adopted medium: a decision card, marked adopted, with its options to object with', () => {
    const [size] = view.adopted;
    expect(size).toMatchObject({ number: 3, id: 's1-02-size', kind: 'decision', adopted: true, intro: null, punchline: null });
    expect(size.options.map((o) => o.letter)).toEqual(['A', 'B']);
  });

  it('a settled entry: its verdict, who approved it, when, and its answer', () => {
    expect(view.settled).toEqual([{
      number: null, id: 's1-00-name', verdict: 'agreed', by: 'ada', at: '26 Sep 2026', answer: 'A. Keep it.',
      url: 'https://github.com/acme/widgets/pull/12#issuecomment-2',
    }]);
  });

  it('raw HTML in an item shows as text', () => {
    const view = shown({
      row: outboxRow({
        outbox: { ...STORED, open: [{ number: 2, id: 's1-01-colour', rank: 'high', text: itemText({ id: 's1-01-colour', rank: 'high', question: 'Is <script>alert(1)</script> fine?' }) }] },
      }),
    });
    expect(view.open[0].question).toContain('&lt;script&gt;');
    expect(view.open[0].question).not.toContain('<script>');
  });

  it('an item the kit cannot read still shows, as its text, with nothing to pick', () => {
    const view = shown({ row: outboxRow({ outbox: { ...STORED, open: [{ number: 2, id: 's1-01-colour', rank: 'high', text: 'Just **words**.' }] } }) });
    expect(view.open[0]).toMatchObject({ number: 2, kind: 'decision', options: [], question: null });
    expect(view.open[0].raw).toContain('<strong>words</strong>');
  });
});

describe('the answers just sent from this page (PRD 251, Send, step 5)', () => {
  const sent = (at: string) => ({
    state: 'posted' as const, login: 'bob', url: 'https://github.com/acme/widgets/pull/12#issuecomment-99', counted: true,
    next: '/omni:yolo-fix 7', reply: '1: ok\n3: B because too big\n\n_answered on the Omni page · PRD 7_', at,
  });

  it('show as pending at once, as sent from the Omni page, until the next outbox arrives', () => {
    const view = outboxView({ row: outboxRow() }, sent('2026-09-27T10:06:00Z')) as OutboxShown;
    expect(card(view.open, 1).pending).toEqual({
      text: 'ok', by: 'bob', where: 'on the Omni page', when: '27 Sep 2026, 10:06 UTC', url: 'https://github.com/acme/widgets/pull/12#issuecomment-99',
    });
    expect(card(view.adopted, 3).pending).toMatchObject({ text: 'B because too big', by: 'bob' });
    expect(card(view.open, 2).pending).toMatchObject({ by: 'ada' });
  });

  it('give way to an outbox evaluated after them', () => {
    const view = outboxView({ row: outboxRow({ evaluated_at: '2026-09-27T10:07:00Z' }) }, sent('2026-09-27T10:06:00Z')) as OutboxShown;
    expect(card(view.open, 1).pending).toBeNull();
  });

  it('nothing for a send that failed or waits', () => {
    const view = outboxView({ row: outboxRow() }, { state: 'failed', error: 'x' }) as OutboxShown;
    expect(card(view.open, 1).pending).toBeNull();
  });
});
