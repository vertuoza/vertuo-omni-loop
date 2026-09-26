import { describe, it, expect } from 'vitest';
import { readQuestions, shownLabel } from '../answer-model';
import { DEMO_MEMBERS, DEMO_OWNER, demoPort, demoState, readScenario } from './demo';
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

  it('shares a round with a teammate, never with its owner or a stranger (PRD 144)', async () => {
    const port = demoPort(demoState('any', 'open', NOW), () => NOW);
    const teammate = DEMO_MEMBERS.find((m) => m.user_id !== DEMO_OWNER)!.user_id;
    expect(await port.share('demo-round-3', teammate)).toBe(true);
    expect(await port.share('demo-round-3', DEMO_OWNER)).toBe(false);
    expect(await port.share('demo-round-3', 'stranger')).toBe(false);
    expect(await port.share('no-such-round', teammate)).toBe(false);
  });
});
