import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { peopleOf } from '../people/load';
import { faceOf } from '../people/face';
import { nestedLinks } from '../people/nested-links';
import { FixList } from './FixList';
import type { FixFilters, FixItem, FixKind } from './list';
import { TimelinePane } from './TimelinePane';
import type { FixPageView } from './timeline';
import { sure } from '../arcade/sure';

// The fix screens' faces (PRD 652, s6): "asked by @author" on /visual and /bugs, and every "by @login"
// on a fix's Timeline, each a person chip beside the unchanged text, resolved by login.

const text = (html: string) => html.replace(/<[^>]+>/g, '');
const HERO = { v: 1, body: 'girl', skin: 2, hair: 3, suit: 0, cape: 8 };
const ANNA = { user_id: 'u-anna', name: 'Anna', github_login: 'anna', avatar_url: null, fleet: 'octo', hero: HERO };
const FLEETS = [{ name: 'octo', label: 'OCTO', color: '#3355ff', mascot: 'octopod' }];

const item = (askedBy: FixItem['askedBy']): FixItem => ({
  id: 'f1', href: '/visual/f1', heading: '#548', title: 'Darker sidebar', repos: [], artifacts: [], activity: 'last activity', at: '2026-09-29T09:30:00Z',
  askedBy, state: 'asked', stateLabel: 'Asked', risk: null, regression: false,
});
const list = (items: FixItem[]) => renderToStaticMarkup(createElement(FixList, { kind: 'visual', items, choices: { repos: [] }, filters: { who: 'all' } }));

describe('the list of fixes', () => {
  it('shows who asked as a chip beside the unchanged text', () => {
    const html = list([item({ name: '@anna', face: faceOf({ name: '@anna', login: 'anna' }) })]);
    expect(html).toContain('<span class="ask-hint">asked by <span class="person-chip is-inline"><img class="person-face is-photo" src="https://github.com/anna.png?size=48" alt=""');
    expect(text(html)).toContain('asked by @anna');
  });

  it('keeps who asked plain inside the row\'s link, even a member with a login: no link in a link (PRD 698)', () => {
    const anna = peopleOf([ANNA], FLEETS).byLogin('anna', '@anna');
    expect(anna.login).toBe('anna');
    const html = list([item(anna)]);
    expect(html).toContain('asked by <span class="person-chip is-inline">');
    expect(nestedLinks(html)).toBe(0);
  });

  it('shows no asked line when GitHub did not say', () => {
    expect(list([item(null)])).not.toContain('asked by');
  });
});

describe('one person\'s fixes, who=<login> (PRD 698)', () => {
  const theirs = (items: FixItem[], filters: FixFilters = { who: { login: 'anna' } }, kind: FixKind = 'bug') =>
    renderToStaticMarkup(createElement(FixList, { kind, items, choices: { repos: [] }, filters }));
  const toggle = (html: string) =>
    [...html.matchAll(/<a class="dossier-history-who"( aria-current="page")? href="([^"]+)">([^<]+)<\/a>/g)].map((m) => [m[3], m[2], Boolean(m[1])]);

  it('presses neither Mine nor All, and reads "Asked by @login" linking to their profile', () => {
    const html = theirs([item(null)]);
    expect(toggle(html)).toEqual([['Mine', '/bugs', false], ['All', '/bugs?who=all', false]]);
    expect(html).toContain('<p class="ask-hint dossier-history-by">Asked by <a href="/app/people/anna">@anna</a></p>');
    expect(nestedLinks(html)).toBe(0);
  });

  it('keeps the login in the form, and Clear keeps it', () => {
    const html = theirs([item(null)], { who: { login: 'anna' }, state: 'merged' }, 'visual');
    expect(html).toContain('<input type="hidden" name="who" value="anna"/>');
    expect(html).toContain('href="/visual?who=anna">Clear</a>');
  });

  it('says so when they asked for none, pointing to All', () => {
    const html = theirs([]);
    expect(html).toContain('@anna has not asked for a bug fix here.');
    expect(html).toContain('href="/bugs?who=all"');
  });

  it('draws no "Asked by" line under Mine or All', () => {
    expect(list([item(null)])).not.toContain('Asked by');
    expect(theirs([item(null)], { who: 'mine' })).not.toContain('Asked by');
  });
});

describe('the Timeline', () => {
  const view: FixPageView = {
    state: 'merged', stateLabel: 'Merged', links: [],
    timeline: [
      { id: 'asked', label: 'Asked', state: 'done', who: '@anna', when: '29 Sep 2026', href: null },
      { id: 'merged', label: 'Merged', state: 'done', who: '@Stranger', when: '29 Sep 2026', href: null },
      { id: 'released', label: 'Released v1', state: 'done', who: null, when: '29 Sep 2026', href: null },
    ],
  };
  const lines = (html: string) => [...html.matchAll(/<li class="fix-moment fix-moment-done">(.*?)<\/li>/gs)].map((m) => sure(m[1], 'group 1'));

  it('draws a member\'s hero and an outsider\'s GitHub photo beside "by @login", the text unchanged', () => {
    const html = renderToStaticMarkup(createElement(TimelinePane, { fix: view, people: peopleOf([ANNA], FLEETS) }));
    const [asked, merged, released] = lines(html);
    expect(asked).toMatch(/<span>by <a class="person-chip is-inline" href="\/app\/people\/anna"><span class="person-face is-hero" aria-hidden="true"><svg /);
    expect(merged).toContain('<span>by <span class="person-chip is-inline"><img class="person-face is-photo" src="https://github.com/Stranger.png?size=48" alt=""');
    expect(released).not.toContain('person-chip');
    expect(lines(html).map(text)).toEqual(['Asked by @anna · 29 Sep 2026', 'Merged by @Stranger · 29 Sep 2026', 'Released v1 · 29 Sep 2026']);
  });

  it('falls back to GitHub photos with no directory', () => {
    const html = renderToStaticMarkup(createElement(TimelinePane, { fix: view }));
    expect(html).toContain('<img class="person-face is-photo" src="https://github.com/anna.png?size=48" alt=""');
  });
});
