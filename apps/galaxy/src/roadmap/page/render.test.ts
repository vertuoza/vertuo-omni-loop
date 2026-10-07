import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { present } from '../../ask/test/test-item';
import { DEMO_PRODUCTS, DEMO_ROADMAP, DEMO_ROADMAP_ONE_REPO, demoRoadmapPage } from './demo';
import type { RoadmapPageView } from './model';
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
const opened = (id = DEMO_ROADMAP) => present(demoRoadmapPage(NOW, { id, product: null }, 'development'), 'the demo roadmap');
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
    for (const prd of [1201, 1202, 1205, 1213, 1220, 1221]) expect(html).toContain(`href="/prd/${prd}"`);
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
