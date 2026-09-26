import { describe, it, expect } from 'vitest';
import { readQuestions, shownLabel } from '../answer-model';
import { demoPane, demoPort, demoSessions, demoState, readScenario } from './demo';
import { firstTab, needsYou, rowOf, tabsOf } from './tabs';
import { sessionView } from './view';

const NOW = Date.parse('2026-09-26T10:00:00Z');

describe('the demo session', () => {
  it('shows each state the page has, by name', () => {
    expect(readScenario(undefined)).toBe('open');
    expect(readScenario('nonsense')).toBe('open');
    for (const scenario of ['open', 'working', 'moved', 'closed', 'empty'] as const) {
      expect(readScenario(scenario)).toBe(scenario);
      const kind = sessionView(demoState('any', scenario, NOW), NOW).kind;
      expect(kind, scenario).toBe(scenario === 'empty' ? 'working' : scenario);
    }
    expect(sessionView(demoState('any', 'empty', NOW), NOW).history).toEqual([]);
  });

  it('asks with everything a round can carry: a badge, a preview, a multi-select, and a history from both sides', () => {
    const state = demoState('any', 'open', NOW);
    const view = sessionView(state, NOW);
    if (view.kind !== 'open') throw new Error(view.kind);
    const options = view.questions.flatMap((q) => q.options);
    expect(options.some((o) => shownLabel(o.label).recommended)).toBe(true);
    expect(options.some((o) => o.preview)).toBe(true);
    expect(view.questions.some((q) => q.multiSelect)).toBe(true);
    expect(view.history.map((h) => h.via).sort()).toEqual(['page', 'terminal']);
  });

  it('plays three terminals, one needing the person, and /ask opens on that one', () => {
    const tabs = tabsOf(demoSessions('open', NOW).map(rowOf), NOW);
    expect(tabs).toHaveLength(3);
    expect(new Set(tabs.map((t) => t.title)).size).toBe(3);
    expect(tabs.map((t) => t.state)).toEqual(['needs-you', 'working', 'working']);
    expect(demoPane(firstTab(tabs)!, 'open', NOW).session.id).toBe(tabs[0].id);
    expect(sessionView(demoPane(tabs[0].id, 'open', NOW), NOW).kind).toBe('open');
  });

  it("plays a PRD 71 link's session as before, and the other states on the first terminal", () => {
    expect(demoPane('7c1e2a94-0b1d-4c3e-9f00-1234567890ab', 'moved', NOW).session.id).toBe('7c1e2a94-0b1d-4c3e-9f00-1234567890ab');
    const [first] = demoSessions('working', NOW);
    expect(sessionView(first, NOW).kind).toBe('working');
    expect(needsYou(tabsOf(demoSessions('working', NOW).map(rowOf), NOW))).toBe(0);
  });

  it('takes an answer, then asks again a moment later', async () => {
    const clock = { now: NOW };
    const port = demoPort(demoState('any', 'open', NOW), () => clock.now, 4000);
    const open = sessionView((await port.read())!, clock.now);
    if (open.kind !== 'open') throw new Error(open.kind);
    const answers = Object.fromEntries(open.questions.map((q) => [q.question, q.options[0].label]));
    expect(await port.send(open.round.id, answers)).toBe('answered');
    expect(await port.send(open.round.id, answers)).toBe('taken');
    expect(sessionView((await port.read())!, clock.now).kind).toBe('working');
    clock.now += 4000;
    const next = sessionView((await port.read())!, clock.now);
    expect(next.kind).toBe('open');
    if (next.kind === 'open') expect(readQuestions(next.round.questions)).not.toEqual(open.questions);
  });
});
