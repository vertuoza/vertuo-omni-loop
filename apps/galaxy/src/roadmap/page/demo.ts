// The demo's roadmaps (PRD 1162), for development, OMNI_LOOP_DEMO=1 and a person signed out: two
// roadmaps of two products. Crew's runs across four repositories of a plan repository, one PRD merged
// (so its Gantt is on dates, projected from that PRD's length), one waiting for a merge, two building,
// one held on the pull request it waits on and one parked on a question only a person answers. Billing's
// runs in one repository and nothing merged yet, so its bars sit in wave columns. Every time is counted
// back from `now`, so the same `now` draws the same page.
import { parseIssue, parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { RoadmapPrdRow, RoadmapRow } from '../store';
import { detailOf, listOf, type Demo, type ProductRef, type RoadmapPageView } from './model';

const DAY = 86_400_000;
const DEMO_NAME = 'Acme';

/** The demo roadmap that runs across repositories. */
export const DEMO_ROADMAP = '7d3c2b1a-0f9e-4d8c-8b7a-6f5e4d3c2b1a';
/** The demo roadmap in one repository, nothing merged yet. */
export const DEMO_ROADMAP_ONE_REPO = '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d';

export const DEMO_PRODUCTS: ProductRef[] = [
  { id: 'c1a2b3c4-d5e6-4f70-8a9b-0c1d2e3f4a5b', name: 'Crew' },
  { id: 'b1a2b3c4-d5e6-4f70-8a9b-0c1d2e3f4a5b', name: 'Billing' },
  { id: 'a1a2b3c4-d5e6-4f70-8a9b-0c1d2e3f4a5b', name: 'Mobile' },
];
const [CREW, BILLING] = DEMO_PRODUCTS;

function rowsAt(now: number) {
  const at = (days: number) => new Date(now + days * DAY).toISOString();
  const roadmap = (over: Partial<RoadmapRow> & Pick<RoadmapRow, 'id' | 'repo' | 'number' | 'title' | 'milestone'>): RoadmapRow => ({
    workspace_id: 'demo', product_id: null, target_date: null, source: null, questions: [], document: '', pushed_by: null,
    created_at: at(-21), pushed_at: at(-0.01), ...over,
  });
  let position = 0;
  const prd = (roadmapId: string, over: Partial<RoadmapPrdRow> & Pick<RoadmapPrdRow, 'row_id' | 'prd' | 'title' | 'wave'>): RoadmapPrdRow => ({
    roadmap_id: roadmapId, position: ++position, repos: [], blockers: [], state: 'waiting', waits_on: null, waits_on_url: null,
    started_at: null, ended_at: null, ...over,
  });
  const crew = roadmap({
    id: DEMO_ROADMAP, repo: 'acme/crew-plan', number: parseIssue(1200), title: 'Crew — from skeleton to earned autonomy',
    milestone: 'A company grants its first mandate after a trial week.', product_id: CREW?.id ?? null, target_date: '2027-03-31',
    source: 'https://acme.example/crew-plan',
    questions: [
      { id: 'Q2', question: 'Does a persona keep its memory across companies?', recommendation: 'No: one memory per company.', blocks: ['P2.2'], kind: 'default', answer: null },
      { id: 'Q5', question: 'Who may grant a mandate: the owner only, or any admin?', recommendation: 'The owner only, for the first release.', blocks: ['P4.4'], kind: 'person', answer: null },
    ],
  });
  const one = roadmap({
    id: DEMO_ROADMAP_ONE_REPO, repo: 'acme/widgets', number: parseIssue(880), title: 'Invoices that pay themselves',
    milestone: 'A customer pays an invoice from its email in one click.', product_id: BILLING?.id ?? null, pushed_at: at(-1),
  });
  const pr = (repo: string, n: number) => `https://github.com/acme/${repo}/pull/${n}`;
  const crewPrds = [
    prd(DEMO_ROADMAP, { row_id: 'P1.1', prd: parsePrd(1201), title: 'Crew API and worker skeleton', repos: ['crew'], wave: 1, state: 'merged', started_at: at(-20), ended_at: at(-15) }),
    prd(DEMO_ROADMAP, {
      row_id: 'P1.2', prd: parsePrd(1202), title: 'Personas', repos: ['crew'], wave: 1, state: 'ready', started_at: at(-12),
      waits_on: 'acme/crew#44 (P1.2 Personas): ready, waiting for your merge', waits_on_url: pr('crew', 44),
    }),
    prd(DEMO_ROADMAP, { row_id: 'P2.2', prd: parsePrd(1205), title: 'Crew panel', repos: ['crew', 'ux-research'], blockers: ['P1.1'], wave: 2, state: 'building', started_at: at(-4) }),
    prd(DEMO_ROADMAP, { row_id: 'P3.4', prd: parsePrd(1213), title: 'Stateless think endpoint', repos: ['ai-domain'], blockers: ['P1.1'], wave: 2, state: 'outbox', started_at: at(-6) }),
    prd(DEMO_ROADMAP, {
      row_id: 'P4.3', prd: parsePrd(1220), title: 'Messages', repos: ['workflow'], blockers: ['P3.4', 'P1.2'], wave: 3,
      waits_on: 'waits on acme/ai-domain#310 (P3.4 Stateless think endpoint): outbox: 2 questions', waits_on_url: pr('ai-domain', 310),
    }),
    prd(DEMO_ROADMAP, { row_id: 'P4.4', prd: parsePrd(1221), title: 'Mandates', repos: ['crew'], blockers: ['P4.3'], wave: 4 }),
  ];
  const onePrds = [
    prd(DEMO_ROADMAP_ONE_REPO, { row_id: 'P1', prd: parsePrd(881), title: 'Invoice links', wave: 1, state: 'building', started_at: at(-2) }),
    prd(DEMO_ROADMAP_ONE_REPO, {
      row_id: 'P2', prd: parsePrd(882), title: 'Payment page', blockers: ['P1'], wave: 2,
      waits_on: 'waits on acme/widgets#890 (P1 Invoice links): building wave 2/3', waits_on_url: 'https://github.com/acme/widgets/pull/890',
    }),
    prd(DEMO_ROADMAP_ONE_REPO, { row_id: 'P3', prd: parsePrd(883), title: 'Reminders', blockers: ['P1'], wave: 2 }),
  ];
  return [{ row: crew, prds: crewPrds }, { row: one, prds: onePrds }];
}

/** The demo's Roadmaps page: the list (`id` null), one product's when `product` is set, or the roadmap
 * `id` opened; null for an id it does not hold. */
export function demoRoadmapPage(now: Date, ask: { id: string | null; product: string | null }, demo: Exclude<Demo, null>): RoadmapPageView | null {
  const rows = rowsAt(now.getTime());
  if (ask.id === null) return listOf(DEMO_NAME, demo, rows, DEMO_PRODUCTS, ask.product);
  const found = rows.find((r) => r.row.id === ask.id);
  if (!found) return null;
  return { kind: 'roadmap', name: DEMO_NAME, demo, roadmap: detailOf(found.row, found.prds, DEMO_PRODUCTS, now.getTime()) };
}
