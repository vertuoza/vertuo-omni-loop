import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { nestedLinks } from '../../people/nested-links';
import { DEMO_MEMBERS, demoHistory } from './demo';
import { WorkspaceHistory } from './WorkspaceHistory';
import { historyChoices, historyItemsOf, historyPageOf, type HistoryFilters } from './workspace-history';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';

// /ask/history (PRD 144), as the server renders it: a form of filters that works before any script
// runs (a GET to the same page), and a list of rounds, each opening /ask/q/<round>.

const NOW = Date.parse('2026-09-26T10:00:00Z');
const rows = demoHistory(NOW);
const count = (html: string, pattern: RegExp) => html.match(new RegExp(pattern.source, 'g'))?.length ?? 0;

// The page as the database reads it: the answered and the moved rounds only (a waiting one is on Open).
const items = (filters: HistoryFilters = {}, members = DEMO_MEMBERS) => historyItemsOf(historyPageOf(rows, filters).rows, members);
const page = (filters: HistoryFilters = {}) =>
  renderToStaticMarkup(createElement(WorkspaceHistory, { items: items(filters), choices: historyChoices(rows, DEMO_MEMBERS), filters }));

describe('the history page', () => {
  it('lists every round, each linking to its own page, newest first', () => {
    const html = page();
    const links = [...html.matchAll(/<a class="inbox-r done-row" href="([^"]+)"/g)].map((m) => m[1]);
    expect(links).toEqual(items().map((item) => item.href));
    expect(links.length).toBeGreaterThan(1);
  });

  it('shows each round\'s answer after a check, its category under All, one quiet line, and who answered', () => {
    const html = page();
    expect(html).toContain('Hook mode + nudge (Recommended)');
    expect(html).toMatch(/✓ <\/span><span class="ask-history-answer">Hook mode/);
    const text = html.replace(/<[^>]*>/g, '');
    expect(text).toMatch(/answered by PAULA/);
    expect(html).toContain('data-category="architecture"');
    expect(html).toContain('data-category="business"');
    expect(html).toMatch(/<span class="inbox-r-quiet">[^<]*vertuoza\/vertuo-omni-loop · PRD #71 · answered by [^<]*<\/span>/);
  });

  it('names who asked on the quiet line only when it is someone else, and the category under All only', () => {
    const quiet = (html: string) => [...html.matchAll(/<span class="inbox-r-quiet">([^<]*)<\/span>/g)].map((m) => m[1] ?? '');
    const all = quiet(page());
    expect(all.some((line) => line.includes('asked by'))).toBe(true);
    expect(all.some((line) => line.includes('Architecture'))).toBe(true);
    const chosen = quiet(page({ category: 'architecture' }));
    expect(chosen.length).toBeGreaterThan(0);
    expect(chosen.some((line) => line.includes('Architecture'))).toBe(false);
  });

  it('anchors each row on who answered, the face alone, and keeps the name for the quiet line (PRD 652)', () => {
    const html = page();
    expect(html).toContain('<span class="inbox-r-anchor done-anchor" aria-hidden="true"><span class="person-chip is-table"><span class="person-face is-initial" aria-hidden="true" data-initial="P"></span>PAULA</span></span>');
    const photo = { kind: 'photo' as const, url: 'https://github.com/paula.png?size=48' };
    const faced = DEMO_MEMBERS.map((m) => (m.name === 'PAULA' ? { ...m, face: photo } : m));
    const withPhoto = renderToStaticMarkup(createElement(WorkspaceHistory, { items: items({}, faced), choices: historyChoices(rows, faced), filters: {} }));
    expect(withPhoto).toContain('<img class="person-face is-photo" src="https://github.com/paula.png?size=48" alt=""');
  });

  it('AC-10: shows none of the details on the row, and holds them behind an info button', () => {
    const html = page();
    for (const word of ['feat/ask-mode', 'claude-opus-4-8', '/omni:brainstorm', 'tokens']) expect(html).not.toContain(word);
    expect(html).toMatch(/<button[^>]*aria-label="Details of this question"/);
  });

  it('shows "📎 N screenshots" on an answer that has them, and nothing on one without (PRD 620)', () => {
    const html = page();
    expect(count(html, /📎/)).toBe(1);
    expect(html).toMatch(/<span class="ask-history-answer">14 days<\/span><span class="ask-shots-count">📎 2 screenshots<\/span>/);
  });

  it('offers a GET form with every filter and the search, keeping what is chosen', () => {
    const html = page({ category: 'product', prd: parsePrd(71), search: 'host' });
    const form = html.match(/<form[^>]*>/)?.[0] ?? '';
    expect(form).toContain('method="get"');
    expect(form).toContain('action="/app/inbox/done"');
    for (const name of ['category', 'repo', 'prd', 'skill', 'asked', 'answered', 'q']) expect(html).toContain(`name="${name}"`);
    expect(html).toContain('name="category" value="product"');
    expect(html).toContain('name="prd" value="71"');
    expect(html).toContain('<span class="omni-select__value">PRD #71</span>');
    expect(html).toMatch(/<input[^>]*name="q"[^>]*value="host"/);
    expect(html).toContain('<a class="ask-history-clear" href="/app/inbox/done">Clear all</a>');
  });

  it('offers no Clear while nothing is chosen', () => {
    expect(page()).not.toContain('ask-history-clear');
  });

  it('keeps who asked and who answered plain inside each row\'s link: no link in a link (PRD 698)', () => {
    const html = page();
    expect(html).toContain('person-chip');
    expect(nestedLinks(html)).toBe(0);
  });

  it('AC-4: lists the answered and the moved rounds, and leaves the waiting round out', () => {
    const waiting = rows.filter((row) => row.round.status === 'open');
    expect(waiting.length).toBeGreaterThan(0);
    const moved = rows.map((row, i) => (i === 0 ? { ...row, round: { ...row.round, id: 'moved-round', status: 'abandoned' as const, answered_by: null, answers: null } } : row));
    const listed = historyItemsOf(historyPageOf(moved, {}).rows, DEMO_MEMBERS).map((item) => item.roundId);
    expect(listed).toContain('moved-round');
    for (const row of waiting) expect(listed).not.toContain(row.round.id);
    expect(listed.length).toBeGreaterThan(1);
  });

  it('says so when nothing matches, and when nothing was ever asked', () => {
    expect(page({ search: 'no such word anywhere' })).toContain('No question matches');
    const empty = renderToStaticMarkup(createElement(WorkspaceHistory, { items: [], choices: historyChoices([], []), filters: {} }));
    expect(empty).toContain('No question yet');
  });
});
