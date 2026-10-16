import { sortItems } from 'vertuo-omni-plan/kit/lib/outbox/comment.ts';
import { parseOutboxItem } from 'vertuo-omni-plan/kit/lib/outbox/outbox.ts';
import { z } from 'zod';
import type { QuestionView } from '../../questions/questions.contract';
import { outboxTabPath } from './history-at';
import { workPath } from './work';

// A product PRD's Outbox tab (PRD 2011 s15): the PRD's items from the server's rows (outbox_items with
// their settlements, PRD 1548), open and settled, where a repository PRD's tab reads GitHub
// (./outbox-view.ts, unchanged). An open item is drawn as the product's Questions tab draws a question
// (src/questions), so it is answered in place through the same route, /api/outbox/answer: a person's
// sign-in only (BR-PRODUCT-94), and an answer, once given, never changes (BR-PRODUCT-12). A settled item
// shows its verdict, its answer as given, who gave it and when. Pure.

/** What the tab says when the PRD has raised no item. */
export const PRODUCT_OUTBOX_EMPTY = 'No decision yet: the outbox fills while the PRD is built.';

const Settlement = z.object({
  verdict: z.string(),
  basis: z.string(),
  answer: z.string().nullable(),
  channel: z.string().nullable(),
  settler_login: z.string(),
  settled_at: z.string(),
});

/** One item of the PRD as outbox_items holds it, with its settlements (at most one). */
export const StoredProductItem = z.object({
  item: z.string(),
  rank: z.enum(['medium', 'high', 'human-action']),
  repository: z.string().nullable(),
  body: z.string(),
  raised_at: z.string(),
  outbox_settlements: z.array(Settlement),
});
export type StoredProductItem = z.infer<typeof StoredProductItem>;

/** What the tab reads: the PRD (its dossier, its id as people write it, its title) and its items. */
export interface ProductOutboxRows {
  dossier: string;
  /** `mobile-12`. */
  prdId: string;
  title: string;
  items: readonly StoredProductItem[];
}

/** A settled item as the tab lists it. */
export interface SettledProductItem {
  id: string;
  question: string;
  /** `keeps what was built`, `changes what was built` or `adopted when raised`. */
  verdict: string;
  /** The answer as given; null for an adoption, which nobody answered. */
  answer: string | null;
  by: string;
  at: string;
}

export interface ProductOutboxView {
  prdId: string;
  /** Open items, worst rank first, as the Questions tab draws a question. */
  open: QuestionView[];
  /** Settled items, the latest settled first. */
  settled: SettledProductItem[];
}

const VERDICT_WORDS: Readonly<Record<string, string>> = {
  agreed: 'keeps what was built', drifted: 'changes what was built', adopted: 'adopted when raised',
};

/** The plain words and options of an item, read from its body by the kit's one item parser. */
function sectionsOf(body: string) {
  const parsed = parseOutboxItem(body);
  return parsed.ok ? parsed.item.sections : {};
}

/** The tab, from the PRD's rows. */
export function productOutboxView(rows: ProductOutboxRows): ProductOutboxView {
  const listed = rows.items.map((item) => ({ id: item.item, rank: item.rank, item }));
  const open = sortItems(listed.filter(({ item }) => item.outbox_settlements.length === 0)).map(({ item }): QuestionView => {
    const sections = sectionsOf(item.body);
    return {
      dossier: rows.dossier, prdHref: workPath('prd', rows.dossier), outboxHref: outboxTabPath(rows.dossier), prdLabel: rows.prdId, title: rows.title,
      repo: item.repository, id: item.item, rank: item.rank, question: sections.questionPlain ?? item.item,
      forWhom: item.rank === 'human-action' ? 'waits on a person who can do it' : 'waits on a person',
      options: sections.options ?? [], answerOn: rows.prdId,
    };
  });
  const settled = listed.flatMap(({ item }) => {
    const [s] = item.outbox_settlements;
    return s === undefined ? [] : [{ item, s }];
  }).sort((a, b) => b.s.settled_at.localeCompare(a.s.settled_at)).map(({ item, s }): SettledProductItem => ({
    id: item.item, question: sectionsOf(item.body).questionPlain ?? item.item, verdict: VERDICT_WORDS[s.verdict] ?? s.verdict,
    answer: s.answer, by: s.settler_login, at: s.settled_at,
  }));
  return { prdId: rows.prdId, open, settled };
}
