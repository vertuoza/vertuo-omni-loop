import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { DEMO_MEMBERS, demoHistory } from './demo';
import { WorkspaceHistory } from './WorkspaceHistory';
import { historyChoices, historyList, type HistoryFilters } from './workspace-history';

// /ask/history (PRD 144), as the server renders it: a form of filters that works before any script
// runs (a GET to the same page), and a list of rounds, each opening /ask/q/<round>.

const NOW = Date.parse('2026-09-26T10:00:00Z');
const rows = demoHistory(NOW);
const count = (html: string, pattern: RegExp) => html.match(new RegExp(pattern.source, 'g'))?.length ?? 0;

const page = (filters: HistoryFilters = {}) =>
  renderToStaticMarkup(createElement(WorkspaceHistory, {
    items: historyList(rows, filters, DEMO_MEMBERS), choices: historyChoices(rows, DEMO_MEMBERS), filters,
  }));

describe('the history page', () => {
  it('lists every round, each linking to its own page, newest first', () => {
    const html = page();
    const links = [...html.matchAll(/<a class="ask-history-link" href="([^"]+)"/g)].map((m) => m[1]);
    expect(links).toEqual(historyList(rows, {}, DEMO_MEMBERS).map((item) => item.href));
    expect(links.length).toBeGreaterThan(2);
  });

  it('shows each round\'s answer, who asked, who answered, its category and its context line', () => {
    const html = page();
    expect(html).toContain('Hook mode + nudge (Recommended)');
    const text = html.replace(/<[^>]*>/g, '');
    expect(text).toMatch(/asked by ADA/);
    expect(text).toMatch(/answered by PAULA/);
    expect(html).toContain('data-category="architecture"');
    expect(html).toContain('data-category="unsorted"');
    expect(html).toContain('vertuoza/vertuo-omni-loop · feat/ask-mode · PRD #71');
  });

  it('draws who asked and who answered as chips, the face before the name, the words unchanged (PRD 652)', () => {
    const html = page();
    expect(html).toContain('asked by <span class="person-chip is-inline"><span class="person-face is-initial" aria-hidden="true" data-initial="A"></span>ADA</span>');
    expect(html).toContain(' · answered by <span class="person-chip is-inline"><span class="person-face is-initial" aria-hidden="true" data-initial="P"></span>PAULA</span>');
    const photo = { kind: 'photo' as const, url: 'https://github.com/ada.png?size=48' };
    const faced = DEMO_MEMBERS.map((m) => (m.name === 'ADA' ? { ...m, face: photo } : m));
    const withPhoto = renderToStaticMarkup(createElement(WorkspaceHistory, { items: historyList(rows, {}, faced), choices: historyChoices(rows, faced), filters: {} }));
    expect(withPhoto).toContain('asked by <span class="person-chip is-inline"><img class="person-face is-photo" src="https://github.com/ada.png?size=48" alt=""');
    expect(withPhoto).not.toMatch(/<option[^>]*>[^<]*<(?:img|span)/);
  });

  it('shows "📎 N screenshots" on an answer that has them, and nothing on one without (PRD 620)', () => {
    const html = page();
    expect(count(html, /📎/)).toBe(1);
    expect(html).toMatch(/<span class="ask-history-answer">14 days<\/span><span class="ask-shots-count">📎 2 screenshots<\/span>/);
  });

  it('offers a GET form with every filter and the search, keeping what is chosen', () => {
    const html = page({ category: 'product', prd: 71, search: 'host' });
    const form = html.match(/<form[^>]*>/)?.[0] ?? '';
    expect(form).toContain('method="get"');
    expect(form).toContain('action="/ask/history"');
    for (const name of ['category', 'repo', 'prd', 'skill', 'asked', 'answered', 'q']) expect(html).toContain(`name="${name}"`);
    expect(html).toContain('<option value="product" selected="">Product</option>');
    expect(html).toContain('<option value="71" selected="">PRD #71</option>');
    expect(html).toMatch(/<input[^>]*name="q"[^>]*value="host"/);
    expect(html).toContain('<a class="ask-history-clear" href="/ask/history">Clear</a>');
  });

  it('offers no Clear while nothing is chosen', () => {
    expect(page()).not.toContain('ask-history-clear');
  });

  it('says so when nothing matches, and when nothing was ever asked', () => {
    expect(page({ search: 'no such word anywhere' })).toContain('No question matches');
    const empty = renderToStaticMarkup(createElement(WorkspaceHistory, { items: [], choices: historyChoices([], []), filters: {} }));
    expect(empty).toContain('No question yet');
  });
});
