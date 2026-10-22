import { sortItems } from 'omni-loop/kit/lib/outbox/comment.ts';
import { parseOutboxItem } from 'omni-loop/kit/lib/outbox/outbox.ts';
import { outboxTabPath } from '../dossier/page/history-at';
import { workPath } from '../dossier/page/work';
import { productFilterOf, readProductChoice, type ProductChoice, type ProductFilterView } from '../product-filter/product-filter.service';
import type { QuestionView } from '../questions/questions.contract';
import type {
  StoredAuthor, StoredItemPrd, StoredOpenItem, StoredQuestionProduct, StoredRepoLink, StoredRepoPrd, StoredRepoWaiting,
} from './outbox-questions.repository';

// Work › Questions › Outbox (PRD 2011 s14): every open outbox item of the viewer's workspaces, across every
// product, as the product's own Questions tab draws a question (src/questions), so an answer given here is
// the one that tab records (the same route, /api/outbox/answer, a person's sign-in only: BR-PRODUCT-94, and
// an answer, once given, never changes: BR-PRODUCT-12). An item is open until it has a settlement. The ones
// that wait on the viewer come first, then the others; inside each, the worst rank first, as the outbox gate
// counts them. Each says whom it waits on, read from its rank and its PRD's author, and its product, in its
// PRD's title. PRD 2124: the questions waiting on repository PRDs (prd_outbox) join the list, a link to their
// PRD page's Outbox tab and the time they were read, a repository's product being its links'. `?product=` narrows them to one product, or to none, as the Work lists are. Pure.

/** The page's address. */
export const OUTBOX_PATH = '/ask/outbox';

/** Where Google sends the person back after signing in on Outbox. */
export const OUTBOX_CALLBACK = `${OUTBOX_PATH}/callback`;

/** What the page reads. */
export interface OutboxRows {
  items: readonly StoredOpenItem[];
  prds: readonly StoredItemPrd[];
  products: readonly StoredQuestionProduct[];
  authors: readonly StoredAuthor[];
  /** The repository PRDs, their stored outboxes' waiting items and their repositories' product links (PRD 2124). */
  repoPrds: readonly StoredRepoPrd[];
  repoWaiting: readonly StoredRepoWaiting[];
  repoLinks: readonly StoredRepoLink[];
  /** The viewer's account. */
  me: string;
}

/** The page as it draws: its rows, how many items are open in all, and the product filter. */
export interface OutboxView {
  questions: QuestionView[];
  /** Every open item of the workspaces, whatever the filter. */
  open: number;
  /** How many of those wait on the viewer. */
  mine: number;
  filter: ProductFilterView | null;
}

type Query = Readonly<Record<string, string | string[] | undefined>>;

/** Whom an item waits on, from its rank and its PRD's author: a person who can act for one that asks a
 * person to act, otherwise the author: you, their GitHub login, or `its author` when the login is unknown. */
function waitsOn(rank: string, author: string | null, me: string, logins: ReadonlyMap<string, string>): { words: string; mine: boolean } {
  if (rank === 'human-action') return { words: 'waits on a person who can do it', mine: false };
  if (author !== null && author === me) return { words: 'waits on you', mine: true };
  const login = author === null ? undefined : logins.get(author);
  return { words: login === undefined ? 'waits on its author' : `waits on ${login}`, mine: false };
}

const keeps = (choice: ProductChoice, products: readonly string[]): boolean =>
  choice.kind === 'all' || (choice.kind === 'none' ? products.length === 0 : products.some((p) => p.toLowerCase() === choice.id));

/** When a repository row was read, to the minute, in UTC. */
const asOf = (syncedAt: string): string => {
  const at = new Date(syncedAt);
  return Number.isNaN(at.getTime()) ? syncedAt : `${at.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
};

/** The product PRD's id (`mobile-12`), or null when its product has no key or it has no number in it. */
const prdIdOf = (prd: StoredItemPrd, product: StoredQuestionProduct | undefined): string | null =>
  product?.key != null && prd.product_seq !== null ? `${product.key}-${String(prd.product_seq)}` : null;

/** The plain words and options of an item, read from its body by the kit's one item parser. */
function sectionsOf(body: string) {
  const parsed = parseOutboxItem(body);
  return parsed.ok ? parsed.item.sections : {};
}

/** One open item as the Questions tab draws a question, and whether it waits on the viewer. */
function questionOf(
  item: StoredOpenItem, prd: StoredItemPrd, product: StoredQuestionProduct | undefined, who: { words: string; mine: boolean },
): { view: QuestionView; mine: boolean; products: string[] } {
  const prdId = prdIdOf(prd, product);
  const sections = sectionsOf(item.body);
  const view: QuestionView = {
    dossier: prd.id, prdHref: workPath('prd', prd.id), outboxHref: outboxTabPath(prd.id), prdLabel: prdId ?? String(prd.product_seq ?? ''),
    title: product === undefined ? prd.title : `${product.name} · ${prd.title}`, repo: item.repository, id: item.item, rank: item.rank,
    question: sections.questionPlain ?? item.item, forWhom: who.words, options: sections.options ?? [], answerOn: prdId,
  };
  return { view, mine: who.mine, products: prd.product_id === null ? [] : [prd.product_id] };
}

type Ranked = { view: QuestionView; mine: boolean; products: string[]; rank: StoredOpenItem['rank']; id: string };

/** The questions waiting on a repository PRD, from its stored outbox: answered on its PRD page's Outbox tab, with
 * the time the stored outbox was read, since it can lag behind GitHub. A PRD with no dossier here is skipped. */
function repoQuestions(rows: OutboxRows, products: ReadonlyMap<string, StoredQuestionProduct>, logins: ReadonlyMap<string, string>): Ranked[] {
  const prds = new Map(rows.repoPrds.map((p) => [`${p.workspace_id}\n${p.home_repo.toLowerCase()}\n${String(p.prd)}`, p]));
  const linked = (workspace: string, repository: string) =>
    rows.repoLinks.filter((l) => l.workspace_id === workspace && l.repository.toLowerCase() === repository).map((l) => l.product_id);
  return rows.repoWaiting.flatMap((outbox) => {
    const repository = outbox.repository.toLowerCase();
    const prd = prds.get(`${outbox.workspace_id}\n${repository}\n${String(outbox.prd)}`);
    if (prd === undefined) return [];
    const ids = linked(outbox.workspace_id, repository);
    const product = ids.length === 0 ? undefined : products.get(ids[0] ?? '');
    return outbox.waiting.map((w): Ranked => {
      const who = waitsOn(w.rank, prd.opened_by, rows.me, logins);
      const view: QuestionView = {
        dossier: prd.id, prdHref: workPath('prd', prd.id), outboxHref: outboxTabPath(prd.id), prdLabel: String(prd.prd),
        title: product === undefined ? prd.title : `${product.name} · ${prd.title}`, repo: repository, id: w.id, rank: w.rank,
        question: w.question, forWhom: `${who.words} · as of ${asOf(outbox.synced_at)}`, options: [], answerOn: null,
      };
      return { view, mine: who.mine, products: ids, rank: w.rank, id: w.id };
    });
  });
}

/** The Outbox page from the rows read, the viewer's account and the address's filter. */
export function outboxViewOf(rows: OutboxRows, query: Query = {}): OutboxView {
  const prds = new Map(rows.prds.map((p) => [p.id, p]));
  const products = new Map(rows.products.map((p) => [p.id, p]));
  const logins = new Map(rows.authors.flatMap((a) => (a.github_login === null ? [] : [[a.user_id, a.github_login] as const])));
  const choice = readProductChoice(query);
  const listed = rows.items.flatMap((item) => {
    const prd = prds.get(item.dossier_id);
    return prd === undefined || item.outbox_settlements.length > 0 ? [] : [{ id: item.item, rank: item.rank, item, prd }];
  });
  const own = sortItems(listed).map(({ item, prd }): Ranked => ({
    ...questionOf(item, prd, products.get(prd.product_id ?? ''), waitsOn(item.rank, prd.opened_by, rows.me, logins)), rank: item.rank, id: item.item,
  }));
  const all = sortItems([...own, ...repoQuestions(rows, products, logins)]);
  // The viewer's first; the sort is stable, so the worst-first order holds inside each group.
  const ordered = [...all].sort((a, b) => Number(b.mine) - Number(a.mine));
  const filter = rows.products.length === 0 && choice.kind === 'all' ? null : productFilterOf(rows.products, choice, OUTBOX_PATH, query);
  return {
    questions: ordered.filter((q) => keeps(choice, q.products)).map((q) => q.view),
    open: all.length,
    mine: all.filter((q) => q.mine).length,
    filter,
  };
}
