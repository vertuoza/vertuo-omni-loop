import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { nestedLinks } from '../people/nested-links';
import type { DocumentGroup } from '../waiting/documents';
import { EMPTY_WAITING, type WaitingList, type WaitingOutbox, type WaitingQuestion } from '../waiting/waiting';
import { BellView } from './Bell.tsx';
import type { BellAlerts, BellUnread } from './bell';

// The top bar's bell (PRD 499) as the server renders it: its count badge and accessible name, and its
// panel, closed at first, listing the Questions and Outbox groups, or that nothing waits.

const NOW = Date.parse('2026-09-28T10:00:00Z');
const MIN = 60_000;

const q = (id: string, ago: number, sharedBy: string | null = null): WaitingQuestion => ({
  kind: 'question', id, sessionTitle: `vertuo-omni-loop · ${id}`, question: `Which ${id}?`, askedAt: NOW - ago, sharedBy,
});
const o = (id: string, prd: number, rank: WaitingOutbox['rank']): WaitingOutbox => ({
  kind: 'outbox', id, prd, dossierId: `d-${prd}`, title: `Gate ${prd}`, rank, question: `Keep ${id}?`,
});

const render = (list: WaitingList, unread: BellUnread = {}) => renderToStaticMarkup(createElement(BellView, { list, unread, now: NOW }));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const button = (html: string) => html.match(/<button\b[^>]*class="bell-button"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? '';
/** The panel's inside, from the end of its opening tag. */
const panel = (html: string) => html.slice(html.indexOf('>', html.indexOf('class="bell-panel"')) + 1);

describe('the bell', () => {
  it('with nothing waiting: no badge, and "Nothing waiting for you" as its name and in its panel', () => {
    const html = render(EMPTY_WAITING);
    expect(button(html)).toContain('aria-label="Nothing waiting for you"');
    expect(html).not.toContain('bell-badge');
    expect(text(panel(html))).toBe('Nothing waiting for you.');
  });

  it('carries the count as a badge, and says it in its name', () => {
    const html = render({ questions: [q('a', MIN)], outbox: [o('i1', 459, 'high')] });
    expect(button(html)).toContain('aria-label="Waiting for you: 2"');
    expect(button(html)).toMatch(/<span class="bell-badge" aria-hidden="true">2<\/span>/);
  });

  it('is a button that opens a panel, closed at first', () => {
    const html = render(EMPTY_WAITING);
    expect(button(html)).toContain('aria-expanded="false"');
    const controls = button(html).match(/aria-controls="([^"]+)"/)?.[1];
    expect(controls).toBeTruthy();
    expect(html).toMatch(new RegExp(`<div id="${controls}" class="bell-panel"[^>]*hidden=""`));
  });

  it('lists each question\'s session, first question and age, linking to its round, and who shared it', () => {
    const html = render({ questions: [q('mine', 3 * MIN), q('theirs', 2 * 60 * MIN, 'Bob')], outbox: [] });
    const body = panel(html);
    expect(body).toContain('>Questions<');
    expect(body).not.toContain('>Outbox<');
    const links = [...body.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => [m[1], text(m[2])]);
    expect(links).toEqual([
      ['/ask/q/theirs', 'vertuo-omni-loop · theirs Which theirs? 2 h · shared by Bob'],
      ['/ask/q/mine', 'vertuo-omni-loop · mine Which mine? 3 min'],
    ]);
  });

  it('draws who shared a question as a person chip, its face before the name (PRD 652)', () => {
    const shared = { ...q('theirs', MIN, 'Bob'), sharedByFace: { kind: 'photo' as const, url: 'https://a.test/bob.png' } };
    const body = panel(render({ questions: [shared], outbox: [] }));
    expect(body).toMatch(/shared by <span class="person-chip is-inline"><img class="person-face is-photo" src="https:\/\/a.test\/bob.png" alt=""[^>]*\/>Bob<\/span>/);
    expect(text(body)).toContain('1 min · shared by Bob');
  });

  it('keeps who shared plain inside the line\'s link: no link in a link (PRD 698)', () => {
    const shared = { ...q('theirs', MIN, 'Bob'), sharedByFace: { kind: 'photo' as const, url: 'https://a.test/bob.png' } };
    const html = render({ questions: [shared], outbox: [o('i1', 459, 'high')] });
    expect(html).toContain('person-chip');
    expect(nestedLinks(html)).toBe(0);
  });

  it('lists each outbox item\'s PRD, title, question and rank, linking to its PRD\'s Outbox tab', () => {
    const body = panel(render({ questions: [q('a', MIN)], outbox: [o('i1', 459, 'human-action'), o('i2', 460, 'high')] }));
    expect(body.indexOf('>Questions<')).toBeLessThan(body.indexOf('>Outbox<'));
    const links = [...body.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => [m[1].replace(/&amp;/g, '&'), text(m[2])]);
    expect(links.slice(1)).toEqual([
      ['/prd/d-459?tab=outbox', 'PRD 459 · Gate 459 Keep i1? human-action'],
      ['/prd/d-460?tab=outbox', 'PRD 460 · Gate 460 Keep i2? high'],
    ]);
    expect(body).not.toContain('Nothing waiting for you.');
  });

  it('says a part that could not be read is being retried, with the items it kept', () => {
    const body = panel(render({ questions: [q('a', MIN)], outbox: [] }, { outbox: true }));
    expect(text(body)).toContain('Outbox couldn\'t be read — retrying.');
    expect(body).toContain('href="/ask/q/a"');
    expect(body).not.toContain('Nothing waiting for you.');
    const kept = panel(render({ questions: [q('a', MIN)], outbox: [] }, { questions: true }));
    expect(text(kept)).toMatch(/Questions couldn't be read — retrying\. .*Which a\?/);
  });
});

describe('its New documents group (PRD 579)', () => {
  const doc: DocumentGroup = { dossierId: 'd-579', prd: 579, title: 'New documents alert', kinds: ['spec', 'before-after'], newestId: 'v9', newestAt: NOW - 3 * MIN };
  const withDocs = (list: WaitingList, documents: DocumentGroup[]) =>
    renderToStaticMarkup(createElement(BellView, { list, unread: {}, now: NOW, documents }));

  it('lists each PRD after Outbox, linking to its page, with the kinds and how long ago', () => {
    const body = panel(withDocs({ questions: [], outbox: [o('i1', 459, 'high')] }, [doc]));
    expect(body.indexOf('>Outbox<')).toBeLessThan(body.indexOf('>New documents<'));
    const links = [...body.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => [m[1], text(m[2])]);
    expect(links.at(-1)).toEqual(['/prd/d-579', 'PRD 579 · New documents alert New spec, before/after 3 min']);
  });

  it('never adds to the bell\'s count or its name', () => {
    const none = button(withDocs(EMPTY_WAITING, [doc]));
    expect(none).toContain('aria-label="Nothing waiting for you"');
    expect(none).not.toContain('bell-badge');
    const one = button(withDocs({ questions: [q('a', MIN)], outbox: [] }, [doc, { ...doc, dossierId: 'd-572', prd: 572 }]));
    expect(one).toContain('aria-label="Waiting for you: 1"');
    expect(one).toMatch(/<span class="bell-badge" aria-hidden="true">1<\/span>/);
  });

  it('with only new documents, does not say nothing waits', () => {
    expect(panel(withDocs(EMPTY_WAITING, [doc]))).not.toContain('Nothing waiting for you.');
  });
});

describe('its Business group (PRD 774, s5)', () => {
  const withBusiness = (list: WaitingList, business: number, unread: BellUnread = {}) =>
    renderToStaticMarkup(createElement(BellView, { list, unread, now: NOW, business }));
  const links = (html: string) => [...panel(html).matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => [m[1], text(m[2])]);

  it('with things to check, shows one "Business · N to check" line linking to Settings › Business, last', () => {
    const html = withBusiness({ questions: [], outbox: [o('i1', 459, 'high')] }, 2);
    const body = panel(html);
    expect(body.indexOf('>Outbox<')).toBeLessThan(body.indexOf('>Business<'));
    expect(links(html).at(-1)).toEqual(['/app/settings/business', 'Business · 2 to check Proposed, disputed or fading claims']);
    expect(text(panel(withBusiness(EMPTY_WAITING, 1)))).toContain('Business · 1 to check');
  });

  it('at zero shows no Business group', () => {
    const html = withBusiness(EMPTY_WAITING, 0);
    expect(html).not.toContain('Business');
    expect(text(panel(html))).toBe('Nothing waiting for you.');
  });

  it('never adds to the bell\'s count or its name, and does not say nothing waits', () => {
    const html = withBusiness(EMPTY_WAITING, 3);
    expect(button(html)).toContain('aria-label="Nothing waiting for you"');
    expect(button(html)).not.toContain('bell-badge');
    expect(panel(html)).not.toContain('Nothing waiting for you.');
  });

  it('says so when its count could not be read, keeping the last one', () => {
    expect(text(panel(withBusiness(EMPTY_WAITING, 0, { business: true })))).toContain("Business couldn't be read — retrying.");
    expect(text(panel(withBusiness(EMPTY_WAITING, 2, { business: true })))).toMatch(/Business couldn't be read — retrying\. .*Business · 2 to check/);
  });
});

describe('its alert switches', () => {
  const withAlerts = (alerts: BellAlerts, list: WaitingList = EMPTY_WAITING) =>
    renderToStaticMarkup(createElement(BellView, { list, unread: {}, now: NOW, alerts }));
  const foot = (html: string) => html.match(/<footer class="bell-alerts"[\s\S]*?<\/footer>/)?.[0] ?? '';
  const box = (html: string, label: string) =>
    html.match(new RegExp(`<label class="bell-switch"[^>]*>(?:(?!</label>)[\\s\\S])*${label}(?:(?!</label>)[\\s\\S])*</label>`))?.[0] ?? '';

  it('sit at the foot of the panel, both off by default, whether or not something waits', () => {
    for (const list of [EMPTY_WAITING, { questions: [q('a', MIN)], outbox: [o('i1', 459, 'high')] }]) {
      const html = withAlerts({ desktop: 'off', chime: false }, list);
      const body = panel(html);
      expect(body.trimEnd()).toMatch(/<\/footer><\/div><\/div>$/);
      expect(text(foot(html))).toBe('Desktop alerts Chime');
      expect(box(html, 'Desktop alerts')).toMatch(/<input type="checkbox"(?![^>]*checked)[^>]*>/);
      expect(box(html, 'Chime')).toMatch(/<input type="checkbox"(?![^>]*checked)[^>]*>/);
    }
  });

  it('show what is switched on', () => {
    const html = withAlerts({ desktop: 'on', chime: true });
    expect(box(html, 'Desktop alerts')).toMatch(/<input type="checkbox"[^>]*checked=""/);
    expect(box(html, 'Chime')).toMatch(/<input type="checkbox"[^>]*checked=""/);
  });

  it('read "Blocked by the browser" when the browser denied it, and cannot be turned on from the page', () => {
    const html = withAlerts({ desktop: 'blocked', chime: true });
    const desktop = box(html, 'Desktop alerts');
    expect(text(desktop)).toBe('Desktop alerts Blocked by the browser');
    expect(desktop).toMatch(/<input type="checkbox"[^>]*disabled=""/);
    expect(desktop).not.toMatch(/checked=""/);
    expect(box(html, 'Chime')).not.toMatch(/disabled=""/);
  });

  it('are not drawn without an alerts view', () => {
    expect(render(EMPTY_WAITING)).not.toContain('bell-alerts');
  });
});

describe('its stylesheet', () => {
  const css = readFileSync(new URL('./bell.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('takes the screen\'s width under the top bar below 900 px', () => {
    const bar = readFileSync(new URL('./app-bar.css', import.meta.url), 'utf8');
    expect(bar).toMatch(/\.app-bar\s*\{[^}]*position:\s*relative/);
    expect(css).toMatch(/@media \(max-width: 899\.98px\)[\s\S]*\.bell\s*\{[^}]*position:\s*static/);
    expect(css).toMatch(/@media \(max-width: 899\.98px\)[\s\S]*\.bell-panel\s*\{[^}]*top:\s*100%/);
    expect(css).toMatch(/@media \(max-width: 899\.98px\)[\s\S]*\.bell-panel\s*\{[^}]*left:\s*0/);
    expect(css).toMatch(/@media \(max-width: 899\.98px\)[\s\S]*\.bell-panel\s*\{[^}]*right:\s*0/);
  });

  it('names no colour of its own: every colour comes from the ask pages\' tokens', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(?:rgba?|hsla?|oklch|color-mix)\(/i);
    expect(css).not.toMatch(/(?<![\w-])(?:white|black)(?![\w-])/);
  });
});
