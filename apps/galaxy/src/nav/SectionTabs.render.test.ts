import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SectionTabs } from './SectionTabs.tsx';
import { QUESTIONS_TABS, withCounts } from './section-tabs.ts';
import { item } from '../ask/test/test-item';
import { assertDefined } from 'omni-loop/kit/test/assert.ts';

// One row of section tabs (PRD 733): the Open
// questions · Shared with me · History row on the Questions pages, as the server renders them. Each
// tab is a link to its page; the one showing carries aria-current="page"; a count shows only above 0,
// and is spoken with the tab's name.

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const links = (html: string) => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
  attrs: m[1],
  href: /href="([^"]*)"/.exec(item(m, 1))?.[1],
  current: /aria-current="page"/.test(item(m, 1)),
  name: /aria-label="([^"]*)"/.exec(item(m, 1))?.[1] ?? text(item(m, 2)),
  text: text(item(m, 2)),
}));

describe('the Questions tabs', () => {
  const render = (current: string, questions = 0, shared = 0) =>
    renderToStaticMarkup(createElement(SectionTabs, { label: 'Questions', tabs: withCounts(QUESTIONS_TABS, { questions, shared }), current }));

  it('draw Open questions, Shared with me and History, links to their pages', () => {
    expect(links(render('/app/inbox')).map((l) => [l.text, l.href])).toEqual([
      ['Open questions', '/app/inbox'],
      ['Shared with me', '/app/inbox?from=shared'],
      ['History', '/app/inbox/done'],
    ]);
  });

  it('mark the page showing', () => {
    expect(links(render('/app/inbox?from=shared')).map((l) => l.current)).toEqual([false, true, false]);
    expect(links(render('/app/inbox/done')).map((l) => l.current)).toEqual([false, false, true]);
  });

  it('carry questions − shared on Open questions and shared on Shared with me, spoken with the name', () => {
    const [open, shared, history] = links(render('/app/inbox', 5, 2));
    assertDefined(open, 'the Open questions tab');
    assertDefined(shared, 'the Shared with me tab');
    assertDefined(history, 'the History tab');
    expect(open.text).toBe('Open questions 3');
    expect(open.name).toBe('Open questions: 3 waiting');
    expect(shared.text).toBe('Shared with me 2');
    expect(shared.name).toBe('Shared with me: 2 waiting');
    expect(history.text).toBe('History');
    expect(history.attrs).not.toContain('aria-label');
  });

  it('show no count at 0', () => {
    const [open, shared] = links(render('/app/inbox', 2, 2));
    assertDefined(open, 'the Open questions tab');
    assertDefined(shared, 'the Shared with me tab');
    expect(open.text).toBe('Open questions');
    expect(open.attrs).not.toContain('aria-label');
    expect(shared.text).toBe('Shared with me 2');
    expect(links(render('/app/inbox')).map((l) => l.text)).toEqual(['Open questions', 'Shared with me', 'History']);
    expect(render('/app/inbox')).not.toContain('section-tabs-count');
  });
});
