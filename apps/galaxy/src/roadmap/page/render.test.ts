import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { present } from '../../ask/test/test-item';
import { DEMO_PRODUCTS, DEMO_ROADMAP, DEMO_ROADMAP_ONE_REPO, demoRoadmapPage } from './demo';
import type { RoadmapPageView } from './model';
import { prerequisitesOf, type TickAsk } from './prerequisites';
import type { RoadmapPrerequisiteRow } from '../store';
import { RoadmapsScreen } from './RoadmapsScreen';

// /roadmaps as the server renders it (PRD 1162), to static markup, on the demo's roadmaps: the list,
// filtered by product; one roadmap opened with its milestone, its Gantt, its questions (the answer box
// for a `person` one) and links to each PRD's page; the empty state naming /omni:roadmap; signed out,
// the demo under a sign-in card; and the situations before the list.

const NOW = new Date('2026-10-20T12:00:00Z');
const SUPABASE = { url: 'https://db.example', key: 'anon' };
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/\s+/g, ' ').trim();
const render = (view: RoadmapPageView, supabase: { url: string; key: string } | null = null) =>
  renderToStaticMarkup(createElement(RoadmapsScreen, { view, supabase, signinError: null }));
const list = (product: string | null = null, demo: 'development' | 'signed-out' = 'development') =>
  present(demoRoadmapPage(NOW, { id: null, product }, demo), 'the demo list');
const opened = (id = DEMO_ROADMAP, tab: 'overview' | 'prerequisites' = 'overview') => present(demoRoadmapPage(NOW, { id, product: null, tab }, 'development'), 'the demo roadmap');
const [CREW, BILLING, MOBILE] = DEMO_PRODUCTS;

describe('the list of roadmaps', () => {
  const html = render(list());
  const t = text(html);

  it('is headed by the workspace\'s name, and lists every roadmap with its milestone and a link to its page', () => {
    expect(html).toContain('<h1 class="dash-name">Acme</h1>');
    expect(t).toContain('Crew — from skeleton to earned autonomy');
    expect(t).toContain('A company grants its first mandate after a trial week.');
    expect(t).toContain('Invoices that pay themselves');
    expect(html).toContain(`href="/roadmaps/${DEMO_ROADMAP}"`);
    expect(html).toContain(`href="/roadmaps/${DEMO_ROADMAP_ONE_REPO}"`);
  });

  it('shows each roadmap\'s progress and what blocks it now', () => {
    expect(t).toContain('1 of 6 merged');
    expect(t).toContain('1 waits on your merge');
    expect(t).toContain('Q5 waits for a person\'s answer');
    expect(t).toContain('waits on acme/ai-domain#310 (P3.4 Stateless think endpoint): outbox: 2 questions');
    expect(t).toContain('0 of 3 merged');
  });

  it('offers every product that files a roadmap as a filter, every product current', () => {
    const filter = present(/<nav class="roadmap-filter"[\s\S]*?<\/nav>/.exec(html)?.[0], 'the filter');
    expect(text(filter)).toBe('Every product 2 Crew 1 Billing 1');
    expect(filter).toContain(`href="/roadmaps?product=${CREW?.id ?? ''}"`);
    expect(filter).toMatch(/aria-current="page"[^>]*>Every product|class="roadmap-chip is-current" aria-current="page">Every product/);
    expect(text(filter)).not.toContain(MOBILE?.name ?? 'Mobile');
  });

  it('shows only one product\'s roadmaps once filtered, that product current', () => {
    const filtered = render(list(BILLING?.id ?? null));
    expect(text(filtered)).toContain('Invoices that pay themselves');
    expect(text(filtered)).not.toContain('Crew — from skeleton');
    expect(filtered).toMatch(/class="roadmap-chip is-current" aria-current="page">Billing/);
  });

  it('names /omni:roadmap when the workspace has no roadmap, and says so for a product with none', () => {
    const empty = text(render({ kind: 'list', name: 'Acme', demo: null, products: [], roadmaps: [], filtered: false }));
    expect(empty).toContain('No roadmap in this workspace yet.');
    expect(empty).toContain('/omni:roadmap <source>');
    expect(text(render({ kind: 'list', name: 'Acme', demo: null, products: [], roadmaps: [], filtered: true }))).toContain('No roadmap of this product yet.');
  });
});

describe('one roadmap opened', () => {
  const html = render(opened());
  const t = text(html);

  it('leads back to every roadmap, and shows its milestone, its progress and its issue', () => {
    expect(html).toContain('href="/roadmaps"');
    expect(html).toContain('<h1 class="dash-name">Crew — from skeleton to earned autonomy</h1>');
    expect(t).toContain('Milestone: A company grants its first mandate after a trial week.');
    expect(t).toContain('target 2027-03-31');
    expect(html).toContain('href="https://github.com/acme/crew-plan/issues/1200"');
  });

  it('draws its Gantt: a row per PRD under its wave, an arrow per blocker, bars by state, dashed where projected, a lane per repository', () => {
    const svg = present(/<svg class="roadmap-gantt"[\s\S]*?<\/svg>/.exec(html)?.[0], 'the Gantt');
    expect([...svg.matchAll(/data-row="([^"]+)"/g)].map((m) => m[1])).toEqual(['P1.1', 'P1.2', 'P2.2', 'P3.4', 'P4.3', 'P4.4']);
    expect([...svg.matchAll(/class="roadmap-wave"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(['Wave 1', 'Wave 2', 'Wave 3', 'Wave 4']);
    expect([...svg.matchAll(/data-arrow="([^"]+)"/g)].map((m) => m[1])).toEqual(['P1.1→P2.2', 'P1.1→P3.4', 'P1.2→P4.3', 'P3.4→P4.3', 'P4.3→P4.4']);
    for (const state of ['merged', 'ready', 'building', 'outbox', 'waiting']) expect(svg).toContain(`roadmap-bar is-${state}`);
    expect(svg).toContain('roadmap-seg is-projected');
    expect(svg).toContain('roadmap-seg is-real');
    expect(text(svg)).toContain('crew · building');
    expect(text(svg)).toContain('ux-research · building');
    expect(t).toContain('dashed bars are projected from the median length of this roadmap\'s merged PRDs');
  });

  it('puts the pull request a held PRD waits on on its bar, linked', () => {
    const svg = present(/<svg class="roadmap-gantt"[\s\S]*?<\/svg>/.exec(html)?.[0], 'the Gantt');
    expect(svg).toMatch(/<text class="roadmap-waits"[^>]*><a href="https:\/\/github.com\/acme\/ai-domain\/pull\/310">waits on acme\/ai-domain#310/);
  });

  it('links each PRD to its page', () => {
    for (const prd of [1201, 1202, 1205, 1213, 1220, 1221]) expect(html).toContain(`href="/prd/at/acme/crew-plan/${prd}?to=page"`);
  });

  it('lists its open questions, with an answer box only for a `person` one not answered', () => {
    expect(t).toContain('Q2 Does a persona keep its memory across companies?');
    expect(t).toContain('Recommended: No: one memory per company. (runs on it)');
    expect(t).toContain('Q5 Who may grant a mandate');
    expect([...html.matchAll(/<textarea id="([^"]+)"/g)].map((m) => m[1])).toEqual(['roadmap-answer-Q5']);
    expect(t).toContain('omni roadmap answer 1200 Q5 "…"');
  });

  it('sits each bar in its wave, without dates, before any PRD merged', () => {
    const one = render(opened(DEMO_ROADMAP_ONE_REPO));
    expect(one).toContain('roadmap-seg is-wave');
    expect(one).not.toContain('is-projected');
    expect(text(one)).toContain('No PRD has merged yet, so nothing is dated: each bar sits in its wave.');
    expect(text(one)).not.toContain(' · crew');
  });
});

describe('one roadmap\'s tabs', () => {
  it('opens on Overview, today\'s page, with a Prerequisites tab counting what waits on you', () => {
    const html = render(opened());
    const tabs = present(/<nav class="roadmap-tabs"[\s\S]*?<\/nav>/.exec(html)?.[0], 'the tabs');
    expect(text(tabs)).toBe('Overview Prerequisites 2');
    expect(tabs).toContain(`href="/roadmaps/${DEMO_ROADMAP}" aria-current="page">Overview`);
    expect(tabs).toContain(`href="/roadmaps/${DEMO_ROADMAP}?tab=prerequisites">Prerequisites`);
    expect(text(html)).toContain('Gantt');
    expect(text(html)).not.toContain('2 wait on you');
  });

  it('shows on Prerequisites the count line and the rows grouped by category, those waiting on you first', () => {
    const html = render(opened(DEMO_ROADMAP, 'prerequisites'));
    const t = text(html);
    expect(html).toContain(`href="/roadmaps/${DEMO_ROADMAP}?tab=prerequisites" aria-current="page">Prerequisites`);
    expect(t).not.toContain('Gantt');
    expect(t).toContain('4 ok · 1 fixed · 2 wait on you');
    expect([...html.matchAll(/data-category="([^"]+)"/g)].map((m) => m[1])).toEqual(['local', 'permissions', 'access', 'github', 'services']);
    expect([...html.matchAll(/data-prereq="([^"]+)"/g)].map((m) => m[1])).toEqual(['p5', 'p2', 'p6', 'p1', 'p3', 'p4', 'p7']);
  });

  it('opens the card of a row waiting on you: why, the command with a Copy button, what it does, who can do it', () => {
    const html = render(opened(DEMO_ROADMAP, 'prerequisites'));
    const p5 = present(/<li class="roadmap-prereq is-waits" data-prereq="p5">[\s\S]*?<\/li>/.exec(html)?.[0], 'p5');
    expect(p5).toContain('<details class="roadmap-prereq-card" open="">');
    const t = text(p5);
    expect(t).toContain('waits on you p5 Docker is running, for the database tests');
    expect(t).toContain('blocks P2.2, P3.4 · the agent checks it, a person fixes it · last checked on mbp-irisa, 2026-10-20 11:52 UTC');
    expect(t).toContain('Why The tests for this roadmap start a database in Docker.');
    expect(p5).toContain('<code id="roadmap-prereq-p5-command">open -a Docker</code><button type="button" class="ask-button quiet">Copy</button>');
    expect(t).toContain('What it does Starts the Docker app on your Mac.');
    expect(t).toContain('Who can do it Anyone with this laptop.');
    const p1 = present(/<li class="roadmap-prereq is-ok" data-prereq="p1">[\s\S]*?<\/li>/.exec(html)?.[0], 'p1');
    expect(p1).toContain('<details class="roadmap-prereq-card">');
    expect(text(p1)).toContain('blocks every PRD');
  });

  it('says so in one line for a roadmap without prerequisites', () => {
    const html = render(opened(DEMO_ROADMAP_ONE_REPO, 'prerequisites'));
    expect(text(html)).toContain('This roadmap names no prerequisite: its roadmap.md has no ## Prerequisites section.');
    expect(html).not.toContain('data-prereq=');
    expect(text(present(/<nav class="roadmap-tabs"[\s\S]*?<\/nav>/.exec(html)?.[0], 'the tabs'))).toBe('Overview Prerequisites');
  });
});

describe('signed out', () => {
  it('shows the demo under a sign-in card that comes back to /roadmaps', () => {
    const html = render(list(null, 'signed-out'), SUPABASE);
    expect(text(html)).toContain('Sign in to see your roadmaps');
    expect(text(html)).toContain('Below is a demo.');
    expect(text(html)).toContain('Crew — from skeleton to earned autonomy');
    expect(html.indexOf('Sign in to see your roadmaps')).toBeLessThan(html.indexOf('Crew — from skeleton'));
  });

  it('shows no sign-in card for the demo in development', () => {
    expect(text(render(list(), SUPABASE))).not.toContain('Sign in to see your roadmaps');
  });
});

describe('before the list', () => {
  it('says the page is not open where there is no database', () => {
    expect(text(render({ kind: 'closed' }))).toContain('Roadmaps are not open here');
  });

  it('tells an account in no workspace that roadmaps are for members', () => {
    expect(text(render({ kind: 'no-workspace' }, SUPABASE))).toContain('Roadmaps is for the members of a workspace');
  });

  it('says the roadmaps could not be read', () => {
    expect(text(render({ kind: 'unreadable' }))).toContain('The roadmaps could not be read.');
  });
});

describe('Mark as done on the Prerequisites tab (s7)', () => {
  const CARD = { why: 'The preview reads the database.', command: 'vercel env add DATABASE_URL preview', whatItDoes: 'Saves the address.', whoCanDoIt: 'An admin of the Vercel project.' };
  const rows: RoadmapPrerequisiteRow[] = [
    { roadmap_id: DEMO_ROADMAP, position: 1, row_id: 'p5', category: 'local', need: 'Docker runs', check_with: 'base:docker', fix_with: null, blocks_all: true, blocks: [], who: 'check', repos: [], card: CARD, state: 'waits', detail: null },
    { roadmap_id: DEMO_ROADMAP, position: 2, row_id: 'p6', category: 'permissions', need: 'the preview has DATABASE_URL', check_with: null, fix_with: null, blocks_all: false, blocks: ['P4.3'], who: 'person', repos: [], card: CARD, state: 'waits', detail: null },
  ];
  const withTick = (tick: TickAsk): RoadmapPageView => {
    const view = opened(DEMO_ROADMAP, 'prerequisites');
    if (view.kind !== 'roadmap') throw new Error(view.kind);
    return { ...view, roadmap: { ...view.roadmap, prerequisites: prerequisitesOf(rows, 'mbp', '2026-10-20T11:58:00Z', tick) } };
  };
  const rowOf = (html: string, id: string) => present(new RegExp(`<li class="roadmap-prereq[^"]*" data-prereq="${id}">[\\s\\S]*?</li>`).exec(html)?.[0], id);

  it('shows the button on a person row to a member, and on no other row', () => {
    const html = render(withTick({ tickable: true, ticked: null, tickError: null }));
    expect(rowOf(html, 'p6')).toMatch(/<button type="button" class="ask-button"[^>]*>Mark as done<\/button>/);
    expect(rowOf(html, 'p5')).not.toContain('Mark as done');
  });

  it('shows no button to anyone else: the demo, or where marking is not open', () => {
    expect(render(opened(DEMO_ROADMAP, 'prerequisites'))).not.toContain('Mark as done');
    expect(render(withTick({ tickable: false, ticked: null, tickError: null }))).not.toContain('Mark as done');
  });

  it('shows the row just ticked as ticked, and why a tick posted nothing', () => {
    const ticked = render(withTick({ tickable: true, ticked: 'p6', tickError: null }));
    expect(text(rowOf(ticked, 'p6'))).toContain('ticked by you: the next check records it');
    expect(ticked).not.toContain('Mark as done');
    const failed = render(withTick({ tickable: true, ticked: null, tickError: 'no-access' }));
    expect(text(failed)).toContain('Your GitHub account may not comment on the roadmap\'s issue, so nothing was posted.');
  });
});
