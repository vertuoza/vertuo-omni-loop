import type { SectionTab } from '../nav/section-tabs';
import { productHomeHref } from '../products/model';
import type { ProductHome } from './product-home.service';

// The product home's tabs (PRD 1364 s9, s10): each one's address under /app/products/<id>, its label and
// the line under the product's name, in the order the row draws them. The Ledger opens at the bare
// address, every other tab at its own segment. The Ledger counts what waits on you, Questions the outbox
// questions waiting on a person. An archived product (PRD 2232) is read-only: it keeps the tabs that change
// nothing, and opens the Ledger in place of the others.

const ORDER = ['ledger', 'constellation', 'prds', 'ideas', 'roadmap', 'bugs', 'visual', 'questions'] as const;

export type ProductHomeTab = (typeof ORDER)[number];

interface TabDef {
  /** Its address under the product home's; null for the Ledger, at the bare address. */
  segment: string | null;
  label: string;
  lede: string;
}

const TABS: Readonly<Record<ProductHomeTab, TabDef>> = {
  ledger: { segment: null, label: 'Ledger', lede: 'What waits on whom across its PRDs.' },
  constellation: { segment: 'constellation', label: 'Constellation', lede: 'How the product looks now.' },
  prds: { segment: 'prds', label: 'PRDs', lede: 'Every PRD of the product, newest first.' },
  ideas: { segment: 'ideas', label: 'Ideas', lede: 'The product’s ideas, each ready to brainstorm.' },
  roadmap: { segment: 'roadmap', label: 'Roadmap', lede: 'The product’s roadmaps, newest first.' },
  bugs: { segment: 'bugs', label: 'Bug fixes', lede: 'The product’s bug fixes, newest first.' },
  visual: { segment: 'visual', label: 'Visual fixes', lede: 'The product’s visual fixes, newest first.' },
  questions: { segment: 'questions', label: 'Questions', lede: 'The outbox questions of the product’s PRDs that wait on a person.' },
};

/** The tab /app/products/<id>/<segment> opens; null for a segment no tab has. */
export const productHomeTabOf = (segment: string): ProductHomeTab | null => ORDER.find((tab) => TABS[tab].segment === segment) ?? null;

/** The address of `tab` on the product home. */
export function productHomeTabHref(home: ProductHome, tab: ProductHomeTab): string {
  const root = productHomeHref(home.product.id);
  const { segment } = TABS[tab];
  return segment === null ? root : `${root}/${segment}`;
}

/** Tabs that answer at their address but are left out of the row. None now: the Constellation is back
 * (PRD 2174), its labels apart and its lines drawn from the plans' targets. */
const HIDDEN: ReadonlySet<ProductHomeTab> = new Set();

/** The tabs an archived product leaves out: Questions answers them. Knowledge and Repositories & approvers,
 * which edit, are left out of its row too. */
const CHANGES: ReadonlySet<ProductHomeTab> = new Set(['questions']);

/** The tab `home` draws when `tab` is asked: the Ledger, for an archived product, in place of one it leaves out. */
export const tabShown = (home: ProductHome, tab: ProductHomeTab): ProductHomeTab => (home.archived !== null && CHANGES.has(tab) ? 'ledger' : tab);

const COUNTS: Partial<Record<ProductHomeTab, (home: ProductHome) => number>> = {
  ledger: (home) => home.ledger.lanes['on-you'].length,
  questions: (home) => home.questions.length,
};

/** The product home's tabs, as the section tabs draw them. */
export function productHomeTabs(home: ProductHome): SectionTab[] {
  const archived = home.archived !== null;
  const drawn = ORDER.filter((tab) => !HIDDEN.has(tab) && !(archived && CHANGES.has(tab))).map((tab) => {
    const shown: SectionTab = { href: productHomeTabHref(home, tab), label: TABS[tab].label };
    const count = COUNTS[tab];
    return count === undefined ? shown : { ...shown, count: count(home) };
  });
  // After Questions, the Knowledge tab (PRD 1795 s2), then the Repositories & approvers tab (s11): each
  // draws itself at its own static route. An archived product has neither.
  if (archived) return drawn;
  return [...drawn, { href: `${productHomeHref(home.product.id)}/knowledge`, label: 'Knowledge' }, { href: `${productHomeHref(home.product.id)}/repositories`, label: 'Repositories & approvers' }];
}

/** The line under the product's name on `tab`. */
export const ledeOf = (tab: ProductHomeTab): string => TABS[tab].lede;
