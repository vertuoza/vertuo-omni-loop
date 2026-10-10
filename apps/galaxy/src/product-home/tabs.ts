import type { SectionTab } from '../nav/section-tabs';
import { productHomeHref } from '../products/model';
import type { ProductHome } from './product-home.service';

// The product home's tabs (PRD 1364 s9, s10): each one's address under /app/products/<id>, its label and
// the line under the product's name, in the order the row draws them. The Ledger opens at the bare
// address, every other tab at its own segment. The Ledger counts what waits on you, Questions the outbox
// questions waiting on a person.

const ORDER = ['ledger', 'prds', 'ideas', 'roadmap', 'bugs', 'visual', 'questions'] as const;

export type ProductHomeTab = (typeof ORDER)[number];

interface TabDef {
  /** Its address under the product home's; null for the Ledger, at the bare address. */
  segment: string | null;
  label: string;
  lede: string;
}

const TABS: Readonly<Record<ProductHomeTab, TabDef>> = {
  ledger: { segment: null, label: 'Ledger', lede: 'What waits on whom, across the product’s PRDs.' },
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

const COUNTS: Partial<Record<ProductHomeTab, (home: ProductHome) => number>> = {
  ledger: (home) => home.ledger.lanes['on-you'].length,
  questions: (home) => home.questions.length,
};

/** The product home's tabs, as the section tabs draw them. */
export function productHomeTabs(home: ProductHome): SectionTab[] {
  const drawn = ORDER.map((tab) => {
    const shown: SectionTab = { href: productHomeTabHref(home, tab), label: TABS[tab].label };
    const count = COUNTS[tab];
    return count === undefined ? shown : { ...shown, count: count(home) };
  });
  // Last, the Repositories & approvers tab (s11), which draws itself at its own static route.
  return [...drawn, { href: `${productHomeHref(home.product.id)}/repositories`, label: 'Repositories & approvers' }];
}

/** The line under the product's name on `tab`. */
export const ledeOf = (tab: ProductHomeTab): string => TABS[tab].lede;
