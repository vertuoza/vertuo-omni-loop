import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parseOutboxItemId, parseProductPrdId } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { QuestionsPort } from './questions.client';
import type { QuestionView } from './questions.contract';
import { EMPTY_QUESTIONS, QuestionRow, QuestionsList } from './QuestionsList';
import {
  demoQuestionsPort, initialQuestionsForm, questionKey, questionsReducer, sendAnswer, stateOf, type QuestionsAction, type QuestionsForm,
} from './questions-model';

// The Questions tab in the browser (PRD 1548 s9, acceptance 9): each open question with its PRD, its
// repository and who it is for, its options as buttons and an "other" answer; picking one sends it and the
// row shows `settled`; a refusal stays under the question in the route's words, and the question stays
// open; one answer is sent at a time; a repository PRD's question links to its Outbox tab.

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const Q: QuestionView = {
  dossier: 'd-m12', prdHref: '/prd/d-m12', outboxHref: '/prd/d-m12?tab=outbox', prdLabel: 'mobile-12', title: 'Quotes on the phone',
  repo: 'vertuoza/vertuo-api', id: 's2-01-quote-totals', rank: 'high', question: 'Quote totals: round per line or on the total?', forWhom: 'for irisa',
  options: [{ letter: 'A', text: 'Per line (built).' }, { letter: 'B', text: 'On the total.' }], answerOn: 'mobile-12',
};
const REPO_Q: QuestionView = {
  ...Q, dossier: 'd-912', prdHref: '/prd/d-912', outboxHref: '/prd/d-912?tab=outbox', prdLabel: '912', repo: 'acme/widgets', id: 's2-01', options: [], answerOn: null,
};
const KEY = questionKey(Q);

const row = (form: QuestionsForm, q: QuestionView = Q) =>
  renderToStaticMarkup(createElement(QuestionRow, { q, state: q.answerOn === null ? null : stateOf(form, questionKey(q)), busy: form.busy !== null }));

/** Runs `sendAnswer` and folds what it dispatches into the form. */
async function answer(port: QuestionsPort, form: QuestionsForm, letter: string): Promise<{ form: QuestionsForm; actions: QuestionsAction[] }> {
  const actions: QuestionsAction[] = [];
  await sendAnswer(port, Q, letter, (a) => { actions.push(a); });
  return { form: actions.reduce(questionsReducer, form), actions };
}

describe('a question on the Questions tab', () => {
  it('shows its PRD, its question, its repository, its id and who it is for, its options as buttons and "other…"', () => {
    const html = row(initialQuestionsForm([Q]));
    expect(text(html)).toBe('mobile-12 Quote totals: round per line or on the total? vertuoza/vertuo-api s2-01-quote-totals for irisa Quotes on the phone A · Per line (built). B · On the total. other… high');
    expect([...html.matchAll(/<button type="button"[^>]*>/g)]).toHaveLength(3);
    expect(html).toContain('role="group" aria-label="Answer s2-01-quote-totals"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('href="/prd/d-m12"');
  });

  it('opens the answer of one\'s own, and sends it only once it has words', () => {
    const open = questionsReducer(initialQuestionsForm([Q]), { type: 'write', key: KEY });
    expect(row(open)).toContain('aria-expanded="true"');
    expect(row(open)).toMatch(/<button type="submit" class="ask-button" disabled="">Send<\/button>/);
    const typed = questionsReducer(open, { type: 'type', key: KEY, text: 'Yes, keep it' });
    expect(row(typed)).toMatch(/<textarea[^>]*>Yes, keep it<\/textarea>/);
    expect(row(typed)).toMatch(/<button type="submit" class="ask-button">Send<\/button>/);
  });

  it('settles on an answer: the row shows settled, what was sent and its verdict, and no button', async () => {
    const port: QuestionsPort = { answer: (r) => Promise.resolve({ ok: true, reply: { prdId: r.prdId, item: r.item, verdict: 'drifted', settledAt: '2026-10-11T11:00:00Z' } }) };
    const { form, actions } = await answer(port, initialQuestionsForm([Q]), 'B');
    expect(actions).toEqual([{ type: 'send', key: KEY, answer: 'B' }, { type: 'settled', key: KEY, verdict: 'drifted' }]);
    const html = row(form);
    expect(html).toContain('data-state="settled"');
    expect(text(html)).toContain('Settled · changes what was built — B');
    expect(text(html).endsWith('settled')).toBe(true);
    expect(html).not.toContain('<button');
  });

  it('keeps a refused question open, with the route\'s words under it', async () => {
    const port: QuestionsPort = { answer: () => Promise.resolve({ ok: false, message: 'No PRD mobile-12 in your workspaces.' }) };
    const { form } = await answer(port, initialQuestionsForm([Q]), 'A');
    expect(stateOf(form, KEY)).toMatchObject({ status: 'open', refusal: 'No PRD mobile-12 in your workspaces.', sent: null });
    expect(row(form)).toContain('<p class="questions-refusal" role="alert">No PRD mobile-12 in your workspaces.</p>');
    const thrown = await answer({ answer: () => Promise.reject(new Error('boom')) }, initialQuestionsForm([Q]), 'A');
    expect(stateOf(thrown.form, KEY).refusal).toBe('The answer was not saved. Try again.');
  });

  it('sends one answer at a time, locking every button while it is sent, and never changes a settled question', () => {
    const other = { ...Q, id: 's3-02-vat', question: 'VAT?' };
    const sending = questionsReducer(initialQuestionsForm([Q, other]), { type: 'send', key: KEY, answer: 'A' });
    expect(questionsReducer(sending, { type: 'send', key: questionKey(other), answer: 'A' })).toBe(sending);
    expect(row(sending, other)).toMatch(/<button[^>]*disabled=""[^>]*><b>A<\/b>/);
    expect(row(sending)).toContain('data-sent="true"');
    const settled = questionsReducer(sending, { type: 'settled', key: KEY, verdict: 'agreed' });
    expect(settled.busy).toBeNull();
    expect(questionsReducer(settled, { type: 'refused', key: KEY, message: 'late' })).toBe(settled);
    expect(questionsReducer(settled, { type: 'write', key: KEY })).toBe(settled);
  });

  it('links a repository PRD\'s question to its Outbox tab, with nothing to send here', async () => {
    const html = row(initialQuestionsForm([REPO_Q]), REPO_Q);
    expect(html).toContain('<a class="questions-elsewhere" href="/prd/d-912?tab=outbox">Answer on its Outbox tab →</a>');
    expect(html).not.toContain('<button');
    expect(initialQuestionsForm([REPO_Q]).byKey).toEqual({});
    const actions: QuestionsAction[] = [];
    await sendAnswer(demoQuestionsPort(), REPO_Q, 'A', (a) => { actions.push(a); });
    expect(actions).toEqual([]);
  });

  it('settles in memory in the demo: A agrees, anything else drifts', async () => {
    const port = demoQuestionsPort();
    expect(await port.answer({ prdId: parseProductPrdId('mobile-12'), item: parseOutboxItemId(Q.id), answer: 'a' })).toMatchObject({ ok: true, reply: { verdict: 'agreed' } });
    expect(await port.answer({ prdId: parseProductPrdId('mobile-12'), item: parseOutboxItemId(Q.id), answer: 'Change it' })).toMatchObject({ ok: true, reply: { verdict: 'drifted' } });
  });
});

describe('the Questions tab', () => {
  it('lists every question, and says so when none waits', () => {
    const html = renderToStaticMarkup(createElement(QuestionsList, { label: 'Mobile\'s questions', questions: [Q, REPO_Q], demo: true }));
    expect(html).toContain('aria-label="Mobile&#x27;s questions"');
    expect([...html.matchAll(/data-row="question"/g)]).toHaveLength(2);
    expect(renderToStaticMarkup(createElement(QuestionsList, { label: 'x', questions: [], demo: false }))).toBe(`<p class="products-empty">${EMPTY_QUESTIONS}</p>`);
  });
});
