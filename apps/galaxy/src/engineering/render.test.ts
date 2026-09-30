import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { UNREADABLE } from '../dashboard/part';
import { periodWindow } from '../dashboard/board/period';
import { demoEngineeringBoard } from './demo';
import { EngineeringScreen, type EngineeringView } from './EngineeringScreen';
import { faceOf, type Face } from '../people/face';
import { engineeringOf, OMNI_MAN, type PullRequestRow } from './tally';

// /app/engineering as the server renders it (PRD 612 s3), to static markup: what a person sees
// before any script runs.

const NOW = new Date('2026-09-26T10:00:00Z');
const WEEK = periodWindow('7d', NOW);
const HOUR = 3_600_000;
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

let serial = 0;
const pr = (over: Partial<PullRequestRow> = {}): PullRequestRow => ({
  repo: 'acme/widgets', number: ++serial, author: 'ada', authorIsBot: false, openedAt: '2026-09-24T08:00:00Z', mergedAt: null, closedAt: null,
  mergedBy: null, commits: 0, additions: 0, deletions: 0, omniSigned: false, base: 'main', head: 'feat/thing', ...over,
});
const mergedAfter = (hours: number, over: Partial<PullRequestRow> = {}) => {
  const at = new Date(Date.parse('2026-09-24T08:00:00Z') + hours * HOUR).toISOString();
  return pr({ mergedAt: at, closedAt: at, mergedBy: 'bob', commits: 2, additions: 10, deletions: 3, ...over });
};
const ROWS = [
  mergedAfter(4, { omniSigned: true }),
  mergedAfter(20, { repo: 'acme/gears', author: 'carl' }),
  pr({ author: 'dependabot[bot]', authorIsBot: true }),
  pr({ author: OMNI_MAN, authorIsBot: true, omniSigned: true }),
];

const board = (rows = ROWS, tracked = ['acme/widgets', 'acme/gears']): EngineeringView =>
  ({ kind: 'board', name: 'Vertuoza', board: engineeringOf({ tracked, pullRequests: rows, reviews: [{ repo: 'acme/widgets', number: ROWS[0].number, reviewer: 'dora', firstAt: '2026-09-25T08:00:00Z' }] }, WEEK, 'merged', NOW) });
const render = (view: EngineeringView, query: Record<string, string> = {}) =>
  renderToStaticMarkup(createElement(EngineeringScreen, { view, period: '7d', supabase: null, signinError: null, query }));

describe('the Engineering board, with data', () => {
  const html = render(board(), { period: '7d' });
  const t = text(html);

  it('is headed by the workspace\'s name, under the period switch', () => {
    expect(html).toContain('<h1 class="dash-name">Vertuoza</h1>');
    expect(html).toMatch(/<a href="\/app\/engineering\?period=7d" aria-current="page">7 days<\/a>/);
    expect(html).toContain('href="/app/engineering?period=season"');
  });

  it('shows the six tiles', () => {
    expect(t).toContain('PRs opened 4');
    expect(t).toContain('PRs merged 2');
    expect(t).toContain('Open now 2');
    expect(t).toContain('Median time to merge 12.0 h');
    expect(t).toContain('Commits 4');
    expect(t).toContain('Lines +/− +20 −6');
  });

  it('shows the Omni Loop panel: the share, both medians and the lines', () => {
    expect(t).toContain('Omni Loop 1 of 2 merged PRs signed by Omni-man (50%)');
    expect(t).toContain('Median time to merge: 4.0 h signed vs 20.0 h the rest');
    expect(t).toContain('Lines signed: +10 −3');
  });

  it('adds the sub-PRs merged into feature branches under the lines, 0 included (PRD 714)', () => {
    expect(t).toContain('Lines signed: +10 −3 + 0 sub-PRs merged into feature branches');
    const sub = mergedAfter(1, { omniSigned: true, base: 'feat/loop-health', head: 'feat/loop-health--s1' });
    expect(text(render(board([...ROWS, sub, { ...sub, number: 999 }])))).toContain('+ 2 sub-PRs merged into feature branches');
    expect(text(render(board([sub])))).toContain('Omni Loop No PR merged in this period + 1 sub-PR merged into feature branches');
  });

  it('draws merged per day with the signed part, and the list a screen reader reads in its place', () => {
    expect(html).toContain('eng-bar-signed');
    expect(html).toContain('eng-bar-rest');
    expect(t).toContain('Thursday 24 September: 1 merged, 1 signed by Omni-man');
    expect(t).toContain('Saturday 26 September, today: 0 merged, 0 signed by Omni-man');
  });

  it('lists every tracked repository in a table sorted by merged, each heading a sort link keeping the period', () => {
    expect(t).toContain('acme/gears 1 1 0 20.0 h 2 13');
    expect(t).toContain('acme/widgets 3 1 2 4.0 h 2 13');
    expect(html).toContain('href="/app/engineering?period=7d&amp;sort=opened"');
    expect(html).toMatch(/aria-sort="descending"><a class="eng-sort" href="[^"]*sort=merged">Merged<\/a>/);
  });

  it('shows the three top-5 lists as ranked rows, without bots or Omni-man', () => {
    expect(t).toContain('Most opened 1 ada 1 2 carl 1 Most merged 1 bob 2 Most reviews 1 dora 1');
    expect(t).not.toContain('dependabot');
    expect(t).not.toMatch(/Most opened[^M]*omni-loop-invader/);
  });
});

describe('Loop health, right now (PRD 714 s2)', () => {
  const MINUTE = 60_000;
  const ago = (minutes: number) => new Date(NOW.getTime() - minutes * MINUTE).toISOString();
  const stuck = (minutes: number, over: Partial<PullRequestRow> = {}) => pr({ openedAt: ago(minutes), labels: ['omni:needs-fix'], ...over });
  const claim = (minutes: number) => pr({ openedAt: ago(minutes), headCommittedAt: ago(minutes), draft: true, omniSigned: true, base: 'feat/x', head: 'feat/x--s2' });
  const panel = (html: string) => html.split('id="eng-health">')[1].split('</section>')[0];

  it('sits beside Omni Loop, before the chart', () => {
    const html = render(board());
    expect(html.indexOf('id="eng-omni"')).toBeLessThan(html.indexOf('id="eng-health"'));
    expect(html.indexOf('id="eng-health"')).toBeLessThan(html.indexOf('id="eng-per-day"'));
  });

  it('with nothing stuck: says so', () => {
    expect(text(panel(render(board())))).toBe('Loop health Right now Nothing stuck right now');
  });

  it('lists each pull request: its kind, owner/repo#n linking to it on GitHub, and how long ago it was opened', () => {
    const one = stuck(3 * 60, { repo: 'acme/gears', number: 42 });
    const two = claim(90);
    const html = panel(render(board([...ROWS, one, two])));
    expect(html).toContain('<a href="https://github.com/acme/gears/pull/42">acme/gears#42</a>');
    expect(html).toContain(`<a href="https://github.com/acme/widgets/pull/${two.number}">acme/widgets#${two.number}</a>`);
    expect(text(html)).toBe(`Loop health Right now Stuck acme/gears#42 opened 3.0 h ago Stale claim acme/widgets#${two.number} opened 1.5 h ago`);
    expect(html).not.toContain('more');
  });

  it('shows 10 rows, then how many more', () => {
    const rows = Array.from({ length: 11 }, (_, i) => stuck(100 + i));
    const html = panel(render(board(rows)));
    expect(html.match(/<li/g)).toHaveLength(10);
    expect(text(html)).toMatch(/and 1 more$/);
  });
});

describe('the top-people lists (PRD 645 s1)', () => {
  const HERO = { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 } as const;
  const people = (logins: [string, number][]) => logins.map(([login, count]) => ({ login, count }));
  const faced = (opened: [string, number][], faces: Record<string, Face> = {}): EngineeringView => {
    const view = board();
    if (view.kind !== 'board' || view.board === UNREADABLE || view.board.kind !== 'board') throw new Error('no board');
    const withFace = (list: [string, number][]) => people(list).map((p) => (faces[p.login] ? { ...p, face: faces[p.login] } : p));
    return { ...view, board: { ...view.board, people: { opened: withFace(opened), merged: withFace([['bob', 2]]), reviews: withFace([['dora', 1]]) } } };
  };
  const rowsOf = (html: string, id: string) => html.split(`id="${id}"`)[1].split('</section>')[0].match(/<li[^>]*>.*?<\/li>/g) ?? [];

  const FIVE: [string, number][] = [['ada', 8], ['bob', 6], ['carl', 4], ['dora', 2], ['eli', 1]];

  it('renders each person as a row: rank, avatar, login, a right-aligned count, a bar scaled to the first', () => {
    const html = render(faced(FIVE));
    const rows = rowsOf(html, 'eng-top-opened');
    expect(rows).toHaveLength(5);
    expect(text(rows[0] ?? '')).toBe('1 ada 8');
    expect(rows[0]).toContain('class="eng-rank"');
    expect(rows[0]).toContain('class="eng-count"');
    expect(rows[0]).toContain('style="width:100%"');
    expect(rows[1]).toContain('style="width:75%"');
    expect(rows[4]).toContain('style="width:12.5%"');
  });

  it('gives each list its own bar colour', () => {
    const html = render(faced(FIVE));
    expect(rowsOf(html, 'eng-top-opened')[0]).toContain('eng-meter-opened');
    expect(rowsOf(html, 'eng-top-merged')[0]).toContain('eng-meter-merged');
    expect(rowsOf(html, 'eng-top-reviews')[0]).toContain('eng-meter-reviews');
  });

  it('names each person with a PersonChip (PRD 652 s3): a hero as a hidden pixel SVG, a GitHub photo with an empty alt, then the login', () => {
    const html = render(faced([['ada', 2], ['bob', 1]], {
      ada: faceOf({ name: 'ada', login: 'ada', hero: HERO, color: '#e0457b' }),
      bob: faceOf({ name: 'bob', login: 'bob' }),
    }));
    const [ada, bob] = rowsOf(html, 'eng-top-opened');
    expect(ada).toMatch(/<span class="person-chip is-table"><span class="person-face is-hero" aria-hidden="true"><svg [^>]*shape-rendering="crispEdges"/);
    expect(ada).not.toContain('<img');
    expect(bob).toContain('<span class="person-chip is-table"><img class="person-face is-photo" src="https://github.com/bob.png?size=48" alt=""');
    expect(text(bob ?? '')).toBe('2 bob 1');
  });

  it('a person with no face read yet: the GitHub photo', () => {
    const [ada] = rowsOf(render(faced([['ada', 2]])), 'eng-top-opened');
    expect(ada).toContain('class="person-chip is-table"');
    expect(ada).toContain('src="https://github.com/ada.png?size=48"');
  });
});

describe('a page per repository (PRD 645 s2)', () => {
  it('in the board\'s table, each repository name links to its page, carrying the period', () => {
    const html = renderToStaticMarkup(createElement(EngineeringScreen, { view: board(), period: '30d', supabase: null, signinError: null, query: { period: '30d', sort: 'lines' } }));
    expect(html).toContain('<th scope="row" class="board-name"><a href="/app/engineering/acme/widgets?period=30d">acme/widgets</a></th>');
    expect(html).toContain('<a href="/app/engineering/acme/gears?period=30d">acme/gears</a>');
  });

  const gears: EngineeringView = {
    kind: 'board', name: 'Vertuoza', repo: 'Acme/Gears',
    board: engineeringOf({ tracked: ['Acme/Gears'], pullRequests: ROWS, reviews: [] }, WEEK, 'merged', NOW),
  };
  const html = renderToStaticMarkup(createElement(EngineeringScreen, { view: gears, period: '30d', supabase: null, signinError: null, query: { period: '30d' } }));
  const t = text(html);

  it('leads back to every repository, keeping the period, and is headed by the tracked spelling, once', () => {
    expect(html).toContain('<a class="eng-back" href="/app/engineering?period=30d">← All repositories</a>');
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('<h1 class="dash-name">Acme/Gears</h1>');
  });

  it('switches the period on the page itself', () => {
    expect(html).toContain('href="/app/engineering/Acme/Gears?period=season"');
    expect(html).toMatch(/<a href="\/app\/engineering\/Acme\/Gears\?period=30d" aria-current="page">30 days<\/a>/);
    expect(html).not.toContain('href="/app/engineering?period=season"');
  });

  it('counts that repository alone, and has no Repositories table', () => {
    expect(t).toContain('PRs merged 1');
    expect(t).toContain('+ 0 sub-PRs merged into feature branches');
    expect(t).toContain('Most merged');
    expect(t).toContain('Omni Loop');
    expect(t).toContain('Loop health Right now Nothing stuck right now');
    expect(t).toContain('PRs merged per day');
    expect(html).not.toContain('id="eng-repos"');
    expect(html).not.toContain('<table');
  });

  it('in the demo: a tracked repository\'s page renders, an untracked one is not tracked', () => {
    const view = demoEngineeringBoard('7d', 'merged', NOW, 'ACME/gears');
    expect(view).toMatchObject({ kind: 'board', repo: 'acme/gears' });
    const demo = render(view as EngineeringView);
    expect(demo).toContain('<h1 class="dash-name">acme/gears</h1>');
    expect(demo).not.toContain('<table');
    // Loop health over that repository alone: its stale claim, not the other repository's stuck pull request (PRD 714 s2).
    expect(text(demo)).toContain('Loop health Right now Stale claim acme/gears#501 opened 3.0 h ago');
    expect(text(demo)).not.toContain('acme/widgets#500');
    expect(demoEngineeringBoard('7d', 'merged', NOW, 'acme/sprockets')).toEqual({ kind: 'not-tracked' });
  });
});

describe('the Engineering board, empty', () => {
  it('with no tracked repository: the empty state, linking Settings → Repositories, and no tiles', () => {
    const html = render(board([], []));
    expect(text(html)).toContain('No tracked repositories yet → Settings → Repositories');
    expect(html).toContain('href="/app/settings/repositories"');
    expect(html).not.toContain('board-tiles');
  });

  it('when it could not be read: says so', () => {
    expect(text(render({ kind: 'board', name: 'Vertuoza', board: UNREADABLE }))).toContain('Couldn’t load this. Reload in a moment.');
  });
});

describe('the other situations', () => {
  it('closed, signed out with no database and no workspace each say so', () => {
    expect(text(render({ kind: 'closed' }))).toContain('The Engineering board is not open here');
    expect(text(render({ kind: 'sign-in' }))).toContain('The Engineering board is not open here');
    expect(text(render({ kind: 'no-workspace' }))).toContain('Your account is not in a workspace');
  });
});

describe('the demo', () => {
  it('draws a board for every period, the same one for the same now', () => {
    for (const period of ['7d', '30d', 'season'] as const) {
      const view = demoEngineeringBoard(period, 'merged', NOW);
      expect(view.kind === 'board' && view.board !== UNREADABLE && view.board.kind).toBe('board');
      expect(render(view)).toBe(render(demoEngineeringBoard(period, 'merged', NOW)));
    }
  });

  it('shows the sub-PR line, with sub-PRs merged into feature branches (PRD 714)', () => {
    const view = demoEngineeringBoard('7d', 'merged', NOW);
    expect(text(render(view))).toMatch(/\+ [1-9]\d* sub-PRs merged into feature branches/);
  });

  it('shows Loop health with a stuck pull request and a stale claim (PRD 714 s2)', () => {
    const t = text(render(demoEngineeringBoard('7d', 'merged', NOW)));
    expect(t).toMatch(/Loop health Right now .*Stuck acme\/\w+#\d+ opened/);
    expect(t).toMatch(/Stale claim acme\/\w+#\d+ opened/);
  });

  it('shows both kinds of face: a hero and a GitHub photo', () => {
    const html = render(demoEngineeringBoard('30d', 'merged', NOW));
    expect(html).toMatch(/<span class="person-face is-hero" aria-hidden="true"><svg/);
    expect(html).toContain('<img class="person-face is-photo" src="https://github.com/');
  });
});
