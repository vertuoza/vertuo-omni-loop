// The Outbox tab of /prd/<id> (PRD 251, "The Outbox tab"), as a pure function of the latest outbox the
// viewer may read (row-level security already left out every other workspace's): the state the spec's
// table names — no outbox, the read failed, open, merged or closed — and the cards.
//
// Each open item, adopted item and settled entry comes as the omni-loop App sent it: an item's file
// verbatim, read here with the kit's own parser (parseOutboxItem), so the tab shows exactly the
// sections the kit wrote. Its text is rendered with PRD 216's markdown renderer, raw HTML off. An item
// the parser refuses still shows, as its text, with nothing to pick. A pending answer — what the
// replies say that nobody has settled yet, one per number — rides on its question's card.
//
// Runs on the server: the page ships the cards' HTML to the tab, never the parser or the renderer.
import { parseOutboxItem, RANK_ORDER } from 'vertuo-omni-plan/kit/lib/outbox/outbox.mjs';
import { renderMarkdown } from '../dossier/markdown';
import { StoredOutbox } from './contract';
import type { OutboxRead } from './count';

export { openCount, type OutboxRead } from './count';

/** An answer nobody has settled yet: what it said, who, where (`on GitHub`) and when. */
export type PendingView = { text: string; by: string; where: string; when: string | null; url: string | null };

/** An option of a decision: its letter, its text rendered, and whether it is what was built (A). */
export type OptionView = { letter: string; html: string; built: boolean };

export type Chip = { id: string; href: string };
export type Detail = { label: string; html: string };

export type QuestionCard = {
  number: number;
  id: string;
  rank: string;
  /** A decision picks a letter; a human action is done or not done. */
  kind: 'decision' | 'action';
  /** Adopted unless someone objects: picking another letter objects. */
  adopted: boolean;
  intro: string | null;
  punchline: string | null;
  /** The question and the decision in plain words, rendered; null when the item could not be read. */
  question: string | null;
  decision: string | null;
  options: OptionView[];
  /** A human action's steps, rendered. */
  steps: string | null;
  bearsOn: Chip[];
  details: Detail[];
  pending: PendingView | null;
  /** The whole item rendered, when the kit could not read it; null otherwise. */
  raw: string | null;
};

export type SettledView = { number: number | null; id: string; verdict: string; by: string | null; at: string | null; answer: string; url: string | null };

export type OutboxShown = {
  state: 'open' | 'merged' | 'closed';
  pr: { number: number; url: string };
  /** Merged or closed: nothing can be answered any more. */
  readOnly: boolean;
  /** `The feature pull request merged on 28 Sep 2026: …`, or null while it is open. */
  note: string | null;
  openCount: number;
  open: QuestionCard[];
  adopted: QuestionCard[];
  settled: SettledView[];
};

export type OutboxView = { state: 'none' } | { state: 'failed' } | OutboxShown;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** `27 Sep 2026`, in UTC. */
const day = (at: Date) => `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]} ${at.getUTCFullYear()}`;

/** `27 Sep 2026, 09:30 UTC`, or `27 Sep 2026` for a date alone; the text itself when it is neither. */
export function when(text: string | null): string | null {
  if (!text) return null;
  const at = new Date(text);
  if (Number.isNaN(at.getTime())) return text;
  return DATE_ONLY.test(text) ? day(at) : `${day(at)}, ${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())} UTC`;
}

const WHERE = { page: 'on the Omni page', terminal: 'in the terminal', github: 'on GitHub' } as const;

const html = (text: string | undefined | null) => (text && text.trim() ? renderMarkdown(text).html : null);

/** The details disclosure, in the order the kit writes them. */
const DETAILS: ReadonlyArray<[label: string, field: string]> = [
  ['What I had to decide', 'whatIHadToDecide'],
  ['What I did meanwhile', 'whatIDidMeanwhile'],
  ['What it costs to change later', 'whatItCostsToChangeLater'],
  ['What I could not know', 'whatICouldNotKnow'],
];

type ParsedItem = {
  rank: string;
  bearsOn: string;
  sections: Record<string, string | undefined> & { options?: Array<{ letter: string; text: string }> };
};

/** `P-PRODUCT-3, ADR-0004` → a chip each; `none` → none. */
function chips(bearsOn: string): Chip[] {
  return bearsOn.split(/[,\s]+/).map((id) => id.trim()).filter((id) => id && id.toLowerCase() !== 'none')
    .map((id) => ({ id, href: `/knowledge?entry=${encodeURIComponent(id)}` }));
}

function oneLine(text: string | undefined) {
  const line = text?.replace(/\s+/g, ' ').trim();
  return line ? line : null;
}

function cardOf(
  { number, id, rank, text }: { number: number; id: string; rank: string; text: string },
  adopted: boolean,
  pending: PendingView | null,
): QuestionCard {
  const parsed = parseOutboxItem(text, { file: null }) as { ok: true; item: ParsedItem } | { ok: false };
  if (!parsed.ok) {
    return {
      number, id, rank, kind: rank === 'human-action' ? 'action' : 'decision', adopted, intro: null, punchline: null,
      question: null, decision: null, options: [], steps: null, bearsOn: [], details: [], pending, raw: html(text) ?? '',
    };
  }
  const { item } = parsed;
  const s = item.sections;
  const action = item.rank === 'human-action';
  return {
    number,
    id,
    rank: item.rank,
    kind: action ? 'action' : 'decision',
    adopted,
    intro: s.introFun && s.punchlineFun ? oneLine(s.introFun) : null,
    punchline: s.introFun && s.punchlineFun ? oneLine(s.punchlineFun) : null,
    question: html(s.questionPlain ?? s.whatIHadToDecide),
    decision: html(s.decisionPlain),
    options: action ? [] : (s.options ?? []).map((o) => ({ letter: o.letter, html: html(o.text) ?? '', built: o.letter === 'A' })),
    steps: action ? html(s.personSteps) : null,
    bearsOn: chips(item.bearsOn),
    details: DETAILS.flatMap(([label, field]) => {
      const rendered = html(s[field]);
      return rendered ? [{ label, html: rendered }] : [];
    }),
    pending,
    raw: null,
  };
}

const urgency = (a: QuestionCard, b: QuestionCard) =>
  ((RANK_ORDER as Record<string, number>)[b.rank] ?? -1) - ((RANK_ORDER as Record<string, number>)[a.rank] ?? -1) || a.number - b.number;

export function outboxView(read: OutboxRead): OutboxView {
  if ('failed' in read) return { state: 'failed' };
  const { row } = read;
  if (!row) return { state: 'none' };
  const stored = StoredOutbox.safeParse(row.outbox);
  if (!stored.success) return { state: 'failed' };
  const { open, adopted, pending, settled } = stored.data;

  const pendingOf = new Map(pending.map((p): [number, PendingView] => [
    p.number, { text: p.text, by: p.by, where: WHERE[p.via], when: when(p.at), url: p.url },
  ]));
  const readOnly = row.state !== 'open';
  return {
    state: row.state,
    pr: { number: row.pr_number, url: row.pr_url },
    readOnly,
    note: readOnly
      ? `The feature pull request ${row.state} on ${day(new Date(row.evaluated_at))}: what was still open was adopted.`
      : null,
    openCount: readOnly ? 0 : open.length,
    open: open.map((item) => cardOf(item, false, pendingOf.get(item.number) ?? null)).sort(urgency),
    adopted: adopted.map((item) => cardOf({ ...item, rank: 'medium' }, true, pendingOf.get(item.number) ?? null))
      .sort((a, b) => a.number - b.number),
    settled: settled.map((entry) => ({
      number: entry.number, id: entry.id, verdict: entry.verdict, by: entry.approvedBy, at: when(entry.approvedAt),
      answer: entry.answer, url: entry.channelUrl,
    })),
  };
}
