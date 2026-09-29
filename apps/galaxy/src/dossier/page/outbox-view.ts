// The Outbox tab of /prd/<id> (PRD 251, s9: "The Outbox tab"), as a pure function of the GitHub
// summary: the state the spec's table names, the cards, and the two collapsed groups.
//
// - Each open item is a card, in the pull request's numbering (`Question 19`), highest rank first: a
//   decision offers its options (A, the one built, marked built · recommended), a human action its
//   steps then Done or Not done. Its bears-on ids become chips linking to /knowledge, and its four
//   closing sections sit in one disclosure. The answer nobody has settled yet rides on its card: what
//   it said, who, where (the Omni page, the terminal or GitHub) and when.
// - The mediums adopted when raised sit in *Adopted unless you object*; every other settled entry in
//   *Settled*, with its verdict, who approved it, when, and its answer.
// - Read-only once the feature PR merged (or the PRD closed), and for a viewer who may not answer;
//   Send says why it is off (the demo; not wired here yet). The demo reads like any other outbox.
//
// No markdown is rendered here: this module is safe in the browser. The tab renders item text on the
// server (./OutboxPane.tsx), raw HTML off.
import { UNREAD, type GithubSummary, type OutboxItem, type PendingAnswer, type SettledItem } from '../github/summary';
import { outboxAnswerUrl } from './stage';

/** An empty Outbox tab says why. */
export const OUTBOX_EMPTY = 'No decision yet: the outbox fills while the PRD is built.';
/** A tab read from GitHub, when GitHub did not answer. */
export const GITHUB_UNREAD = 'GitHub did not answer. The page tries again within a minute.';
/** A viewer who may not answer here. */
export const SIGN_IN_TO_ANSWER = 'Sign in with GitHub to answer here.';
/** The comments of the feature PR could not be read. */
export const REPLIES_UNREAD = 'The replies on the pull request could not be read, so answers given there do not show, and no question can be answered here until the page reads them again.';
/** Why Send is off. */
export const SEND_OFF = {
  demo: 'A demo outbox: Send is off here.',
  notYet: 'Sending from this page is not open yet: reply on the pull request.',
} as const;
/** An item the outbox comment has not numbered yet. */
export const NOT_NUMBERED = 'Not numbered yet: the outbox comment on the pull request numbers it at the next push.';

/** What the context rail shows beside the questions. */
export type ContextKind = 'before-after' | 'spec' | 'brainstorm';
export const CONTEXTS: readonly ContextKind[] = ['before-after', 'spec', 'brainstorm'];
export const CONTEXT_LABELS: Readonly<Record<ContextKind, string>> = { 'before-after': 'Before/after', spec: 'Spec', brainstorm: 'Brainstorm' };
export const isContext = (value: unknown): value is ContextKind => CONTEXTS.includes(value as ContextKind);

/** One question the brainstorm asked, and its answer as given. */
export type BrainstormAnswer = { question: string; answer: string | null };

/** The context rail: its three switches, and what the current one shows. */
export type ContextView = {
  current: ContextKind;
  links: { kind: ContextKind; label: string; href: string; current: boolean }[];
  /** The latest before/after version's sandboxed route; null when there is none. */
  frame: string | null;
  /** The latest spec's number; null when there is none. Rendered by the route, as `shown`. */
  spec: number | null;
  /** The brainstorm's questions and answers; null when the rounds could not be read. */
  brainstorm: BrainstormAnswer[] | null;
};

export type OptionView = { letter: string; text: string; built: boolean };
export type Chip = { id: string; href: string };
export type Detail = { label: string; text: string };

/** An answer nobody has settled yet: what it said, who, where, when, and whether the kit counts it. */
export type PendingView = { text: string; by: string; where: string; when: string | null; url: string | null; counted: boolean };

export type OutboxCard = {
  id: string;
  /** Its number on the pull request; null until the outbox comment numbers it. */
  number: number | null;
  rank: OutboxItem['rank'];
  /** The rank in words: `needs a person`, `high`, `medium`; `adopted` for an adopted medium. */
  rankWords: string;
  /** A decision picks a letter; a human action is done or not done. */
  kind: 'decision' | 'action';
  /** Adopted unless someone objects: picking another letter objects. */
  adopted: boolean;
  intro: string | null;
  punchline: string | null;
  question: string;
  decision: string | null;
  options: OptionView[];
  steps: string | null;
  bearsOn: Chip[];
  details: Detail[];
  pending: PendingView | null;
};

export type SettledEntry = {
  id: string; number: number | null; title: string; verdict: string; answer: string; by: string | null; when: string | null; url: string | null;
};

export type OutboxView = {
  state: 'items' | 'empty' | 'unread';
  /** Why it is empty or unread; null otherwise. */
  words: string | null;
  /** Where the outbox is answered on GitHub: the outbox comment, else the feature PR. */
  answerUrl: string | null;
  open: OutboxCard[];
  adopted: OutboxCard[];
  settled: SettledEntry[];
  /** How many ledger entries there are, adopted ones included: the tab's badge when none is open. */
  ledger: number;
  /** Nothing can be picked: the PRD shipped or closed, or the viewer may not answer. */
  readOnly: boolean;
  /** `The feature pull request merged on 28 Sep 2026: …`; null while it is open. */
  note: string | null;
  /** Set when the viewer may not answer: what to do about it. */
  signIn: string | null;
  /** Why Send is off; null when it may send. */
  sendOff: string | null;
  /** Set when the pull request's replies could not be read. */
  repliesUnread: string | null;
  /** The rail beside the questions; null when none was given. */
  context: ContextView | null;
};

export type OutboxOptions = {
  /** The viewer may answer here: signed in and a member of the dossier's workspace. */
  canAnswer?: boolean;
  /** The demo dossier: Send is off, and says so. */
  demo?: boolean;
  context?: ContextView | null;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const day = (at: Date) => `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]} ${at.getUTCFullYear()}`;

/** `27 Sep 2026, 09:30 UTC`, or `27 Sep 2026` for a date alone; the text itself when it is neither. */
export function when(text: string | null | undefined): string | null {
  if (!text) return null;
  const at = new Date(text);
  if (Number.isNaN(at.getTime())) return text;
  return DATE_ONLY.test(text) ? day(at) : `${day(at)}, ${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())} UTC`;
}

const RANK_WORDS: Readonly<Record<OutboxItem['rank'], string>> = { 'human-action': 'needs a person', high: 'high', medium: 'medium' };
const RANK_WEIGHT: Readonly<Record<OutboxItem['rank'], number>> = { 'human-action': 2, high: 1, medium: 0 };
const WHERE: Readonly<Record<PendingAnswer['door'], string>> = { page: 'on the Omni page', terminal: 'in the terminal', github: 'on GitHub' };
const DETAILS = [
  ['decide', 'What I had to decide'], ['meanwhile', 'What I did meanwhile'], ['cost', 'What it costs to change later'], ['unknown', 'What I could not know'],
] as const;

/** `P-PRODUCT-3, ADR-0004` → a chip each; `none` → none. */
export function chips(bearsOn: string | undefined): Chip[] {
  return (bearsOn ?? '').split(/[,\s]+/).map((id) => id.trim()).filter((id) => id && id.toLowerCase() !== 'none')
    .map((id) => ({ id, href: `/knowledge?entry=${encodeURIComponent(id)}` }));
}

const oneLine = (text: string | null | undefined) => text?.replace(/\s+/g, ' ').trim() || null;

function cardOf(item: OutboxItem, number: number | null, adopted: boolean, pending: PendingAnswer | undefined): OutboxCard {
  const action = item.rank === 'human-action';
  const fun = Boolean(item.intro && item.punchline);
  return {
    id: item.id,
    number,
    rank: item.rank,
    rankWords: adopted ? 'adopted' : RANK_WORDS[item.rank],
    kind: action ? 'action' : 'decision',
    adopted,
    intro: fun ? oneLine(item.intro) : null,
    punchline: fun ? oneLine(item.punchline) : null,
    question: item.question,
    decision: item.decision,
    options: action ? [] : item.options.map((o) => ({ letter: o.letter, text: o.text, built: o.letter === 'A' })),
    steps: action ? item.personSteps : null,
    bearsOn: chips(item.bearsOn),
    details: DETAILS.flatMap(([key, label]) => (item.details?.[key]?.trim() ? [{ label, text: item.details[key]! }] : [])),
    pending: pending
      ? { text: pending.text, by: pending.by, where: WHERE[pending.door], when: when(pending.at), url: pending.url, counted: pending.counted }
      : null,
  };
}

function noteOf(github: GithubSummary): string | null {
  const feature = github.feature === UNREAD ? null : github.feature;
  if (feature?.state === 'merged') {
    const on = feature.mergedAt ? ` on ${day(new Date(feature.mergedAt))}` : '';
    return `The feature pull request merged${on}: what was still open was adopted.`;
  }
  const issue = github.issue === UNREAD ? null : github.issue;
  if (issue?.state === 'closed' && feature?.state !== 'open') return 'The feature pull request closed: what was still open was adopted.';
  return null;
}

/** The Outbox tab, from the GitHub summary: null when it could not be read, left out when it was not asked for. */
export function outboxView(github: GithubSummary | null | undefined, { canAnswer = true, demo = false, context = null }: OutboxOptions = {}): OutboxView {
  const nothing = {
    answerUrl: null, open: [], adopted: [], settled: [], ledger: 0, readOnly: true, note: null, signIn: null, sendOff: null, repliesUnread: null, context: null,
  };
  if (github === null) return { state: 'unread', words: GITHUB_UNREAD, ...nothing };
  const outbox = github?.outbox ?? null;
  if (outbox === UNREAD) return { state: 'unread', words: GITHUB_UNREAD, ...nothing };
  if (!github || !outbox || (!outbox.open.length && !outbox.settled.length)) return { state: 'empty', words: OUTBOX_EMPTY, ...nothing };

  const replies = github.replies ?? null;
  const numbering = replies && replies !== UNREAD ? replies.numbering : [];
  const pending = replies && replies !== UNREAD ? replies.pending : [];
  const numberOf = new Map(numbering.map((n) => [n.id, n.number]));
  const pendingOf = new Map(pending.map((p) => [p.number, p]));
  const card = (item: OutboxItem, adopted: boolean) => {
    const number = numberOf.get(item.id) ?? null;
    return cardOf(item, number, adopted, number === null ? undefined : pendingOf.get(number));
  };

  const open = outbox.open
    .map((item, at) => ({ card: card(item, false), at }))
    .sort((a, b) => RANK_WEIGHT[b.card.rank] - RANK_WEIGHT[a.card.rank]
      || (a.card.number ?? Infinity) - (b.card.number ?? Infinity) || a.at - b.at)
    .map(({ card: c }) => c);
  const adoptedItems = outbox.adopted ?? [];
  const adoptedIds = new Set(adoptedItems.map((item) => item.id));
  const adopted = adoptedItems.map((item) => card(item, true))
    .sort((a, b) => (a.number ?? Infinity) - (b.number ?? Infinity));
  const settled = outbox.settled.filter((entry) => !adoptedIds.has(entry.id)).map((entry: SettledItem): SettledEntry => ({
    id: entry.id, number: numberOf.get(entry.id) ?? null, title: entry.title, verdict: entry.verdict, answer: entry.answer,
    by: entry.by ?? null, when: when(entry.at), url: entry.url ?? null,
  }));
  const note = noteOf(github);
  return {
    state: 'items',
    words: null,
    answerUrl: outboxAnswerUrl(github),
    open,
    adopted,
    settled,
    ledger: outbox.settled.length,
    readOnly: note !== null || !canAnswer,
    note,
    signIn: canAnswer ? null : SIGN_IN_TO_ANSWER,
    sendOff: demo ? SEND_OFF.demo : SEND_OFF.notYet,
    repliesUnread: replies === UNREAD ? REPLIES_UNREAD : null,
    context,
  };
}
