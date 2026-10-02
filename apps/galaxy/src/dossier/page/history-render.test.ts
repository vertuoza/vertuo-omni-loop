import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import type { DossierListRow } from '../store';
import { DossierHistory } from './DossierHistory';
import { DossierSignIn } from './DossierSignIn';
import { DEMO_VIEWER, demoHistory } from './demo';
import { historyChoices, historyItems, historyStageBar, stageKeyOf, type CurrentStages, type HistoryFilters } from './history';

// /prd as the server renders it (PRD 216): what a person sees before any script runs — the filters and
// the search, a GET form to the same page; the rows, newest activity first, each a link to its dossier;
// none yet, or none matching; and the sign-in. PRD 413: the Mine / All toggle at the head of the filters,
// which keeps every other filter, and an empty Mine that points to All.

const SUPABASE = { url: 'http://127.0.0.1:54321', key: 'anon' };

const row = (id: string, more: Partial<DossierListRow> = {}): DossierListRow => ({
  id, workspace_id: 'w1', home_repo: 'vertuoza/vertuo-omni-loop', prd: null, title: 'An idea', opened_by: 'u-pierre',
  created_at: '2026-09-20T09:00:00Z', numbered_at: null, repos: ['vertuoza/vertuo-omni-loop'], latest: {}, asked: 0, answered: 0,
  last_activity: '2026-09-20T09:00:00Z', ...more,
});
const ROWS = [
  row('00000000-0000-4000-8000-0000000000d1', {
    prd: 216, title: 'PRD dossiers <b>shared</b>', numbered_at: '2026-09-27T10:00:00Z',
    repos: ['vertuoza/vertuo-omni-loop', 'vertuoza/vertuo-core'],
    latest: {
      spec: { id: 's3', version: 3, source: 'github', created_at: '2026-09-28T08:00:00Z' },
      plan: { id: 'p1', version: 1, source: 'kit', created_at: '2026-09-27T11:00:00Z' },
    },
    asked: 12, answered: 11, last_activity: '2026-09-28T08:00:00Z',
  }),
  row('00000000-0000-4000-8000-0000000000d2', { title: 'Offline quotes', last_activity: '2026-09-21T09:00:00Z' }),
];

const ALL: HistoryFilters = { who: 'all' };

function history(filters: HistoryFilters = ALL, rows = ROWS, viewer: string | null = 'u-pierre') {
  return renderToStaticMarkup(createElement(DossierHistory, { items: historyItems(rows, filters, viewer), choices: historyChoices(rows), filters }));
}

const toggle = (html: string) =>
  [...html.matchAll(/<a class="dossier-history-who"( aria-current="page")? href="([^"]+)">([^<]+)<\/a>/g)].map((m) => [m[3], m[2]!.replaceAll('&amp;', '&'), Boolean(m[1])]);

describe('the filters', () => {
  it('are a GET form to the same page, a search and two picks, so they work before any script runs', () => {
    const html = history();
    const form = html.match(/<form[^>]*>/)?.[0] ?? '';
    expect(form).toContain('method="get"');
    expect(form).toContain('action="/prd"');
    expect(form).toContain('role="search"');
    expect(html).toMatch(/<input[^>]*type="search"[^>]*name="q"/);
    const repos = [...html.matchAll(/<option value="([^"]*)"[^>]*>([^<]+)<\/option>/g)].map((m) => [m[1], m[2]]);
    expect(repos).toEqual([
      ['', 'Any'], ['vertuoza/vertuo-core', 'vertuoza/vertuo-core'], ['vertuoza/vertuo-omni-loop', 'vertuoza/vertuo-omni-loop'],
      ['', 'Drafts and PRDs'], ['draft', 'Drafts'], ['prd', 'PRDs'],
    ]);
    expect(html).toContain('>Filter</button>');
    expect(html).not.toContain('>Clear</a>');
  });

  it('keep the search and Filter on one bar, and fold the repository, draft or PRD and the outbox box under More filters (issue #703)', () => {
    const html = history();
    expect(html).toMatch(/<div class="dossier-history-bar"><input[^>]*aria-label="Search the titles"[^>]*type="search"[^>]*name="q"[^>]*\/><button type="submit" class="ask-button">Filter<\/button><\/div>/);
    expect(html).toContain('<details class="dossier-history-more"><summary>More filters');
    const fold = html.slice(html.indexOf('<details'), html.indexOf('</details>'));
    expect(fold).toContain('name="repo"');
    expect(fold).toContain('name="state"');
    expect(fold).toContain('name="needs"');
    expect(fold).not.toContain('name="q"');
  });

  it('open the fold by itself when a filter it holds is set, so a set filter is never hidden (issue #703)', () => {
    const open = (filters: HistoryFilters) => history(filters).includes('<details class="dossier-history-more" open="">');
    expect(open({ who: 'all', repo: 'vertuoza/vertuo-core' })).toBe(true);
    expect(open({ who: 'all', state: 'draft' })).toBe(true);
    expect(open({ who: 'all', needsAnswer: true })).toBe(true);
    expect(open(ALL)).toBe(false);
    expect(open({ who: 'all', search: 'dossiers' })).toBe(false);
    expect(open({ who: 'all', stage: 'building' })).toBe(false);
  });

  it('keep what the address picked, and offer to clear it', () => {
    const html = history({ who: 'mine', repo: 'vertuoza/vertuo-core', state: 'prd', search: 'dossiers' });
    expect(html).toMatch(/<input[^>]*name="q"[^>]*value="dossiers"/);
    expect(html).toContain('<option value="vertuoza/vertuo-core" selected="">');
    expect(html).toContain('<option value="prd" selected="">');
    expect(html).toContain('<a class="dossier-history-clear" href="/prd">Clear</a>');
  });
});

describe('Mine and All', () => {
  it('are two links at the head of the filters, the current one marked, Mine by default', () => {
    const html = history({ who: 'mine' });
    expect(toggle(html)).toEqual([['Mine', '/prd', true], ['All', '/prd?who=all', false]]);
    expect(html.indexOf('dossier-history-who')).toBeLessThan(html.indexOf('<form'));
    expect(html).toContain('<div class="dossier-history-head"><h1 class="dossier-title">PRDs</h1><nav class="dossier-history-whos"');
    expect(toggle(history(ALL))).toEqual([['Mine', '/prd', false], ['All', '/prd?who=all', true]]);
  });

  it('keep the repository, the state and the search when switching', () => {
    const html = history({ who: 'mine', repo: 'vertuoza/vertuo-core', state: 'prd', search: 'ask mode' });
    expect(toggle(html)).toEqual([
      ['Mine', '/prd?repo=vertuoza%2Fvertuo-core&state=prd&q=ask+mode', true],
      ['All', '/prd?repo=vertuoza%2Fvertuo-core&state=prd&q=ask+mode&who=all', false],
    ]);
  });

  it('the filter form carries who=all under All, so filtering stays on All, and nothing under Mine', () => {
    expect(history(ALL)).toContain('<input type="hidden" name="who" value="all"/>');
    expect(history({ who: 'mine' })).not.toContain('name="who"');
  });

  it('clearing the filters keeps who', () => {
    expect(history({ who: 'all', state: 'prd' })).toContain('<a class="dossier-history-clear" href="/prd?who=all">Clear</a>');
    expect(history({ who: 'mine', state: 'prd' })).toContain('<a class="dossier-history-clear" href="/prd">Clear</a>');
    expect(history(ALL)).not.toContain('>Clear</a>');
  });

  it('Mine lists only the viewer\'s dossiers', () => {
    const rows = [...ROWS, { ...ROWS[1]!, id: '00000000-0000-4000-8000-0000000000d9', title: 'Paula\'s idea', opened_by: 'u-paula' }];
    const html = history({ who: 'mine' }, rows);
    expect(html).toContain('Offline quotes');
    expect(html).not.toContain('Paula&#x27;s idea');
    expect(history(ALL, rows)).toContain('Paula&#x27;s idea');
  });

  it('an empty Mine says so, keeps the toggle, and links to All at the same address', () => {
    const html = history({ who: 'mine' }, ROWS, 'u-nobody');
    expect(html).toContain('You have not opened a PRD yet.');
    expect(html).toContain('<a class="dossier-history-to-all" href="/prd?who=all">');
    expect(toggle(html)).toHaveLength(2);
    expect(html).not.toContain('dossier-history-row');
    expect(html).not.toContain('No PRD yet');
  });

  it('an empty Mine under filters says nothing matches, and still links to All with them', () => {
    const html = history({ who: 'mine', state: 'draft' }, ROWS, 'u-nobody');
    expect(html).toContain('No PRD matches');
    expect(html).toContain('<a class="dossier-history-to-all" href="/prd?state=draft&amp;who=all">');
  });

  it('the demo history shows some rows under Mine for the demo viewer, and more under All', () => {
    const rows = demoHistory(Date.parse('2026-09-28T10:00:00Z'));
    const mine = historyItems(rows, { who: 'mine' }, DEMO_VIEWER);
    expect(mine.length).toBeGreaterThan(0);
    expect(historyItems(rows, ALL, DEMO_VIEWER).length).toBeGreaterThan(mine.length);
  });
});

describe('the rows', () => {
  it('list the dossiers newest activity first, each a link to its page', () => {
    const html = history();
    const links = [...html.matchAll(/<a class="dossier-history-row" href="([^"]+)">/g)].map((m) => m[1]);
    expect(links).toEqual(['/prd/00000000-0000-4000-8000-0000000000d1', '/prd/00000000-0000-4000-8000-0000000000d2']);
    expect(html).toContain('aria-label="PRDs, newest activity first"');
  });

  it('show #n or DRAFT, the title as text, the repository chips, the artifacts with their versions, and answered out of asked', () => {
    const html = history();
    expect(html).toContain('<span class="dossier-number">#216</span>');
    expect(html).toContain('<span class="dossier-draft">DRAFT</span>');
    expect(html).toContain('PRD dossiers &lt;b&gt;shared&lt;/b&gt;');
    expect(html).toContain('<span class="dossier-repo">vertuoza/vertuo-omni-loop</span><span class="dossier-repo">vertuoza/vertuo-core</span>');
    expect(html).toContain('<span class="dossier-history-artifact">Spec <small>v3</small></span><span class="dossier-history-artifact">Plan <small>v1</small></span>');
    expect(html).toContain('no artifact yet');
    expect(html).toContain('11/12 answered');
    expect(html).toContain('no question yet');
    expect(html).toContain('<time class="ask-hint" dateTime="2026-09-28T08:00:00Z">last activity 28 Sep 2026, 08:00 UTC</time>');
  });
});

describe('an empty history', () => {
  it('says there is no PRD yet, and how one gets here, with no filters to set', () => {
    const html = history(ALL, []);
    expect(html).toContain('No PRD yet');
    expect(html).toContain('once a brainstorm opens it');
    expect(html).not.toContain('<form');
  });

  it('says nothing matches, and keeps the filters, when they leave nothing', () => {
    const html = history({ who: 'all', search: 'nothing like it' });
    expect(html).toContain('No PRD matches');
    expect(html).toContain('<form');
    expect(html).not.toContain('dossier-history-row');
  });
});

describe('the sign-in', () => {
  it('says the history lists the PRDs of the person\'s workspaces', () => {
    const html = renderToStaticMarkup(createElement(DossierSignIn, { supabase: SUPABASE, returnPath: '/prd/callback', error: null, what: 'history' }));
    expect(html).toContain('Sign in to see your workspace&#x27;s PRDs');
    expect(html).toContain('>Sign in with GitHub</button>');
    expect(html).not.toContain('Sign in to read this PRD');
  });
});

describe('the open questions (PRD 251)', () => {
  const WAITING = row('00000000-0000-4000-8000-0000000000d6', {
    prd: 251, title: 'Answer the outbox anywhere', numbered_at: '2026-09-26T10:00:00Z', last_activity: '2026-09-26T10:00:00Z',
  });
  const rows = [...ROWS, WAITING];
  const open = new Map([[WAITING.id, 2]]);
  const render = (filters: HistoryFilters) => renderToStaticMarkup(createElement(DossierHistory, {
    items: historyItems(rows, filters, 'u-pierre', open), choices: historyChoices(rows), filters,
  }));

  it('shows n open on the row with open questions only, as the Outbox tab counts them', () => {
    const html = render(ALL);
    expect(html).toContain('<span class="dossier-history-artifact dossier-history-open">Outbox <small>2 open</small></span>');
    expect(html.match(/dossier-history-open/g)).toHaveLength(1);
  });

  it('offers Needs an answer in the filters, unticked, and keeps it ticked when the address asks for it', () => {
    expect(render(ALL)).toContain('<input type="checkbox" name="needs" value="answer"/> Needs an answer');
    const html = render({ who: 'all', needsAnswer: true });
    expect(html).toContain('<input type="checkbox" name="needs" checked="" value="answer"/> Needs an answer');
    expect(html.match(/class="dossier-history-row"/g)).toHaveLength(1);
    expect(html).toContain('Answer the outbox anywhere');
    expect(html).toContain('<a class="dossier-history-clear" href="/prd?who=all">Clear</a>');
  });

  it('says nothing matches when no PRD needs an answer', () => {
    const html = renderToStaticMarkup(createElement(DossierHistory, {
      items: historyItems(ROWS, { who: 'all', needsAnswer: true }, 'u-pierre'), choices: historyChoices(ROWS), filters: { who: 'all', needsAnswer: true },
    }));
    expect(html).toContain('No PRD matches');
  });
});

describe('the stages (PRD 587)', () => {
  const ANSWERED = row('00000000-0000-4000-8000-0000000000d3', { title: 'Half answered', asked: 2, answered: 1, last_activity: '2026-09-19T09:00:00Z' });
  const rows = [...ROWS, ANSWERED];
  const stages: CurrentStages = new Map([[stageKeyOf(ROWS[0]!), 'building']]);
  const render = (filters: HistoryFilters) => renderToStaticMarkup(createElement(DossierHistory, {
    items: historyItems(rows, filters, 'u-pierre', new Map(), stages), choices: historyChoices(rows), filters,
    stages: historyStageBar(rows, filters, 'u-pierre', new Map(), stages),
  }));
  const bar = (html: string) =>
    [...html.matchAll(/<a class="stage-stop stage-(passed|current)"( aria-current="page")? href="([^"]+)" style="text-decoration:none">([^<]+) <small>(\d+)<\/small><\/a>/g)]
      .map((m) => [m[4], Number(m[5]), m[3]!.replaceAll('&amp;', '&'), m[1] === 'current']);

  it('shows the bar above the list, the seven stages in order with their counts, each a link', () => {
    const html = render(ALL);
    expect(html).toContain('aria-label="PRDs by stage"');
    expect(bar(html)).toEqual([
      ['idea', 1, '/prd?stage=idea&who=all', false], ['PRD', 0, '/prd?stage=prd&who=all', false],
      ['inbox', 0, '/prd?stage=inbox&who=all', false], ['building', 1, '/prd?stage=building&who=all', false],
      ['outbox', 0, '/prd?stage=outbox&who=all', false], ['shipped', 0, '/prd?stage=shipped&who=all', false],
      ['retro', 0, '/prd?stage=retro&who=all', false],
    ]);
    expect(html.indexOf('PRDs by stage')).toBeGreaterThan(html.indexOf('<form'));
    expect(html.indexOf('PRDs by stage')).toBeLessThan(html.indexOf('dossier-history-list'));
  });

  it('highlights the selected stage, whose link clears it, and keeps only its rows', () => {
    const html = render({ who: 'all', stage: 'building' });
    expect(bar(html).find(([label]) => label === 'building')).toEqual(['building', 1, '/prd?who=all', true]);
    expect(bar(html).filter(([, , , current]) => current)).toHaveLength(1);
    expect(html).toContain('aria-current="page" href="/prd?who=all" style="text-decoration:none">building');
    expect(html.match(/class="dossier-history-row"/g)).toHaveLength(1);
    expect(html).toContain('<input type="hidden" name="stage" value="building"/>');
    expect(html).toContain('<a class="dossier-history-clear" href="/prd?who=all">Clear</a>');
  });

  it('shows each row its current stage pill, and none for a draft with no answer', () => {
    const html = render(ALL);
    const pills = [...html.matchAll(/<a class="dossier-history-row"[\s\S]*?<\/a>/g)]
      .map((m) => m[0].match(/<span class="stage-stop stage-current">([^<]+)<\/span>/)?.[1] ?? null);
    expect(pills).toEqual(['building', null, 'idea']);
  });

  it('puts the pill beside the title, not inside it, so it keeps its own size (issue #703)', () => {
    const html = render(ALL);
    expect(html).toContain('<span class="dossier-history-top"><span class="dossier-history-title"><span class="dossier-number">#216</span> <span>PRD dossiers &lt;b&gt;shared&lt;/b&gt;</span></span><span class="stage-stop stage-current">building</span></span>');
  });

  it('without a bar given, shows none', () => {
    expect(history()).not.toContain('PRDs by stage');
  });
});

describe('one person\'s PRDs, who=<login> (PRD 698)', () => {
  const ADA: HistoryFilters = { who: { login: 'ada-gh' } };
  const theirs = (filters: HistoryFilters, whom = new Set(['u-pierre'])) => renderToStaticMarkup(createElement(DossierHistory, {
    items: historyItems(ROWS, filters, 'u-other', new Map(), new Map(), whom), choices: historyChoices(ROWS), filters,
  }));

  it('presses neither Mine nor All, and both leave the person', () => {
    expect(toggle(theirs(ADA))).toEqual([['Mine', '/prd', false], ['All', '/prd?who=all', false]]);
  });

  it('reads "Opened by @login", linking to their profile, and lists their PRDs', () => {
    const html = theirs(ADA);
    expect(html).toContain('<p class="ask-hint dossier-history-by">Opened by <a href="/app/people/ada-gh">@ada-gh</a></p>');
    expect(html).toContain('href="/prd/00000000-0000-4000-8000-0000000000d1"');
  });

  it('keeps the login in the form, and Clear keeps it', () => {
    const html = theirs({ ...ADA, search: 'dossiers' });
    expect(html).toContain('<input type="hidden" name="who" value="ada-gh"/>');
    expect(html).toContain('href="/prd?who=ada-gh">Clear</a>');
  });

  it('says so when they opened none, pointing to All', () => {
    const html = theirs(ADA, new Set());
    expect(html).toContain('@ada-gh has not opened a PRD here.');
    expect(html).toContain('href="/prd?who=all"');
    expect(html).not.toContain('You have not opened');
  });

  it('draws no "Opened by" line under Mine or All', () => {
    expect(history()).not.toContain('Opened by');
    expect(history({ who: 'mine' })).not.toContain('Opened by');
  });
});
