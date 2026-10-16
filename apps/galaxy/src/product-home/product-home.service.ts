import { currentStage, STAGE_LABELS, type StoredStage } from '../stages/stage';
import type { PrdNumber, PrNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { parseOutboxItem } from 'vertuo-omni-plan/kit/lib/outbox/outbox.ts';
import { sortItems } from 'vertuo-omni-plan/kit/lib/outbox/comment.ts';
import type { QuestionView } from '../questions/questions.contract';
import {
  productHomeRepository, type ProductHomeDb, type ProductHomeRepository, type StoredApproval, type StoredHomePrd,
  type StoredFix, type StoredIdea, type StoredItem, type StoredLink, type StoredOtherLink, type StoredOutbox, type StoredPhase0, type StoredPlayer, type StoredProductPrd, type StoredPull,
  type StoredRoadmap, type StoredStageRow, type StoredTopic, type StoredVoid,
} from './product-home.repository';

// The product home's rules (PRD 1364 s9; ADR-0095): /app/products/<id> opens on the Ledger, what waits
// on whom across the product's PRDs (dossiers of kind `prd` whose product it is, spec §2), in three lanes,
// and its PRDs tab lists them all, newest first. Every answer is a pure function of the rows read:
//
// - a ◆ PRD (born on the server) with no approval in force (none yet, or its latest one voided by a push
//   since, PRD 1322) waits on a person: its approvers. On you when the request asks you
//   (approval_requests_waiting()); its state word is `approval`, or `drifted` once voided;
// - a PRD whose outbox holds items that wait on a person (prd_outbox.waiting) waits on its author, as the
//   waiting list reads it (src/outbox-waiting): on you when you opened it; its state word is `question`;
// - else a PRD at outbox (its feature PR ready), or a ◇ PRD still at PRD (its phase-0 pull request open),
//   is on GitHub review: `review`;
// - else a PRD at inbox or building is on the agent: `inbox` or `building`. A ◆ PRD approved but not yet
//   synced past PRD reads `inbox`: approved is its inbox (PRD 1299);
// - a shipped PRD, or one at retro, waits on nobody: on no lane.
//
// A PRD that waits on a person who is not you is on no lane, and counts in the summary's waiting on a
// person. The summary counts the PRDs at building, those waiting on a person, and the ◆ PRDs whose
// approval a push voided (drifted). A row's PR chips are the open pull requests of the PRD's feature
// branch, in any repository: its head `feat/<topic>` (the kit's default shape) or one of its landings,
// `feat/<topic>-<k>of<n>-<name>`, the topic the stages sync learnt (prd_topics).
//
// Its other tabs (s10) list only the product's own: its ideas still on a board (ideas.product_id), its
// roadmaps (roadmaps.product_id), its bug fixes and visual fixes (dossiers of kind `bug` and `visual`),
// each newest first, and its Questions: every outbox item waiting on a person (prd_outbox.waiting) of a
// PRD of the product not yet shipped, newest PRD first, in the order its outbox lists them. Since PRD 1548
// s9 they include the open items of the product's product PRDs (`mobile-12`, its outbox on the server),
// the worst first, each with the repository it was raised in, its options and the PRD it is answered on;
// and every question says who it is for, read from its rank.

/** Where a PRD was born: `server` (◆, approved on its page) or `repo` (◇, by its phase-0 pull request). */
export type Birthplace = 'server' | 'repo';

/** The three lanes of the Ledger. */
export type LaneId = 'on-you' | 'on-review' | 'on-agent';

/** A Ledger row's one state word. */
export type LedgerState = 'approval' | 'drifted' | 'question' | 'review' | 'inbox' | 'building';

/** An open pull request of a PRD's feature branch: its repository and number. */
export interface PrChip {
  repo: string;
  pr: PrNumber;
}

/** A PRD of the product, as both tabs name it. */
export interface HomePrd {
  dossier: string;
  repo: string;
  prd: PrdNumber;
  title: string;
  birthplace: Birthplace;
}

/** One row of a lane. */
export interface LedgerRow extends HomePrd {
  /** Whether an approval in force seals it: a ◆ PRD approved, with no void since. */
  sealed: boolean;
  state: LedgerState;
  /** The first question waiting, when its state is `question`; else null. */
  question: string | null;
  /** How many outbox questions wait on a person. */
  questions: number;
  prs: PrChip[];
}

export interface LedgerSummary {
  building: number;
  waitingOnPerson: number;
  drifted: number;
}

export interface Ledger {
  lanes: Record<LaneId, LedgerRow[]>;
  summary: LedgerSummary;
}

/** One row of the PRDs tab: its state word is its current stage's, or `syncing` before the sync saw it. */
export interface PrdsTabRow extends HomePrd {
  state: string;
}

/** An idea of the product on its board (s10): its lane there, and the PRD it became, if any. */
export interface HomeIdea {
  id: string;
  repo: string;
  title: string;
  pitch: string;
  lane: string;
  prd: PrdNumber | null;
}

/** A roadmap of the product (s10). */
export interface HomeRoadmap {
  id: string;
  number: number;
  repo: string;
  title: string;
  milestone: string;
  targetDate: string | null;
}

/** A bug or visual fix of the product (s10), each on its own tab. */
export interface HomeFix {
  dossier: string;
  repo: string;
  title: string;
  created: string;
}

/** An outbox question of one of the product's PRDs that waits on a person (s10), as the Questions tab
 * draws it (PRD 1548 s9), but for the addresses of its PRD's page, which the page adds. */
export type HomeQuestion = Omit<QuestionView, 'prdHref' | 'outboxHref'>;

/** A repository linked to the product (PRD 2129), as the Constellation tab names it. */
export interface HomeRepository {
  repository: string;
  role: string | null;
  /** The repositories of the product it consumes, as its owners declared them. */
  consumes: string[];
  phase0: 'pr' | 'server';
  /** The names of the other products it is linked to, sorted. */
  alsoIn: string[];
}

/** Everything the product home draws. */
export interface ProductHome {
  product: { id: string; name: string };
  ledger: Ledger;
  prds: PrdsTabRow[];
  ideas: HomeIdea[];
  roadmaps: HomeRoadmap[];
  bugs: HomeFix[];
  visuals: HomeFix[];
  questions: HomeQuestion[];
  /** The product's linked repositories, by name. */
  repositories: HomeRepository[];
}

/** What the product home is drawn from, as the repository reads it. */
export interface ProductHomeRows {
  product: { id: string; name: string };
  /** The product's numbered PRDs, newest first. */
  prds: readonly StoredHomePrd[];
  stages: readonly StoredStageRow[];
  outbox: readonly StoredOutbox[];
  approvals: readonly StoredApproval[];
  voids: readonly StoredVoid[];
  /** The dossiers whose approval request waits on the reader. */
  waitingOnMe: readonly string[];
  topics: readonly StoredTopic[];
  /** Open pull requests whose head is a feature branch. */
  pulls: readonly StoredPull[];
  /** The product's ideas on a board, its roadmaps and its fixes, each newest first. */
  ideas: readonly StoredIdea[];
  roadmaps: readonly StoredRoadmap[];
  fixes: readonly StoredFix[];
  /** The product's key, which names its product PRDs (`mobile-12`); null before it is set. */
  key: string | null;
  /** The product's product PRDs, newest first, and their outbox items, oldest first (PRD 1548 s9). */
  productPrds: readonly StoredProductPrd[];
  items: readonly StoredItem[];
  /** The players of the PRDs' authors: their GitHub logins. */
  players: readonly StoredPlayer[];
  /** The product's links to its repositories, the other products' links to those, and each one's phase 0 (PRD 2129). */
  links: readonly StoredLink[];
  otherLinks: readonly StoredOtherLink[];
  phase0: readonly StoredPhase0[];
  /** Who reads: their user id. */
  me: string;
}

const keyOf = (repo: string, prd: PrdNumber) => `${repo.toLowerCase()}#${String(prd)}`;
const DONE: readonly StoredStage[] = ['shipped', 'retro'];
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The feature branch of `topic` and its landings, as one pattern. */
const featureHead = (topic: string) => new RegExp(`^feat/${escape(topic)}(-\\d+of\\d+-[a-z0-9-]+)?$`);

function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) grouped.set(key(row), [...(grouped.get(key(row)) ?? []), row]);
  return grouped;
}

/** The approval of a ◆ PRD: none yet, in force, or voided by a push since. */
function approvalOf(approvals: readonly StoredApproval[], voids: readonly StoredVoid[]): 'none' | 'in-force' | 'voided' {
  const latest = [...approvals].sort((a, b) => Date.parse(b.approved_at) - Date.parse(a.approved_at))[0];
  if (!latest) return 'none';
  return voids.some((v) => v.approval_id === latest.id) ? 'voided' : 'in-force';
}

const homePrdOf = (d: StoredHomePrd): HomePrd => ({
  dossier: d.id, repo: d.home_repo, prd: d.prd, title: d.title, birthplace: d.birthplace === 'server' ? 'server' : 'repo',
});

/** What decides a PRD's place on the Ledger. */
interface Facts {
  stage: StoredStage | null;
  server: boolean;
  approval: 'none' | 'in-force' | 'voided';
  waiting: number;
  onMe: boolean;
  mine: boolean;
}

/** Where a PRD waits: its lane (null: on a person who is not you) and its state word. */
type Place = { lane: LaneId | null; state: LedgerState; onPerson: boolean };

/** Where a PRD waits on a person: its approvers while no approval is in force, else its author while its
 * outbox holds a question for a person; null when it waits on none. */
function personPlace(f: Facts): Place | null {
  if (f.server && f.approval !== 'in-force') {
    return { lane: f.onMe ? 'on-you' : null, state: f.approval === 'voided' ? 'drifted' : 'approval', onPerson: true };
  }
  if (f.waiting > 0) return { lane: f.mine ? 'on-you' : null, state: 'question', onPerson: true };
  return null;
}

/** Where a PRD that waits on no person waits: a review on GitHub (its feature PR ready, or a ◇ PRD's
 * phase-0 pull request), else the agent. */
function machinePlace({ stage, server }: Facts): Place {
  const phase0 = !server && (stage === null || stage === 'prd');
  if (stage === 'outbox' || phase0) return { lane: 'on-review', state: 'review', onPerson: false };
  return { lane: 'on-agent', state: stage === 'building' ? 'building' : 'inbox', onPerson: false };
}

/** A PRD's place on the Ledger; null once it is shipped or at retro. */
function placeOf(f: Facts): Place | null {
  if (f.stage !== null && DONE.includes(f.stage)) return null;
  return personPlace(f) ?? machinePlace(f);
}

/** The open pull requests of the feature branch of `topic`, chipped; none without a topic. */
function chipsOf(topic: string | undefined, pulls: readonly StoredPull[]): PrChip[] {
  if (topic === undefined) return [];
  const head = featureHead(topic);
  return pulls.filter((p) => head.test(p.head)).map((p) => ({ repo: p.repo, pr: p.number }));
}

/** Counts a placed PRD in the summary. */
function count(summary: LedgerSummary, stage: StoredStage | null, place: Place): void {
  if (stage === 'building') summary.building += 1;
  if (place.onPerson) summary.waitingOnPerson += 1;
  if (place.state === 'drifted') summary.drifted += 1;
}

/** The rows read, keyed for one PRD's lookups. */
function indexOf(rows: ProductHomeRows) {
  const stages = groupBy(rows.stages, (s) => keyOf(s.repository, s.prd));
  const outbox = new Map(rows.outbox.map((o) => [keyOf(o.repository, o.prd), o.waiting]));
  const approvals = groupBy(rows.approvals, (a) => a.dossier_id);
  const voids = groupBy(rows.voids, (v) => v.dossier_id);
  const topics = new Map(rows.topics.map((t) => [keyOf(t.repository, t.prd), t.topic]));
  const waitingOnMe = new Set(rows.waitingOnMe);
  return {
    stage: (key: string) => currentStage(stages.get(key) ?? []),
    waiting: (key: string) => outbox.get(key) ?? [],
    approval: (dossier: string) => approvalOf(approvals.get(dossier) ?? [], voids.get(dossier) ?? []),
    topic: (key: string) => topics.get(key),
    onMe: (dossier: string) => waitingOnMe.has(dossier),
  };
}

type Index = ReturnType<typeof indexOf>;

/** One PRD read: its PRDs tab row, and its place and row on the Ledger (null once shipped). */
function readPrd(stored: StoredHomePrd, index: Index, rows: ProductHomeRows) {
  const prd = homePrdOf(stored);
  const key = keyOf(prd.repo, prd.prd);
  const stage = index.stage(key);
  const tab: PrdsTabRow = { ...prd, state: stage === null ? 'syncing' : STAGE_LABELS[stage] };
  const server = prd.birthplace === 'server';
  const approval = server ? index.approval(prd.dossier) : 'none';
  const waiting = index.waiting(key);
  const place = placeOf({ stage, server, approval, waiting: waiting.length, onMe: index.onMe(prd.dossier), mine: stored.opened_by === rows.me });
  const row = (state: LedgerState): LedgerRow => ({
    ...prd,
    sealed: server && approval === 'in-force',
    state,
    question: state === 'question' ? (waiting[0]?.question ?? null) : null,
    questions: waiting.length,
    prs: chipsOf(index.topic(key), rows.pulls),
  });
  return { tab, stage, place, row, waiting };
}

const ideaOf = (i: StoredIdea): HomeIdea => ({ id: i.id, repo: i.repo, title: i.title, pitch: i.pitch, lane: i.lane, prd: i.prd });

const roadmapOf = (r: StoredRoadmap): HomeRoadmap =>
  ({ id: r.id, number: r.number, repo: r.repo, title: r.title, milestone: r.milestone, targetDate: r.target_date });

const fixesOf = (fixes: readonly StoredFix[], kind: StoredFix['kind']): HomeFix[] =>
  fixes.filter((f) => f.kind === kind).map((f) => ({ dossier: f.id, repo: f.home_repo, title: f.title, created: f.created_at }));

/** Who a question is for, in a few words, from its rank and its PRD's author. */
type WhoIsFor = (rank: string, author: string | null) => string;

/** Who a question is for, read from its rank (PRD 1548 s5-04): one that asks a person to act is for
 * whoever can do it; any other is for its PRD's author: you, their GitHub login, or its author when the
 * login is unknown. */
function whoIsFor(rows: ProductHomeRows): WhoIsFor {
  const logins = new Map(rows.players.flatMap((p) => (p.github_login === null ? [] : [[p.user_id, p.github_login] as const])));
  return (rank, author) => {
    if (rank === 'human-action') return 'for a person who can do it';
    if (author !== null && author === rows.me) return 'for you';
    const login = author === null ? undefined : logins.get(author);
    return login === undefined ? 'for its author' : `for ${login}`;
  };
}

/** A PRD's questions, and when the PRD was made, for the tab's newest-first order. */
type QuestionGroup = { created: string; questions: HomeQuestion[] };

/** The questions of one repository's PRD still open: each item its outbox holds waiting on a person,
 * answered on its PRD page. */
const repoQuestionsOf = (prd: HomePrd, author: string | null, waiting: StoredOutbox['waiting'], who: WhoIsFor): HomeQuestion[] =>
  waiting.map((w) => ({
    dossier: prd.dossier, prdLabel: String(prd.prd), title: prd.title, repo: prd.repo, id: w.id, rank: w.rank, question: w.question,
    forWhom: who(w.rank, author), options: [], answerOn: null,
  }));

/** One open item of a product PRD, as a question answered here: its plain words and options read from
 * its body by the kit's one item parser. */
function itemQuestion(item: StoredItem, prd: StoredProductPrd, prdId: string | null, who: WhoIsFor): HomeQuestion {
  const parsed = parseOutboxItem(item.body);
  const sections = parsed.ok ? parsed.item.sections : {};
  return {
    dossier: prd.id, prdLabel: prdId ?? String(prd.product_seq), title: prd.title, repo: item.repository, id: item.item, rank: item.rank,
    question: sections.questionPlain ?? item.item, forWhom: who(item.rank, prd.opened_by), options: sections.options ?? [], answerOn: prdId,
  };
}

/** The open questions of the product's product PRDs (PRD 1548 s9): every item not yet settled, the
 * worst first, as the outbox gate counts them (s7-03). */
function productQuestionsOf(rows: ProductHomeRows, who: WhoIsFor): QuestionGroup[] {
  const open = groupBy(rows.items.filter((i) => i.outbox_settlements.length === 0), (i) => i.dossier_id);
  return rows.productPrds.map((prd) => {
    const prdId = rows.key === null ? null : `${rows.key}-${String(prd.product_seq)}`;
    const ranked = sortItems((open.get(prd.id) ?? []).map((item) => ({ id: item.item, rank: item.rank, item })));
    return { created: prd.created_at, questions: ranked.map(({ item }) => itemQuestion(item, prd, prdId, who)) };
  });
}

/** Every PRD's questions, newest PRD first. */
const newestFirst = (groups: QuestionGroup[]): HomeQuestion[] =>
  [...groups].sort((a, b) => Date.parse(b.created) - Date.parse(a.created)).flatMap((g) => g.questions);

/** The product's repositories: each link with its phase 0 (`pr` until a row says otherwise) and the other
 * products it is also in, by name, sorted. */
function repositoriesOf(rows: ProductHomeRows): HomeRepository[] {
  const flags = new Map(rows.phase0.map((p) => [p.full_name, p.phase0] as const));
  const others = groupBy(rows.otherLinks, (l) => l.repository);
  return [...rows.links].sort((a, b) => a.repository.localeCompare(b.repository)).map((l) => ({
    repository: l.repository,
    role: l.role,
    consumes: [...l.consumes],
    phase0: flags.get(l.repository) ?? 'pr',
    alsoIn: [...new Set((others.get(l.repository) ?? []).map((o) => o.products.name))].sort((a, b) => a.localeCompare(b)),
  }));
}

/** The product home from the rows read. */
export function productHomeOf(rows: ProductHomeRows): ProductHome {
  const index = indexOf(rows);
  const lanes: Record<LaneId, LedgerRow[]> = { 'on-you': [], 'on-review': [], 'on-agent': [] };
  const summary: LedgerSummary = { building: 0, waitingOnPerson: 0, drifted: 0 };
  const prds: PrdsTabRow[] = [];
  const who = whoIsFor(rows);
  const groups: QuestionGroup[] = productQuestionsOf(rows, who);
  for (const stored of rows.prds) {
    const { tab, stage, place, row, waiting } = readPrd(stored, index, rows);
    prds.push(tab);
    if (place === null) continue;
    groups.push({ created: stored.created_at, questions: repoQuestionsOf(tab, stored.opened_by, waiting, who) });
    count(summary, stage, place);
    if (place.lane !== null) lanes[place.lane].push(row(place.state));
  }
  return {
    product: rows.product,
    ledger: { lanes, summary },
    prds,
    ideas: rows.ideas.map(ideaOf),
    roadmaps: rows.roadmaps.map(roadmapOf),
    bugs: fixesOf(rows.fixes, 'bug'),
    visuals: fixesOf(rows.fixes, 'visual'),
    questions: newestFirst(groups),
    repositories: repositoriesOf(rows),
  };
}

/** What the reads need: the product's id, its workspace, and who reads. */
interface HomeRequest {
  product: string;
  workspace: string;
  me: string;
}

export function productHomeService(store: ProductHomeRepository) {
  return {
    /** The product home, as the reader sees it; null when the workspace holds no such product. Throws when a
     * read fails. */
    async home({ product: id, workspace, me }: HomeRequest): Promise<ProductHome | null> {
      const found = await store.product(workspace, id);
      if (found === null) return null;
      const product = { id: found.id, name: found.name };
      const [prds, productPrds] = await Promise.all([store.prds(workspace, id), store.productPrds(workspace, id)]);
      const repos = [...new Set(prds.map((p) => p.home_repo))];
      const dossiers = prds.map((p) => p.id);
      const authors = [...new Set([...prds, ...productPrds].flatMap((p) => (p.opened_by === null ? [] : [p.opened_by])))];
      const links = await store.links(workspace, id);
      const linked = links.map((l) => l.repository);
      const [stages, outbox, topics, approvals, voids, waitingOnMe, pulls, ideas, roadmaps, fixes, items, players, otherLinks, phase0] = await Promise.all([
        store.stages(workspace, repos),
        store.outbox(workspace, repos),
        store.topics(workspace, repos),
        store.approvals(dossiers),
        store.voids(dossiers),
        store.waitingOnMe(),
        prds.length === 0 ? Promise.resolve([]) : store.featurePulls(workspace),
        store.ideas(workspace, id),
        store.roadmaps(workspace, id),
        store.fixes(workspace, id),
        store.items(productPrds.map((p) => p.id)),
        store.players(workspace, authors),
        store.otherLinks(workspace, id, linked),
        store.phase0(workspace, linked),
      ]);
      return productHomeOf({
        product, prds, stages, outbox, approvals, voids, waitingOnMe, topics, pulls, ideas, roadmaps, fixes, key: found.key, productPrds, items, players, links, otherLinks, phase0, me,
      });
    },
  };
}

export type ProductHomeService = ReturnType<typeof productHomeService>;

/** The product home's reads on `db`, the client the controller was handed: the viewer's. */
export const productHomeReads = (db: ProductHomeDb): ProductHomeService => productHomeService(productHomeRepository(db));
