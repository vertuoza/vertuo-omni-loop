// A concept's page, /concepts/<id> (PRD 1272, s3), as a pure function of what the route read and what the
// address picks. The header: `#n ↗` after its Concept badge, linking to the concept's issue, the title,
// and On GitHub, its issue and its concept PR. Then five tabs:
//
// - Overview: concept.md's sections The brief, The vision, Why this one, Killed and why and Fuel, each
//   rendered as Markdown with raw HTML off (../dossier/markdown.ts), as the other Markdown tabs are;
// - Areas: the Areas table in build order, the wedge marked (./areas.ts);
// - Vision tour: the latest vision.html, framed from its sandboxed route, /concepts/<id>/v/<n>/page;
// - Boards: a round picker (Round 1, Round 2, …), the round shown framed from /concepts/<id>/r/<k>/page,
//   the latest round when the address picks none;
// - Debate: the latest debate.md, rendered as Markdown.
//
// A file a push did not send — `omni dossier push --kind concept` sends every file of a concept's folder
// but one over 512 KiB, and names it as too large — leaves its tab with no version: the tab reads "not
// sent: too large", never missing. The tab lives in the address (`?tab=areas`, `?tab=boards&round=2`), so
// every view is a link and the page works before any script runs.
//
// The header carries the concept's state chip (PRD 1272, s4, ./state.ts), from the facts the route read.
// The concept PR's link is that pull request once the facts name it; until then, GitHub's search for the
// pull request that refers to the concept's issue (`Refs #<n>`, as /omni:think-big writes it).
import { CONCEPT_SECTIONS, parseConcept } from 'vertuo-omni-plan/kit/lib/concept/parse.ts';
import type { IssueNumber, PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { isOneOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { renderMarkdown, renderMarkdownBody } from '../dossier/markdown';
import { WORK_NAMES, workPath } from '../dossier/page/work';
import type { ConceptFacts } from '../dossier/github/fix';
import { areaViews, issueLink, type AreaView } from './areas';
import { conceptPull, conceptState, type ConceptState } from './state';

const CONCEPT_TABS = ['overview', 'areas', 'vision', 'boards', 'debate'] as const;
export type ConceptTab = (typeof CONCEPT_TABS)[number];

export const CONCEPT_TAB_LABELS: Readonly<Record<ConceptTab, string>> = {
  overview: 'Overview', areas: 'Areas', vision: 'Vision tour', boards: 'Boards', debate: 'Debate',
};

/** What a tab whose file was not sent says. */
export const NOT_SENT = 'not sent: too large';

/** The version kind each tab shows, and the file it came from. */
const TAB_FILE: Readonly<Record<ConceptTab, { kind: string; file: string }>> = {
  overview: { kind: 'concept-record', file: 'concept.md' },
  areas: { kind: 'concept-record', file: 'concept.md' },
  vision: { kind: 'vision', file: 'vision.html' },
  boards: { kind: 'board', file: 'the boards' },
  debate: { kind: 'debate', file: 'debate.md' },
};

/** The sections Overview renders: every section of concept.md but Areas, which has its own tab. */
const OVERVIEW: readonly string[] = CONCEPT_SECTIONS.filter((name) => name !== 'Areas');

/** What the address picks: a tab (Overview when it names none) and, on Boards, a round (null: the latest). */
export type ConceptPick = { tab: ConceptTab; round: number | null };

type Query = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;
const ROUND = /^[1-9]\d{0,8}$/;

export function readConceptPick(query: Query): ConceptPick {
  const tab = one(query.tab);
  const round = one(query.round);
  return { tab: isOneOf(CONCEPT_TABS, tab) ? tab : 'overview', round: round !== null && ROUND.test(round) ? Number(round) : null };
}

/** What the route read of a concept the viewer may read. */
export type ConceptRead = {
  id: string;
  /** Its home repository, where its issue and its PRDs are. */
  repo: string;
  /** Its issue; null for a dossier with none. */
  number: IssueNumber | null;
  title: string;
  /** Every version, oldest first, without its content, its kind as it came. */
  versions: readonly { id: string; kind: string }[];
  /** The latest concept.md; null when none was sent, or it could not be read. */
  record: string | null;
  /** The latest debate.md, read on the Debate tab only; null otherwise, or when it could not be read. */
  debate: string | null;
  /** The dossier id of each PRD of its areas that has a page. */
  pages: ReadonlyMap<PrdNumber, string>;
  /** Its issue and its concept PR, as stored or read (PRD 1272, s4); null when neither could be had. */
  facts: ConceptFacts | null;
};

export type ConceptTabEntry = { kind: ConceptTab; label: string; href: string; current: boolean; notSent: boolean };

export type ConceptRound = { number: number; label: string; href: string; current: boolean };

export type ConceptPane =
  | { kind: 'not-sent'; words: string }
  | { kind: 'unread'; words: string }
  | { kind: 'overview'; sections: { heading: string; html: string }[] }
  | { kind: 'areas'; areas: AreaView[] }
  | { kind: 'frame'; src: string; title: string; rounds: ConceptRound[] | null }
  | { kind: 'markdown'; html: string };

export type ConceptPageView = {
  id: string;
  /** `#1269`; null for a concept with no number. */
  heading: string | null;
  badge: string;
  title: string;
  /** The page's own path. */
  link: string;
  /** The concept's issue; null with no number. */
  issueUrl: string | null;
  /** In review, in the inbox, or state unknown. */
  state: ConceptState;
  /** On GitHub: its issue and its concept PR. */
  links: { label: string; href: string }[];
  tabs: ConceptTabEntry[];
  tab: ConceptTab;
  pane: ConceptPane;
};

/** The search that finds the concept PR: the pull request that refers to the concept's issue. */
const conceptPrSearch = (repo: string, concept: IssueNumber) =>
  `https://github.com/${repo.split('/').map(encodeURIComponent).join('/')}/pulls?q=${encodeURIComponent(`is:pr "Refs #${concept}"`)}`;

/** A tab's link: Overview's is the page's own path. */
const tabHref = (link: string, tab: ConceptTab, round: number | null = null) => {
  if (tab === 'overview') return link;
  return round === null ? `${link}?tab=${tab}` : `${link}?tab=${tab}&round=${round}`;
};

const unreadWords = (file: string) => `${file} could not be read. Reload the page in a moment.`;
const notSentWords = (file: string) => `${file} was ${NOT_SENT}: a concept's push sends each file up to 512 KiB.`;

function recordPane(read: ConceptRead, tab: 'overview' | 'areas'): ConceptPane {
  const parsed = read.record === null ? null : parseConcept(read.record);
  if (!parsed?.ok) return { kind: 'unread', words: unreadWords('concept.md') };
  const { record } = parsed;
  if (tab === 'areas') return { kind: 'areas', areas: areaViews(record.areas, read.number, read.repo, read.pages) };
  return { kind: 'overview', sections: OVERVIEW.map((heading) => ({ heading, html: renderMarkdownBody(record.sections[heading] ?? '') })) };
}

function boardsPane(link: string, boards: number, picked: number | null): ConceptPane {
  const shown = picked !== null && picked <= boards ? picked : boards;
  const rounds = Array.from({ length: boards }, (_, i) => i + 1).map((number) => ({
    number, label: `Round ${number}`, href: tabHref(link, 'boards', number), current: number === shown,
  }));
  return { kind: 'frame', src: `${link}/r/${shown}/page`, title: `Boards, Round ${shown}`, rounds };
}

function paneOf(read: ConceptRead, pick: ConceptPick, link: string, count: (kind: string) => number): ConceptPane {
  const { tab } = pick;
  const { kind, file } = TAB_FILE[tab];
  const sent = count(kind);
  if (sent === 0) return { kind: 'not-sent', words: notSentWords(file) };
  if (tab === 'overview' || tab === 'areas') return recordPane(read, tab);
  if (tab === 'vision') return { kind: 'frame', src: `${link}/v/${sent}/page`, title: 'Vision tour', rounds: null };
  if (tab === 'boards') return boardsPane(link, sent, pick.round);
  return read.debate === null ? { kind: 'unread', words: unreadWords(file) } : { kind: 'markdown', html: renderMarkdown(read.debate).html };
}

export function conceptView(read: ConceptRead, pick: ConceptPick): ConceptPageView {
  const link = workPath('concept', read.id);
  const count = (kind: string) => read.versions.filter((v) => v.kind === kind).length;
  const issueUrl = read.number === null ? null : issueLink(read.repo, read.number);
  const pull = conceptPull(read.facts);
  return {
    id: read.id,
    heading: read.number === null ? null : `#${read.number}`,
    badge: WORK_NAMES.concept.badge ?? 'Concept',
    title: read.title,
    link,
    issueUrl,
    state: conceptState(read.facts),
    links: read.number === null || issueUrl === null ? [] : [
      { label: `issue #${read.number}`, href: issueUrl },
      pull ? { label: `concept PR #${pull.number}`, href: pull.url } : { label: 'concept PR', href: conceptPrSearch(read.repo, read.number) },
    ],
    tabs: CONCEPT_TABS.map((tab) => ({
      kind: tab, label: CONCEPT_TAB_LABELS[tab], href: tabHref(link, tab), current: tab === pick.tab, notSent: count(TAB_FILE[tab].kind) === 0,
    })),
    tab: pick.tab,
    pane: paneOf(read, pick, link, count),
  };
}
