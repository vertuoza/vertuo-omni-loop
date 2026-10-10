import Link from 'next/link';
import type { ReactNode } from 'react';
import { Notice } from '../ask/page/Notice';
import { workPath } from '../dossier/page/work';
import { SectionTabs } from '../nav/SectionTabs';
import { SituationNotice, type Situation } from '../products/ProductsScreen';
import { DEMO_ROADMAP_ONE_REPO } from '../roadmap/page/demo';
import { parsePr, parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { BugsTab, IdeasTab, QuestionsTab, RoadmapTab, VisualTab } from './HomeTabs';
import type { Birthplace, HomePrd, LaneId, LedgerRow, ProductHome as Home, PrChip } from './product-home.service';
import { ledeOf, productHomeTabHref, productHomeTabs, type ProductHomeTab } from './tabs';

// The product home, drawn (PRD 1364 s9): /app/products/<id>, the product's name, then its tabs. It opens on
// the Ledger: a summary (building, waiting on a person, drifted), then what waits on whom in three lanes,
// on you, on GitHub review and on the agent, each row its number (sealed once an approval is in force),
// ◆ or ◇ with its repository, its title linking to its PRD page, its PR chips and one state word. The PRDs
// tab (/app/products/<id>/prds) lists every PRD of the product, newest first, with its birthplace and its
// state word. Ideas, Roadmap, Bug fixes, Visual fixes and Questions (s10) are drawn by HomeTabs.tsx, each
// at its own address (tabs.ts). Before the home, every situation of /app/products.

/** Products in the sidebar: where the home goes back to. */
const PRODUCTS_HOME_HREF = '/app/products';

export type { ProductHomeTab };

export type ProductHomeView = Situation | { kind: 'not-found' } | { kind: 'home'; home: Home };

const LANES: readonly { id: LaneId; title: string; empty: string }[] = [
  { id: 'on-you', title: 'On you', empty: 'Nothing waits on you.' },
  { id: 'on-review', title: 'On GitHub review', empty: 'Nothing waits on a review.' },
  { id: 'on-agent', title: 'On the agent', empty: 'Nothing waits on the agent.' },
];

export const NO_PRDS = 'No PRD carries this product yet. A PRD takes its product when it is born, or on its page.';

const BIRTH: Readonly<Record<Birthplace, { mark: string; words: string }>> = {
  server: { mark: '◆', words: 'born on the server' },
  repo: { mark: '◇', words: 'born in the repository' },
};


/** The demo's product home: one PRD on each lane, a shipped one on none. */
export function demoProductHome(id: string): Home | null {
  if (id !== 'demo-product-1') return null;
  const prd = (dossier: string, n: number, title: string, birthplace: Birthplace): HomePrd =>
    ({ dossier, repo: 'acme/widgets', prd: parsePrd(n), title, birthplace });
  const row = (p: HomePrd, over: Partial<LedgerRow>): LedgerRow => ({ ...p, sealed: false, state: 'inbox', question: null, questions: 0, prs: [], ...over });
  const approval = prd('demo-d-918', 918, 'Offline photo upload', 'server');
  const question = prd('demo-d-912', 912, 'Quotes on the phone', 'repo');
  const review = prd('demo-d-910', 910, 'Faster search', 'repo');
  const building = prd('demo-d-905', 905, 'Invoice reminders', 'server');
  const shipped = prd('demo-d-890', 890, 'Dark mode', 'repo');
  return {
    product: { id, name: 'Widgets' },
    ledger: {
      lanes: {
        'on-you': [
          row(approval, { state: 'approval' }),
          row(question, { state: 'question', question: 'Round per line or on the total?', questions: 1 }),
        ],
        'on-review': [row(review, { state: 'review', prs: [{ repo: 'acme/widgets', pr: parsePr(101) }] })],
        'on-agent': [row(building, { state: 'building', sealed: true, prs: [{ repo: 'acme/api', pr: parsePr(447) }, { repo: 'acme/widgets', pr: parsePr(94) }] })],
      },
      summary: { building: 2, waitingOnPerson: 2, drifted: 0 },
    },
    prds: [
      { ...approval, state: 'PRD' }, { ...question, state: 'building' }, { ...review, state: 'outbox' },
      { ...building, state: 'building' }, { ...shipped, state: 'shipped' },
    ],
    ideas: [
      { id: 'demo-i-2', repo: 'acme/widgets', title: 'Offline mode', pitch: 'Work on site without a signal.', lane: 'next', prd: null },
      { id: 'demo-i-1', repo: 'acme/widgets', title: 'Photo upload', pitch: 'Attach site photos to a quote.', lane: 'now', prd: parsePrd(918) },
    ],
    roadmaps: [
      { id: DEMO_ROADMAP_ONE_REPO, number: 880, repo: 'acme/widgets', title: 'Invoices that pay themselves', milestone: 'A customer pays an invoice from its email in one click.', targetDate: '2027-01-31' },
    ],
    bugs: [{ dossier: 'demo-bug-1', repo: 'acme/widgets', title: 'Totals round twice', created: '2026-10-03T09:00:00Z' }],
    visuals: [],
    questions: [{ ...question, id: 's2-01', rank: 'high', question: 'Round per line or on the total?' }],
  };
}

const prdHref = (p: HomePrd) => workPath('prd', p.dossier);
const prHref = (c: PrChip) => `https://github.com/${c.repo}/pull/${String(c.pr)}`;
const shortName = (repo: string) => repo.split('/').at(-1) ?? repo;

function Birth({ prd }: { prd: HomePrd }) {
  const b = BIRTH[prd.birthplace];
  return <span className="products-chip" title={b.words}>{b.mark} {prd.repo}</span>;
}

function Row({ row }: { row: LedgerRow }) {
  return (
    <li className="product-home-row" data-prd={row.prd} data-state={row.state}>
      <span className="product-home-n" data-sealed={row.sealed || undefined} title={row.sealed ? 'approved' : undefined}>{row.prd}</span>
      <span className="product-home-main">
        <Link className="product-home-title" href={prdHref(row)}>{row.title}</Link>
        <span className="product-home-meta">
          <Birth prd={row} />
          {row.prs.map((c) => (
            <a key={`${c.repo}#${String(c.pr)}`} className="products-chip product-home-pr" href={prHref(c)}>{shortName(c.repo)} #{c.pr}</a>
          ))}
          {row.question === null ? null : <span className="product-home-question">{row.question}</span>}
        </span>
      </span>
      <span className="product-home-state">{row.state}</span>
    </li>
  );
}

function Ledger({ home }: { home: Home }) {
  const { summary, lanes } = home.ledger;
  return (
    <>
      <section className="product-home-summary" aria-label="Summary">
        <span><b data-tone="building">{summary.building}</b> building</span>
        <span><b data-tone="waiting">{summary.waitingOnPerson}</b> waiting on a person</span>
        <span><b data-tone="drifted">{summary.drifted}</b> drifted</span>
      </section>
      {home.prds.length === 0 ? <p className="products-empty">{NO_PRDS}</p> : null}
      {LANES.map((lane) => (
        <section key={lane.id} className="products-list product-home-lane" data-lane={lane.id} aria-labelledby={`lane-${lane.id}`}>
          <h2 id={`lane-${lane.id}`}>{lane.title}</h2>
          {lanes[lane.id].length === 0
            ? <p className="products-empty">{lane.empty}</p>
            : <ul>{lanes[lane.id].map((r) => <Row key={r.dossier} row={r} />)}</ul>}
        </section>
      ))}
    </>
  );
}

function Prds({ home }: { home: Home }) {
  if (home.prds.length === 0) return <p className="products-empty">{NO_PRDS}</p>;
  return (
    <section className="products-list product-home-lane" aria-label={`${home.product.name}'s PRDs`}>
      <ul>
        {home.prds.map((p) => (
          <li key={p.dossier} className="product-home-row" data-prd={p.prd} data-state={p.state}>
            <span className="product-home-n">{p.prd}</span>
            <span className="product-home-main">
              <Link className="product-home-title" href={prdHref(p)}>{p.title}</Link>
              <span className="product-home-meta"><Birth prd={p} /></span>
            </span>
            <span className="product-home-state">{p.state}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const PANELS: Readonly<Record<ProductHomeTab, (props: { home: Home }) => ReactNode>> = {
  ledger: Ledger, prds: Prds, ideas: IdeasTab, roadmap: RoadmapTab, bugs: BugsTab, visual: VisualTab, questions: QuestionsTab,
};

function HomeScreen({ home, tab }: { home: Home; tab: ProductHomeTab }) {
  const Panel = PANELS[tab];
  return (
    <div className="ask-col products product-home">
      <section className="ask-card products-head" aria-labelledby="product-home-title">
        <Link className="products-back" href={PRODUCTS_HOME_HREF}>← Products</Link>
        <h1 id="product-home-title">{home.product.name}</h1>
        <p className="ask-muted">{ledeOf(tab)}</p>
      </section>
      <SectionTabs label={home.product.name} tabs={productHomeTabs(home)} current={productHomeTabHref(home, tab)} />
      <Panel home={home} />
    </div>
  );
}

export function ProductHome({ view, tab }: { view: ProductHomeView; tab: ProductHomeTab }) {
  if (view.kind === 'home') return <HomeScreen home={view.home} tab={tab} />;
  if (view.kind === 'not-found') {
    return (
      <Notice title="No such product">
        <p className="ask-muted">Your workspace holds no product at this address. <Link href={PRODUCTS_HOME_HREF}>See your products →</Link></p>
      </Notice>
    );
  }
  return <SituationNotice view={view} />;
}
