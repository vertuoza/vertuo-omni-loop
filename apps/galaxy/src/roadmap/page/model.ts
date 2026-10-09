// What the Roadmaps pages show (PRD 1162, "Roadmaps in Omni"), built from the stored rows (../store.ts,
// s2's, read here and never changed) and the clock, pure: every roadmap of the workspace, filterable by
// product, each with its milestone, its progress (PRDs merged of all) and what blocks it now; and one
// roadmap opened, with its milestone, its Gantt (../gantt.ts), its open questions (an answer box for a
// `person` one not answered yet) and each PRD linking to its page. The page decides the situation
// (closed, signed out, in no workspace) before any of this. Its human work (PRD 1217): each card the open
// count of each kind that has one; the roadmap's page a chip per kind with its open count, the open
// entries grouped by kind, and the done ones with when they were settled.
import type { IssueNumber, PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { prdPagePath } from '../../dossier/page/history-at';
import { ganttOf, type Gantt } from '../gantt';
import type { HumanWorkKind, RoadmapHumanWorkRow, RoadmapPrdRow, RoadmapPrerequisiteRow, RoadmapQuestion, RoadmapRow } from '../store';
import { prerequisitesOf, roadmapTabsOf, type PrerequisitesView, type RoadmapTab, type RoadmapTabLink, type TickAsk } from './prerequisites';

/** Where the Roadmaps pages live, and one roadmap's page under it. */
export const ROADMAPS_PATH = '/roadmaps';
const roadmapHref = (id: string) => `${ROADMAPS_PATH}/${encodeURIComponent(id)}`;

/** The skill that writes a roadmap, named by the empty state. */
export const ROADMAP_SKILL = '/omni:roadmap';

/** How many of the lines that block a roadmap its card shows before "and n more". */
const SHOWN_BLOCKS = 3;

/** A product of the workspace, as the list's filter offers it. */
export interface ProductRef {
  id: string;
  name: string;
}

/** One choice of the list's filter: every roadmap, or one product's. */
export interface ProductChoice {
  label: string;
  href: string;
  current: boolean;
  count: number;
}

/** A roadmap as the list shows it. */
export interface RoadmapSummary {
  id: string;
  href: string;
  title: string;
  milestone: string;
  /** Its product's name, or null when it has none. */
  product: string | null;
  repo: string;
  number: IssueNumber;
  /** The date a person gave, or null. */
  target: string | null;
  merged: number;
  total: number;
  /** How many of its PRDs wait for a person's merge. */
  ready: number;
  /** What blocks it now, a line each: the questions waiting for a person, then the pull requests waited on. */
  blocks: string[];
  /** How many more lines block it than `blocks` shows. */
  moreBlocks: number;
  /** Its open human work, a count per kind that has one, in the kinds' order. */
  openWork: HumanWorkCount[];
}

/** Each kind of human work as the page names it, in the order the page shows them. */
const HUMAN_WORK_LABELS: Readonly<Record<HumanWorkKind, string>> = {
  business: 'business',
  development: 'development',
  'dev-ops': 'dev ops',
  'delivery-ops': 'delivery ops',
};
const KINDS = ['business', 'development', 'dev-ops', 'delivery-ops'] as const satisfies readonly HumanWorkKind[];

/** How much open human work of one kind a roadmap holds. */
export interface HumanWorkCount {
  kind: HumanWorkKind;
  label: string;
  open: number;
}

/** One piece of human work, as the roadmap's page shows it. */
export interface HumanWorkEntry {
  key: string;
  kind: HumanWorkKind;
  label: string;
  prd: PrdNumber | null;
  /** The PRD's page, or null when the work is the roadmap's own. */
  prdHref: string | null;
  repo: string;
  text: string;
  /** What a person does, word for word, or null. */
  act: string | null;
  /** Where it is answered, or null. */
  url: string | null;
  /** The day it was settled (YYYY-MM-DD), null while it is open. */
  settled: string | null;
}

/** The open entries of one kind. */
export interface HumanWorkGroup {
  kind: HumanWorkKind;
  label: string;
  entries: HumanWorkEntry[];
}

/** A roadmap's Human work item: a count per kind (every kind), the open entries by kind, the done ones. */
export interface HumanWorkView {
  counts: HumanWorkCount[];
  open: HumanWorkGroup[];
  done: HumanWorkEntry[];
}

type Work = Pick<RoadmapHumanWorkRow, 'key' | 'prd' | 'repo' | 'text' | 'act' | 'url' | 'kind' | 'state' | 'done_at'>;

const countsOf = (work: readonly Work[]): HumanWorkCount[] =>
  KINDS.map((kind) => ({ kind, label: HUMAN_WORK_LABELS[kind], open: work.filter((w) => w.state === 'open' && w.kind === kind).length }));

const entryOf = (w: Work, repo: string): HumanWorkEntry => ({
  key: w.key, kind: w.kind, label: HUMAN_WORK_LABELS[w.kind], prd: w.prd, prdHref: w.prd === null ? null : prdPagePath(repo, w.prd),
  repo: w.repo, text: w.text, act: w.act, url: w.url, settled: w.state === 'done' && w.done_at !== null ? w.done_at.slice(0, 10) : null,
});

/** The Human work item of a roadmap whose repository is `repo` (each PRD's page is under it). */
function humanWorkOf(work: readonly Work[], repo: string): HumanWorkView {
  const open = work.filter((w) => w.state === 'open');
  return {
    counts: countsOf(work),
    open: KINDS.map((kind) => ({ kind, label: HUMAN_WORK_LABELS[kind], entries: open.filter((w) => w.kind === kind).map((w) => entryOf(w, repo)) }))
      .filter((g) => g.entries.length > 0),
    done: work.filter((w) => w.state === 'done').map((w) => entryOf(w, repo)),
  };
}

/** An open question of a roadmap. */
export interface QuestionView {
  id: string;
  question: string;
  recommendation: string | null;
  blocks: string[];
  kind: 'default' | 'person';
  answer: string | null;
  /** A `person` question not answered yet: the page offers its answer box. */
  answerable: boolean;
}

/** One roadmap opened. */
export interface RoadmapDetail extends RoadmapSummary {
  /** The roadmap's issue, where an answer is written. */
  issueUrl: string;
  source: string | null;
  gantt: Gantt;
  humanWork: HumanWorkView;
  questions: QuestionView[];
  /** The tab shown (PRD 1218): Overview, today's page, or Prerequisites. */
  tab: RoadmapTab;
  tabs: RoadmapTabLink[];
  prerequisites: PrerequisitesView;
}

/** What one roadmap opened adds to its read: its prerequisites, and the tab asked for. */
export interface DetailAsk {
  prerequisites: readonly RoadmapPrerequisiteRow[];
  tab: RoadmapTab;
  /** Mark as done (s7): offered to a member where it is open; none on the demo. */
  tick?: TickAsk;
}

/** Where the page's data came from: the workspace's, or the demo, in development or for a person signed out. */
export type Demo = null | 'development' | 'signed-out';

export type RoadmapPageView =
  | { kind: 'closed' }
  | { kind: 'no-workspace' }
  /** The workspace could not be read. */
  | { kind: 'unreadable' }
  | { kind: 'list'; name: string; demo: Demo; products: ProductChoice[]; roadmaps: RoadmapSummary[]; filtered: boolean }
  | { kind: 'roadmap'; name: string; demo: Demo; roadmap: RoadmapDetail };

type Prd = Pick<RoadmapPrdRow, 'state' | 'waits_on'>;

/** What blocks a roadmap now: each `person` question with no answer, then each distinct pull request waited on. */
function blocksOf(questions: readonly RoadmapQuestion[], prds: readonly Prd[]): string[] {
  const asked = questions.filter((q) => q.kind === 'person' && q.answer === null).map((q) => `${q.id} waits for a person's answer`);
  const waits = prds.filter((p) => p.state !== 'merged' && p.waits_on !== null).map((p) => p.waits_on ?? '');
  return [...new Set([...asked, ...waits])];
}

const issueUrlOf = (row: Pick<RoadmapRow, 'repo' | 'number'>) => `https://github.com/${row.repo}/issues/${row.number}`;

/** One roadmap as the pages read it: its row, its PRDs and its human work. */
export interface RoadmapRead {
  row: RoadmapRow;
  prds: readonly RoadmapPrdRow[];
  humanWork: readonly Work[];
}

function summaryOf({ row, prds, humanWork }: RoadmapRead, products: readonly ProductRef[]): RoadmapSummary {
  const blocks = blocksOf(row.questions, prds);
  return {
    id: row.id,
    href: roadmapHref(row.id),
    title: row.title,
    milestone: row.milestone,
    product: products.find((p) => p.id === row.product_id)?.name ?? null,
    repo: row.repo,
    number: row.number,
    target: row.target_date,
    merged: prds.filter((p) => p.state === 'merged').length,
    total: prds.length,
    ready: prds.filter((p) => p.state === 'ready').length,
    blocks: blocks.slice(0, SHOWN_BLOCKS),
    moreBlocks: Math.max(0, blocks.length - SHOWN_BLOCKS),
    openWork: countsOf(humanWork).filter((c) => c.open > 0),
  };
}

export function detailOf(read: RoadmapRead, products: readonly ProductRef[], now: number, ask: DetailAsk): RoadmapDetail {
  const { row, prds } = read;
  const summary = summaryOf(read, products);
  const prerequisites = prerequisitesOf(ask.prerequisites, row.prerequisites_machine ?? null, row.prerequisites_checked_at ?? null, ask.tick);
  return {
    ...summary,
    blocks: blocksOf(row.questions, prds),
    moreBlocks: 0,
    issueUrl: issueUrlOf(row),
    source: row.source,
    gantt: ganttOf(prds, now, row.repo),
    humanWork: humanWorkOf(read.humanWork, row.repo),
    questions: row.questions.map((q) => ({ ...q, answerable: q.kind === 'person' && q.answer === null })),
    tab: ask.tab,
    tabs: roadmapTabsOf(summary.href, ask.tab, prerequisites.waiting),
    prerequisites,
  };
}

/** The filter's choices: every roadmap, then each product of the workspace that files one, the one asked for current. */
function productChoices(rows: readonly Pick<RoadmapRow, 'product_id'>[], products: readonly ProductRef[], product: string | null): ProductChoice[] {
  const filed = products.filter((p) => rows.some((r) => r.product_id === p.id));
  return [
    { label: 'Every product', href: ROADMAPS_PATH, current: product === null, count: rows.length },
    ...filed.map((p) => ({
      label: p.name,
      href: `${ROADMAPS_PATH}?product=${encodeURIComponent(p.id)}`,
      current: p.id === product,
      count: rows.filter((r) => r.product_id === p.id).length,
    })),
  ];
}

/** The list: the workspace's roadmaps, only the product's when one is asked for. */
export function listOf(
  name: string,
  demo: Demo,
  rows: readonly RoadmapRead[],
  products: readonly ProductRef[],
  product: string | null,
): Extract<RoadmapPageView, { kind: 'list' }> {
  const shown = product === null ? rows : rows.filter((r) => r.row.product_id === product);
  return {
    kind: 'list',
    name,
    demo,
    products: productChoices(rows.map((r) => r.row), products, product),
    roadmaps: shown.map((r) => summaryOf(r, products)),
    filtered: product !== null,
  };
}

/** The command that records a person's answer to a question (`omni roadmap answer`, PRD 1162). */
export const answerCommand = (roadmap: IssueNumber, question: string, answer: string) =>
  `omni roadmap answer ${roadmap} ${question} "${answer.replace(/(["\\$`])/g, '\\$1')}"`;
