import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { group } from 'omni-loop/kit/lib/narrow.ts';
import { demoProductHome, NO_PRDS, ProductHome, type ProductHomeTab, type ProductHomeView } from './ProductHome';
import { EMPTY as EMPTY_TABS } from './HomeTabs';
import { DEMO_CHANGES_NOTHING, pressArchive, pressRestore, type PressDeps } from './ArchiveControls';
import type { ArchiveResult } from './product-archive.client';
import type { ProductHome as Home } from './product-home.service';

// /app/products/<id> as the server renders it (PRD 1364 s9): the Ledger, its summary and three lanes, each
// row its number or seal, ◆/◇ and its repository, its PR chips and one state word; the PRDs tab, newest
// first; the empty product; and the situations, signed out among them. Since s10, the Ideas, Roadmap, Bug
// fixes, Visual fixes and Questions tabs, filled and empty.

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const render = (view: ProductHomeView, tab: ProductHomeTab = 'ledger') => renderToStaticMarkup(createElement(ProductHome, { view, tab }));
const tabs = (html: string) => [...html.matchAll(/(<a class="section-tab"[^>]*>)([\s\S]*?)<\/a>/g)].map((m) => ({ tab: m[1], text: text(group(m, 2)) }));
const laneText =(html: string, lane: string) => text(new RegExp(`<section[^>]*data-lane="${lane}"[^>]*>([\\s\\S]*?)</section>`).exec(html)?.[1] ?? '');

const FILLED = demoProductHome('demo-product-1');
if (FILLED === null) throw new Error('the demo has a product home');
const EMPTY: Home = {
  product: { id: 'p-empty', name: 'Estimates' },
  ledger: { lanes: { 'on-you': [], 'on-review': [], 'on-agent': [] }, summary: { building: 0, waitingOnPerson: 0, drifted: 0 } },
  prds: [],
  ideas: [],
  roadmaps: [],
  bugs: [],
  visuals: [],
  questions: [],
  repositories: [],
  flights: [],
  tethers: [],
  owner: false,
  archived: null,
};

describe('the Ledger, filled', () => {
  const html = render({ kind: 'home', home: FILLED });

  it('names the product, then opens on the Ledger tab, counting what waits on you', () => {
    expect(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1]).toBe('Widgets');
    expect(tabs(html)).toEqual([
      { tab: '<a class="section-tab" aria-label="Ledger: 2 waiting" aria-current="page" href="/app/products/demo-product-1">', text: 'Ledger 2' },
      { tab: '<a class="section-tab" href="/app/products/demo-product-1/constellation">', text: 'Constellation' },
      { tab: '<a class="section-tab" href="/app/products/demo-product-1/prds">', text: 'PRDs' },
      { tab: '<a class="section-tab" href="/app/products/demo-product-1/ideas">', text: 'Ideas' },
      { tab: '<a class="section-tab" href="/app/products/demo-product-1/roadmap">', text: 'Roadmap' },
      { tab: '<a class="section-tab" href="/app/products/demo-product-1/bugs">', text: 'Bug fixes' },
      { tab: '<a class="section-tab" href="/app/products/demo-product-1/visual">', text: 'Visual fixes' },
      { tab: '<a class="section-tab" aria-label="Questions: 3 waiting" href="/app/products/demo-product-1/questions">', text: 'Questions 3' },
      { tab: '<a class="section-tab" href="/app/products/demo-product-1/knowledge">', text: 'Knowledge' },
      { tab: '<a class="section-tab" href="/app/products/demo-product-1/repositories">', text: 'Repositories & approvers' },
    ]);
  });

  it('shows the summary of building, waiting on a person and drifted', () => {
    expect(text(/<section class="product-home-summary"[^>]*>([\s\S]*?)<\/section>/.exec(html)?.[1] ?? '')).toBe('2 building 3 waiting on a person 1 drifted');
  });

  it('lays the rows in three lanes, each with its number, birthplace, repository, chips and state word', () => {
    expect(laneText(html, 'on-you')).toBe('On you 918 Offline photo upload ◆ acme/widgets approval 912 Quotes on the phone ◇ acme/widgets Round per line or on the total? question');
    expect(laneText(html, 'on-review')).toBe('On GitHub review 910 Faster search ◇ acme/widgets widgets #101 review');
    expect(laneText(html, 'on-agent')).toBe('On the agent 905 Invoice reminders ◆ acme/widgets widgets-api #447 widgets #94 building');
  });

  it('seals a PRD whose approval is in force, and links each PR chip to GitHub and each title to the PRD page', () => {
    expect(html).toMatch(/<span class="product-home-n" data-sealed="true" title="approved">905<\/span>/);
    expect(html).toMatch(/<span class="product-home-n">918<\/span>/);
    expect(html).toContain('href="https://github.com/acme/widgets-api/pull/447"');
    expect(html).toContain('href="/prd/demo-d-905"');
  });
});

describe('the PRDs tab', () => {
  it('lists every PRD, newest first, with its birthplace and state word, the PRDs tab current', () => {
    const html = render({ kind: 'home', home: FILLED }, 'prds');
    expect(tabs(html).map((t) => t.tab).slice(0, 4)).toEqual([
      '<a class="section-tab" aria-label="Ledger: 2 waiting" href="/app/products/demo-product-1">',
      '<a class="section-tab" href="/app/products/demo-product-1/constellation">',
      '<a class="section-tab" aria-current="page" href="/app/products/demo-product-1/prds">',
      '<a class="section-tab" href="/app/products/demo-product-1/ideas">',
    ]);
    expect([...html.matchAll(/<li class="product-home-row"[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(group(m, 1)))).toEqual([
      '918 Offline photo upload ◆ acme/widgets PRD',
      '912 Quotes on the phone ◇ acme/widgets building',
      '910 Faster search ◇ acme/widgets outbox',
      '905 Invoice reminders ◆ acme/widgets building',
      '890 Dark mode ◇ acme/widgets shipped',
      '920 Single sign-on ◆ acme/widgets-web inbox',
    ]);
  });
});

describe('the Ideas, Roadmap, Bug fixes, Visual fixes and Questions tabs, filled (s10)', () => {
  const rowsOf = (html: string) => [...html.matchAll(/<li class="product-home-row"[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(group(m, 1)));
  const current = (html: string) => tabs(html).find((t) => t.tab?.includes('aria-current="page"') === true)?.text;

  it('lists the product\'s ideas, each with its repository, PRD, pitch, brainstorm line and lane, linking to its board', () => {
    const html = render({ kind: 'home', home: FILLED }, 'ideas');
    expect(current(html)).toBe('Ideas');
    expect(rowsOf(html)).toEqual([
      'idea Offline mode acme/widgets Work on site without a signal. /omni:brainstorm \'Offline mode: Work on site without a signal.\' Next',
      'idea Photo upload acme/widgets PRD 918 Attach site photos to a quote. /omni:brainstorm \'Photo upload: Attach site photos to a quote.\' Now',
    ]);
    expect(html).toContain('href="/ideas/acme/widgets"');
  });

  it('names a lane no board has as it is stored', () => {
    const home: Home = { ...EMPTY, ideas: [{ id: 'i-1', repo: 'a/b', title: 'T', pitch: 'P.', lane: 'someday', prd: null }] };
    expect(rowsOf(render({ kind: 'home', home }, 'ideas'))).toEqual(['idea T a/b P. /omni:brainstorm \'T: P.\' someday']);
  });

  it('lists the product\'s roadmaps, each with its milestone and target date, opening its page', () => {
    const html = render({ kind: 'home', home: FILLED }, 'roadmap');
    expect(current(html)).toBe('Roadmap');
    expect(rowsOf(html)).toEqual(['880 Invoices that pay themselves acme/widgets A customer pays an invoice from its email in one click. 2027-01-31']);
    expect(html).toContain('href="/roadmaps/2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d"');
  });

  it('lists the product\'s bug fixes, each opening its page', () => {
    const html = render({ kind: 'home', home: FILLED }, 'bugs');
    expect(current(html)).toBe('Bug fixes');
    expect(rowsOf(html)).toEqual(['bug Totals round twice acme/widgets 2026-10-03']);
    expect(html).toContain('href="/bugs/demo-bug-1"');
  });

  it('lists the product\'s visual fixes, each opening its page', () => {
    const home: Home = { ...EMPTY, visuals: [{ dossier: 'd-v1', repo: 'acme/web', title: 'Darker sidebar', created: '2026-10-04T00:00:00Z' }] };
    const html = render({ kind: 'home', home }, 'visual');
    expect(current(html)).toBe('Visual fixes');
    expect(rowsOf(html)).toEqual(['vis Darker sidebar acme/web 2026-10-04']);
    expect(html).toContain('href="/visual/d-v1"');
  });

  it('lists each open question with its PRD, its repository and who it is for: a product PRD\'s with its options and "other", a repository PRD\'s linking to its Outbox tab (PRD 1548 s9)', () => {
    const html = render({ kind: 'home', home: FILLED, demo: true }, 'questions');
    expect(current(html)).toBe('Questions 3');
    const questions = [...html.matchAll(/<li class="product-home-row questions-row"[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(group(m, 1)));
    expect(questions).toEqual([
      'widgets-12 Photos taken offline: send them on Wi-Fi only, or on any network? acme/mobile s2-01-upload-network for you Offline photo upload A · On Wi-Fi only (built). B · On any network, mobile data included. other… high',
      'widgets-12 Keep the full-size photo once the site report has its copy? acme/api s3-02-keep-originals for irisa Offline photo upload A · Keep it for 30 days (built). B · Keep it for good. C · Delete it at once. other… medium',
      '912 Round per line or on the total? acme/widgets s2-01 for you Quotes on the phone Answer on its Outbox tab → high',
    ]);
    expect(html).toContain('href="/prd/demo-d-912?tab=outbox"');
    expect(html).toContain('href="/prd/demo-d-918"');
  });
});

describe('the Ideas, Roadmap, Bug fixes, Visual fixes and Questions tabs, empty (s10)', () => {
  it.each([
    ['ideas', EMPTY_TABS.ideas], ['roadmap', EMPTY_TABS.roadmap], ['bugs', EMPTY_TABS.bugs], ['visual', EMPTY_TABS.visual], ['questions', EMPTY_TABS.questions],
  ] as const)('says the %s tab has nothing', (tab, words) => {
    const html = render({ kind: 'home', home: EMPTY }, tab);
    expect(text(html)).toContain(words);
    expect(html).not.toContain('product-home-row');
  });
});

describe('the product home, empty', () => {
  it('says no PRD carries the product, and every lane that nothing waits there', () => {
    const html = render({ kind: 'home', home: EMPTY });
    expect(text(html)).toContain(NO_PRDS);
    expect(laneText(html, 'on-you')).toBe('On you Nothing waits on you.');
    expect(laneText(html, 'on-review')).toBe('On GitHub review Nothing waits on a review.');
    expect(laneText(html, 'on-agent')).toBe('On the agent Nothing waits on the agent.');
    expect(html).not.toContain('aria-label="Ledger:');
  });

  it('says so on the PRDs tab too', () => {
    expect(text(render({ kind: 'home', home: EMPTY }, 'prds'))).toContain(NO_PRDS);
  });
});

describe('the product home\'s situations', () => {
  it('asks a signed-out person to sign in, and draws no tab', () => {
    const html = render({ kind: 'sign-in' });
    expect(text(html)).toContain('Sign in to see your products');
    expect(html).not.toContain('section-tab');
  });

  it('says when the product is not found, the deployment is closed, or the reads failed', () => {
    expect(text(render({ kind: 'not-found' }))).toContain('No such product');
    expect(text(render({ kind: 'closed' }))).toContain('Products are not open here');
    expect(text(render({ kind: 'unreadable' }))).toContain('Couldn’t load your products');
    expect(text(render({ kind: 'no-workspace' }))).toContain('Your account is not in a workspace');
  });
});

describe('archive a product (PRD 2232 s1)', () => {
  const NOW = Date.parse('2026-10-20T12:00:00Z');
  const OWNED: Home = { ...FILLED, owner: true, archived: null };
  const ARCHIVED: Home = { ...FILLED, owner: true, archived: { at: '2026-10-18T09:00:00Z', by: 'pierrederval' } };
  const at = (home: Home, tab: ProductHomeTab = 'ledger') => renderToStaticMarkup(createElement(ProductHome, { view: { kind: 'home', home }, tab, now: NOW }));
  const head = (html: string) => /<section class="ask-card products-head"[^>]*>([\s\S]*?)<\/section>/.exec(html)?.[1] ?? '';
  const banner = (html: string) => /<section class="product-home-archived" aria-label="Archived">([\s\S]*?)<\/section>/.exec(html)?.[1] ?? '';

  it('gives an owner a quiet Archive beside the product\'s name, in the head card', () => {
    const html = at(OWNED);
    expect(head(html)).toContain('<button type="button" class="ask-button quiet product-home-archive-button" aria-label="Archive Widgets">Archive</button>');
    expect(html).not.toContain('data-primary');
    expect(html).not.toContain('Restore');
  });

  it('gives a member no Archive', () => {
    expect(at({ ...OWNED, owner: false })).not.toContain('Archive');
  });

  it('opens the Ledger under its seven-word lede', () => {
    expect(text(head(at(OWNED)))).toBe('← Products Widgets Archive What waits on whom across its PRDs.');
  });

  it('draws an archived product read-only, under its banner with Restore, the one primary action, and no Archive', () => {
    const html = at(ARCHIVED);
    expect(text(banner(html))).toBe('Archived 2 days ago by pierrederval. Restore');
    expect(banner(html)).toContain('<button type="button" class="ask-button" aria-label="Restore Widgets" data-primary="true">Restore</button>');
    expect(html.indexOf('product-home-archived')).toBeLessThan(html.indexOf('products-head'));
    expect(head(html)).not.toContain('Archive');
    expect(html.match(/data-primary/g)).toHaveLength(1);
  });

  it('keeps an archived product\'s tabs that change nothing, and opens the Ledger for one it leaves out', () => {
    expect(tabs(at(ARCHIVED)).map((t) => t.text)).toEqual(['Ledger 2', 'Constellation', 'PRDs', 'Ideas', 'Roadmap', 'Bug fixes', 'Visual fixes']);
    const questions = at(ARCHIVED, 'questions');
    expect(questions).toContain('data-lane="on-you"');
    expect(questions).not.toContain('Questions');
  });

  it('names nobody when it does not know who archived it', () => {
    expect(text(banner(at({ ...ARCHIVED, archived: { at: '2026-10-20T11:15:00Z', by: null } })))).toBe('Archived 45 minutes ago. Restore');
  });
});

describe('pressing Archive and Restore (PRD 2232 s1)', () => {
  const REPOS = ['vertuoza/vertuo-omni-loop', 'demo-org/omni-docs'];
  function deps(confirmed: boolean, answer: ArchiveResult, demo = false) {
    const asked: string[] = [];
    const calls: string[] = [];
    const gone: (string | null)[] = [];
    const d: PressDeps = {
      confirm: (message) => { asked.push(message); return confirmed; },
      port: () => ({
        archive: () => { calls.push('archive'); return Promise.resolve(answer); },
        restore: () => { calls.push('restore'); return Promise.resolve(answer); },
      }),
      go: (href) => { gone.push(href); },
      demo,
    };
    return { asked, calls, gone, d };
  }
  const ARCHIVED_ANSWER: ArchiveResult = { ok: true, product: { id: 'p-1', name: 'omni-loop', archivedAt: '2026-10-20T09:00:00Z' } };

  it('asks first with the spec\'s words, naming the repositories, and changes nothing when cancelled', async () => {
    const { asked, calls, gone, d } = deps(false, ARCHIVED_ANSWER);
    expect(await pressArchive('omni-loop', REPOS, d)).toBeNull();
    expect(asked).toEqual(['Archive omni-loop? It leaves every member\'s list, and its repositories stop reading its Legal entries and glossary.'
      + '\n\nRepositories: vertuoza/vertuo-omni-loop, demo-org/omni-docs']);
    expect(calls).toEqual([]);
    expect(gone).toEqual([]);
  });

  it('archives once confirmed, and lands on the products page', async () => {
    const { calls, gone, d } = deps(true, ARCHIVED_ANSWER);
    expect(await pressArchive('omni-loop', [], d)).toBeNull();
    expect(calls).toEqual(['archive']);
    expect(gone).toEqual(['/app/products']);
  });

  it('shows a refusal in the route\'s words, and stays', async () => {
    const { gone, d } = deps(true, { ok: false, message: 'Only an owner of the workspace archives omni-loop.' });
    expect(await pressArchive('omni-loop', [], d)).toBe('Only an owner of the workspace archives omni-loop.');
    expect(gone).toEqual([]);
  });

  it('restores, then shows the live home again; a refusal stays on the page', async () => {
    const restored = deps(true, { ok: true, product: { id: 'p-1', name: 'omni-loop', archivedAt: null } });
    expect(await pressRestore(restored.d)).toBeNull();
    expect(restored.calls).toEqual(['restore']);
    expect(restored.gone).toEqual([null]);
    const refused = deps(true, { ok: false, message: 'Nothing changed. Check your connection and try again.' });
    expect(await pressRestore(refused.d)).toBe('Nothing changed. Check your connection and try again.');
    expect(refused.gone).toEqual([]);
  });

  it('sends nothing in the demo', async () => {
    const archive = deps(true, ARCHIVED_ANSWER, true);
    expect(await pressArchive('Widgets', [], archive.d)).toBe(DEMO_CHANGES_NOTHING);
    expect(await pressRestore(archive.d)).toBe(DEMO_CHANGES_NOTHING);
    expect(archive.calls).toEqual([]);
  });
});
