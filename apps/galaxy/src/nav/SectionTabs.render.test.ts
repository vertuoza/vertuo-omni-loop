import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SectionTabs } from './SectionTabs.tsx';
import { QUESTIONS_TABS, SETTINGS_TABS, withCounts } from './section-tabs.ts';

// One row of section tabs (PRD 733): the Fleets · Repositories row on the settings pages and the Open
// questions · Shared with me · History row on the Questions pages, as the server renders them. Each
// tab is a link to its page; the one showing carries aria-current="page"; a count shows only above 0,
// and is spoken with the tab's name.

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const links = (html: string) => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
  attrs: m[1],
  href: /href="([^"]*)"/.exec(m[1])?.[1],
  current: /aria-current="page"/.test(m[1]),
  name: /aria-label="([^"]*)"/.exec(m[1])?.[1] ?? text(m[2]),
  text: text(m[2]),
}));

describe('the settings tabs', () => {
  const render = (current: string) => renderToStaticMarkup(createElement(SectionTabs, { label: 'Settings', tabs: SETTINGS_TABS, current }));

  it('draw Fleets then Repositories, links to their pages, in a named row', () => {
    const html = render('/app/settings/fleets');
    expect(html).toMatch(/<nav [^>]*class="section-tabs"[^>]*aria-label="Settings"/);
    expect(links(html).map((l) => [l.text, l.href])).toEqual([
      ['Fleets', '/app/settings/fleets'],
      ['Repositories', '/app/settings/repositories'],
    ]);
  });

  it('mark only the page showing', () => {
    expect(links(render('/app/settings/fleets')).map((l) => l.current)).toEqual([true, false]);
    expect(links(render('/app/settings/repositories')).map((l) => l.current)).toEqual([false, true]);
    expect(links(render('/app')).some((l) => l.current)).toBe(false);
  });
});

describe('the Questions tabs', () => {
  const render = (current: string, questions = 0, shared = 0) =>
    renderToStaticMarkup(createElement(SectionTabs, { label: 'Questions', tabs: withCounts(QUESTIONS_TABS, { questions, shared }), current }));

  it('draw Open questions, Shared with me and History, links to their pages', () => {
    expect(links(render('/ask')).map((l) => [l.text, l.href])).toEqual([
      ['Open questions', '/ask'],
      ['Shared with me', '/ask/for-me'],
      ['History', '/ask/history'],
    ]);
  });

  it('mark the page showing', () => {
    expect(links(render('/ask/for-me')).map((l) => l.current)).toEqual([false, true, false]);
    expect(links(render('/ask/history')).map((l) => l.current)).toEqual([false, false, true]);
  });

  it('carry questions − shared on Open questions and shared on Shared with me, spoken with the name', () => {
    const [open, shared, history] = links(render('/ask', 5, 2));
    expect(open.text).toBe('Open questions 3');
    expect(open.name).toBe('Open questions: 3 waiting');
    expect(shared.text).toBe('Shared with me 2');
    expect(shared.name).toBe('Shared with me: 2 waiting');
    expect(history.text).toBe('History');
    expect(history.attrs).not.toContain('aria-label');
  });

  it('show no count at 0', () => {
    const [open, shared] = links(render('/ask', 2, 2));
    expect(open.text).toBe('Open questions');
    expect(open.attrs).not.toContain('aria-label');
    expect(shared.text).toBe('Shared with me 2');
    expect(links(render('/ask')).map((l) => l.text)).toEqual(['Open questions', 'Shared with me', 'History']);
    expect(render('/ask')).not.toContain('section-tabs-count');
  });
});
