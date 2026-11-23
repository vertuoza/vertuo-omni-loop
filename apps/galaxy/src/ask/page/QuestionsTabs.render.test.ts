import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WaitingProvider } from '../../waiting/WaitingProvider';
import type { WaitingQuestion } from '../../waiting/waiting';
import { QuestionsTabs } from './QuestionsTabs';
import { item } from '../test/test-item';

// The Questions pages' tab row (PRD 733), as the server renders it inside the app shell's waiting
// provider: Inbox · Shared with me · Outbox · History (PRD 2011 s14), the page's own tab marked, Inbox
// carrying the questions not shared with the person and Shared with me the shared ones, each only
// above 0.

const question = (id: string, sharedBy: string | null = null): WaitingQuestion => ({ kind: 'question', id, sessionTitle: 'feat/x', question: 'Why?', askedAt: 1, sharedBy });
/** Five questions wait: two of the person's own sessions', three shared with them. */
const FIVE = [question('a'), question('b'), question('c', 'Bob'), question('d', 'Bob'), question('e', 'Bob')];

const render = (current: string, questions: WaitingQuestion[] = FIVE) =>
  renderToStaticMarkup(createElement(WaitingProvider, { view: { questions, unread: false, source: null }, children: createElement(QuestionsTabs, { current }) }));

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const links = (html: string) => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
  href: /href="([^"]*)"/.exec(item(m, 1))?.[1],
  current: /aria-current="page"/.test(item(m, 1)),
  text: text(item(m, 2)),
}));

describe('the Questions tabs', () => {
  it('draw the four tabs in a row named Questions', () => {
    const html = render('/app/inbox');
    expect(html).toMatch(/<nav [^>]*class="section-tabs"[^>]*aria-label="Questions"/);
    expect(links(html).map((l) => l.href)).toEqual(['/app/inbox', '/app/inbox?from=shared', '/app/inbox?kind=outbox', '/app/inbox/done']);
  });

  it('mark the page showing', () => {
    expect(links(render('/app/inbox')).map((l) => l.current)).toEqual([true, false, false, false]);
    expect(links(render('/app/inbox?from=shared')).map((l) => l.current)).toEqual([false, true, false, false]);
    expect(links(render('/app/inbox/done')).map((l) => l.current)).toEqual([false, false, false, true])
    expect(links(render('/app/inbox?kind=outbox')).map((l) => l.current)).toEqual([false, false, true, false]);
  });

  it('carry the waiting counts: questions − shared, then shared', () => {
    expect(links(render('/app/inbox')).map((l) => l.text)).toEqual(['Inbox 2', 'Shared with me 3', 'Outbox', 'History']);
  });

  it('show no count at 0', () => {
    expect(links(render('/app/inbox', [])).map((l) => l.text)).toEqual(['Inbox', 'Shared with me', 'Outbox', 'History']);
    expect(links(render('/app/inbox', [question('c', 'Bob')])).map((l) => l.text)).toEqual(['Inbox', 'Shared with me 1', 'Outbox', 'History']);
  });

  it('show the open outbox count on Outbox when the page gives it, only above 0', () => {
    const outbox = (open: number) => links(renderToStaticMarkup(createElement(WaitingProvider, {
      view: { questions: [], unread: false, source: null }, children: createElement(QuestionsTabs, { current: '/app/inbox?kind=outbox', open }),
    }))).map((l) => l.text);
    expect(outbox(4)).toEqual(['Inbox', 'Shared with me', 'Outbox 4', 'History']);
    expect(outbox(0)).toEqual(['Inbox', 'Shared with me', 'Outbox', 'History']);
  });
});
