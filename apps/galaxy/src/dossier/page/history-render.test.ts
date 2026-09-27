import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import type { DossierListRow } from '../store';
import { DossierHistory } from './DossierHistory';
import { DossierSignIn } from './DossierSignIn';
import { historyChoices, historyItems, type HistoryFilters } from './history';

// /prd as the server renders it (PRD 216): what a person sees before any script runs — the filters and
// the search, a GET form to the same page; the rows, newest activity first, each a link to its dossier;
// none yet, or none matching; and the sign-in.

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

function history(filters: HistoryFilters = {}, rows = ROWS) {
  return renderToStaticMarkup(createElement(DossierHistory, { items: historyItems(rows, filters), choices: historyChoices(rows), filters }));
}

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

  it('keep what the address picked, and offer to clear it', () => {
    const html = history({ repo: 'vertuoza/vertuo-core', state: 'prd', search: 'dossiers' });
    expect(html).toMatch(/<input[^>]*name="q"[^>]*value="dossiers"/);
    expect(html).toContain('<option value="vertuoza/vertuo-core" selected="">');
    expect(html).toContain('<option value="prd" selected="">');
    expect(html).toContain('<a class="dossier-history-clear" href="/prd">Clear</a>');
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
    const html = history({}, []);
    expect(html).toContain('No PRD yet');
    expect(html).toContain('once a brainstorm opens it');
    expect(html).not.toContain('<form');
  });

  it('says nothing matches, and keeps the filters, when they leave nothing', () => {
    const html = history({ search: 'nothing like it' });
    expect(html).toContain('No PRD matches');
    expect(html).toContain('<form');
    expect(html).not.toContain('dossier-history-row');
  });
});

describe('the sign-in', () => {
  it('says the history lists the PRDs of the person\'s workspaces', () => {
    const html = renderToStaticMarkup(createElement(DossierSignIn, { supabase: SUPABASE, returnPath: '/prd/callback', error: null, what: 'history' }));
    expect(html).toContain('Sign in to see your workspace&#x27;s PRDs');
    expect(html).toContain('>Sign in with Google</button>');
    expect(html).not.toContain('Sign in to read this PRD');
  });
});
