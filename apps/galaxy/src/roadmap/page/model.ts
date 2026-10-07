// What the Roadmaps pages show (PRD 1162, "Roadmaps in Omni"), built from the stored rows (../store.ts,
// s2's, read here and never changed) and the clock, pure: every roadmap of the workspace, filterable by
// product, each with its milestone, its progress (PRDs merged of all) and what blocks it now; and one
// roadmap opened, with its milestone, its Gantt (../gantt.ts), its open questions (an answer box for a
// `person` one not answered yet) and each PRD linking to its page. The page decides the situation
// (closed, signed out, in no workspace) before any of this.
import type { IssueNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { ganttOf, type Gantt } from '../gantt';
import type { RoadmapPrdRow, RoadmapQuestion, RoadmapRow } from '../store';

/** Where the Roadmaps pages live, and one roadmap's page under it. */
export const ROADMAPS_PATH = '/roadmaps';
export const roadmapHref = (id: string) => `${ROADMAPS_PATH}/${encodeURIComponent(id)}`;

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
  questions: QuestionView[];
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
export function blocksOf(questions: readonly RoadmapQuestion[], prds: readonly Prd[]): string[] {
  const asked = questions.filter((q) => q.kind === 'person' && q.answer === null).map((q) => `${q.id} waits for a person's answer`);
  const waits = prds.filter((p) => p.state !== 'merged' && p.waits_on !== null).map((p) => p.waits_on ?? '');
  return [...new Set([...asked, ...waits])];
}

const issueUrlOf = (row: Pick<RoadmapRow, 'repo' | 'number'>) => `https://github.com/${row.repo}/issues/${row.number}`;

export function summaryOf(row: RoadmapRow, prds: readonly RoadmapPrdRow[], products: readonly ProductRef[]): RoadmapSummary {
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
  };
}

export function detailOf(row: RoadmapRow, prds: readonly RoadmapPrdRow[], products: readonly ProductRef[], now: number): RoadmapDetail {
  const summary = summaryOf(row, prds, products);
  return {
    ...summary,
    blocks: blocksOf(row.questions, prds),
    moreBlocks: 0,
    issueUrl: issueUrlOf(row),
    source: row.source,
    gantt: ganttOf(prds, now),
    questions: row.questions.map((q) => ({ ...q, answerable: q.kind === 'person' && q.answer === null })),
  };
}

/** The filter's choices: every roadmap, then each product of the workspace that files one, the one asked for current. */
export function productChoices(rows: readonly Pick<RoadmapRow, 'product_id'>[], products: readonly ProductRef[], product: string | null): ProductChoice[] {
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
  rows: ReadonlyArray<{ row: RoadmapRow; prds: readonly RoadmapPrdRow[] }>,
  products: readonly ProductRef[],
  product: string | null,
): Extract<RoadmapPageView, { kind: 'list' }> {
  const shown = product === null ? rows : rows.filter((r) => r.row.product_id === product);
  return {
    kind: 'list',
    name,
    demo,
    products: productChoices(rows.map((r) => r.row), products, product),
    roadmaps: shown.map((r) => summaryOf(r.row, r.prds, products)),
    filtered: product !== null,
  };
}

/** The command that records a person's answer to a question (`omni roadmap answer`, PRD 1162). */
export const answerCommand = (roadmap: IssueNumber, question: string, answer: string) =>
  `omni roadmap answer ${roadmap} ${question} "${answer.replace(/(["\\$`])/g, '\\$1')}"`;
