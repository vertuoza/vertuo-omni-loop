import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AgentQuestion } from './model';
import { questionsOf } from './model';
import { databaseQuestions, demoQuestions } from './port';
import { BRING_BACK, NO_QUESTIONS, QuestionsCard, setAsideLabel } from './QuestionsCard';
import { initialQuestionsState, questionsReducer } from './state';

// Jev set aside (PRD 855 s4): a question Jev's Unknown worth asking set aside is folded under "Jev set
// aside N" at the bottom of the card, with Bring back, which reopens it through
// agent_question_bring_back(); the open ones are listed as before. At 393 px and in the demo too.

const question = (id: string, over: Partial<AgentQuestion> = {}): AgentQuestion => ({
  id, question: `Question ${id}?`, asked: 1, askedBy: 'Tom’s editor', repo: 'acme/app', file: null,
  firstAskedAt: '2026-09-30T08:00:00Z', lastAskedAt: '2026-10-01T09:00:00Z', product: 'p-1', ...over,
});
const OPEN = question('open');
const SKY = question('sky', { question: 'Is the sky blue?', setAside: true });
const TEST = question('test', { question: 'test test', setAside: true });

const render = (questions: AgentQuestion[], demo = false) =>
  renderToStaticMarkup(createElement(QuestionsCard, { state: initialQuestionsState(questions), products: [], demo }));

describe('set aside by Jev', () => {
  it('reads `setAside` from the database, and a list without it as open', () => {
    expect(questionsOf([SKY])?.[0]!.setAside).toBe(true);
    expect(questionsOf([OPEN])?.[0]!.setAside).toBeUndefined();
  });

  it('folds the set-aside questions under "Jev set aside N", each with Bring back, below the open ones', () => {
    const html = render([SKY, OPEN, TEST]);
    expect(setAsideLabel(2)).toBe('Jev set aside 2');
    expect(html).toMatch(/<details class="agent-set-aside"><summary>Jev set aside 2<\/summary>/);
    const [openPart, folded] = html.split('agent-set-aside');
    expect(openPart).toContain('Question open?');
    expect(openPart).not.toContain('Is the sky blue?');
    expect(folded).toContain('Is the sky blue?');
    expect(folded).toContain('test test');
    expect(folded!.match(new RegExp(`>${BRING_BACK}<`, 'g'))).toHaveLength(2);
    expect(folded).not.toContain('Answer once');
  });

  it('says no question is waiting when every one is set aside, and draws no fold when none is', () => {
    const html = render([SKY]);
    expect(html).toContain(NO_QUESTIONS);
    expect(html).toContain('Jev set aside 1');
    expect(render([OPEN])).not.toContain('agent-set-aside');
  });

  it('holds at 393 px and shows the demo chip', () => {
    const html = render([SKY, OPEN], true);
    expect(html).toContain('Demo');
    expect(html).not.toMatch(/style="[^"]*width:\s*\d{4}px/);
  });

  it('Bring back reopens the question in the list', () => {
    const state = questionsReducer({ ...initialQuestionsState([SKY, OPEN]), busy: true }, { type: 'brought-back', id: 'sky' });
    expect(state.questions.find((q) => q.id === 'sky')?.setAside).toBe(false);
    expect(state.busy).toBe(false);
    expect(state.done).toMatch(/back/i);
  });

  it('calls agent_question_bring_back as the signed-in person; the demo brings back in memory', async () => {
    const calls: unknown[] = [];
    const db = { rpc: async (fn: string, args: Record<string, unknown>) => (calls.push({ fn, args }), { data: { id: 'sky' }, error: null }) };
    expect(await databaseQuestions(db, 'w-1').bringBack(SKY)).toEqual({ ok: true });
    expect(calls).toEqual([{ fn: 'agent_question_bring_back', args: { p_workspace: 'w-1', p_question: 'sky' } }]);
    const refused = { rpc: async () => ({ data: null, error: { code: 'P0002', message: 'no such set-aside question' } }) };
    expect((await databaseQuestions(refused, 'w-1').bringBack(SKY)).ok).toBe(false);
    expect(await demoQuestions(3).bringBack(SKY)).toEqual({ ok: true });
  });
});
