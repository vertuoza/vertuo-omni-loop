import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WaitingProvider } from '../../waiting/WaitingProvider';
import type { WaitingQuestion } from '../../waiting/waiting';
import { QuestionsTabs } from './QuestionsTabs';

// The Questions pages' tab row (PRD 733), as the server renders it inside the app shell's waiting
// provider: Open questions · Shared with me · History, the page's own tab marked, Open questions
// carrying the questions not shared with the person and Shared with me the shared ones, each only
// above 0.

const question = (id: string, sharedBy: string | null = null): WaitingQuestion => ({ kind: 'question', id, sessionTitle: 'feat/x', question: 'Why?', askedAt: 1, sharedBy });
/** Five questions wait: two of the person's own sessions', three shared with them. */
const FIVE = [question('a'), question('b'), question('c', 'Bob'), question('d', 'Bob'), question('e', 'Bob')];

const render = (current: string, questions: WaitingQuestion[] = FIVE) =>
  renderToStaticMarkup(createElement(WaitingProvider, { view: { questions, unread: false, source: null }, children: createElement(QuestionsTabs, { current }) }));

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const links = (html: string) => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
  href: /href="([^"]*)"/.exec(m[1]!)?.[1],
  current: /aria-current="page"/.test(m[1]!),
  text: text(m[2]!),
}));

describe('the Questions tabs', () => {
  it('draw the three tabs in a row named Questions', () => {
    const html = render('/ask');
    expect(html).toMatch(/<nav [^>]*class="section-tabs"[^>]*aria-label="Questions"/);
    expect(links(html).map((l) => l.href)).toEqual(['/ask', '/ask/for-me', '/ask/history']);
  });

  it('mark the page showing', () => {
    expect(links(render('/ask')).map((l) => l.current)).toEqual([true, false, false]);
    expect(links(render('/ask/for-me')).map((l) => l.current)).toEqual([false, true, false]);
    expect(links(render('/ask/history')).map((l) => l.current)).toEqual([false, false, true]);
  });

  it('carry the waiting counts: questions − shared, then shared', () => {
    expect(links(render('/ask')).map((l) => l.text)).toEqual(['Open questions 2', 'Shared with me 3', 'History']);
  });

  it('show no count at 0', () => {
    expect(links(render('/ask', [])).map((l) => l.text)).toEqual(['Open questions', 'Shared with me', 'History']);
    expect(links(render('/ask', [question('c', 'Bob')])).map((l) => l.text)).toEqual(['Open questions', 'Shared with me 1', 'History']);
  });
});
