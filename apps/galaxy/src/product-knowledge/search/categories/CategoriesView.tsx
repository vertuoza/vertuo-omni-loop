import Link from 'next/link';
import type { Query } from '../../../nav/query';
import { Section } from '../../KnowledgeLists';
import { NONE, dayOf, excerpt, sectionHref, type DomainChoice } from '../../knowledge-sections';
import { NO_SEARCH, PERIODS, noSearchIn, percent, type Period } from '../search-stats';
import {
  categoriesOf, categoryLabel, categoryParam, hasCategory, openCategoryOf,
  type CategorizedRow, type CategorySummary, type GroupHead, type GroupSummary,
} from './categories-stats';

// The Search section's Categories view, drawn (PRD omni-loop-7 s4): over 7, 30 or 90 days each category with its
// searches, zero-hit rate, words-fallback rate and opened@5, the most searched first; the open one (?category=,
// else the first) with its most-asked groups, each opening to its questions. With no category yet it says so in
// one line and still lists the groups. Drawn from categories-stats.ts; CategoriesSection.tsx reads the rows.

export const CATEGORIES_TITLE = 'Search categories';
export const CATEGORIES_LEDE = 'Which topics agents ask this product’s MCP server most, and how well search answers each. Near-identical questions are grouped; a category is one of the product’s domains, chosen by Jev.';
export const NO_CATEGORY = 'No search has a category yet: Jev’s search-category decision is off in Settings › Jev, or the categorize job has not run. The groups are listed all the same.';

/** The most-asked groups an open category shows. */
const MOST_GROUPS = 20;

const categoriesHref = (product: string): string => `${sectionHref(product, 'search')}/categories`;

const viewHref = (product: string, days: Period, category: string | null = null): string =>
  `${categoriesHref(product)}?days=${String(days)}${category === null ? '' : `&category=${encodeURIComponent(category)}`}`;

/** The Search section's two views, the one shown marked: its overview and its categories. */
export function SearchViews({ product, shown }: { product: string; shown: 'overview' | 'categories' }) {
  const views: [string, string, boolean][] = [
    ['Overview', sectionHref(product, 'search'), shown === 'overview'],
    ['Categories', categoriesHref(product), shown === 'categories'],
  ];
  return (
    <nav className="kn-filters kn-views" aria-label="Search views">
      {views.map(([label, href, current]) => <Link key={label} href={href} aria-current={current ? 'true' : undefined}>{label}</Link>)}
    </nav>
  );
}

function Periods({ product, days, open }: { product: string; days: Period; open: string | null }) {
  return (
    <nav className="kn-filters" aria-label="Period">
      {PERIODS.map((p) => <Link key={p} href={viewHref(product, p, open)} aria-current={p === days ? 'true' : undefined}>Last {p} days</Link>)}
    </nav>
  );
}

const CATEGORY_HEADS = ['Category', 'Searches', 'Zero-hit rate', 'Words fallback', 'Opened@5', 'Groups'];

function Categories({ product, days, categories, open, domains }: {
  product: string; days: Period; categories: readonly CategorySummary[]; open: CategorySummary | null; domains: readonly DomainChoice[];
}) {
  return (
    <div className="kn-scroll" data-region="categories">
      <table className="kn-table">
        <thead><tr>{CATEGORY_HEADS.map((head) => <th key={head} scope="col">{head}</th>)}</tr></thead>
        <tbody>
          {categories.map((c) => {
            const param = categoryParam(c.category);
            return (
              <tr key={param} data-category={param} data-open={c === open ? 'true' : undefined}>
                <th scope="row" className="kn-category"><Link href={viewHref(product, days, param)} aria-current={c === open ? 'true' : undefined}>{categoryLabel(c.category, domains)}</Link></th>
                <td>{c.searches}</td>
                <td>{percent(c.zeroHit)}</td>
                <td>{percent(c.words)}</td>
                <td title={`of ${String(c.opened)} searches an entry was opened from`}>{percent(c.openedAt5)}</td>
                <td>{c.groups.length}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const QUESTION_HEADS = ['Question', 'Mode', 'Total', 'Opened rank', 'Asked'];

function Questions({ rows }: { rows: readonly CategorizedRow[] }) {
  return (
    <div className="kn-scroll">
      <table className="kn-table">
        <thead><tr>{QUESTION_HEADS.map((head) => <th key={head} scope="col">{head}</th>)}</tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-search={row.id}>
              <td className="kn-text" title={row.query ?? ''}>{row.query === null ? NONE : excerpt(row.query, 60)}</td>
              {[row.mode ?? NONE, String(row.total), row.openedRank === null ? NONE : String(row.openedRank), dayOf(row.askedAt)].map((cell, i) => <td key={QUESTION_HEADS[i + 1]}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const searchesWord = (n: number): string => `${String(n)} ${n === 1 ? 'search' : 'searches'}`;

function Group({ group }: { group: GroupSummary }) {
  return (
    <details className="kn-group" data-group={group.key}>
      <summary>
        <span className="kn-group-question" title={group.question}>{group.question === '' ? NONE : excerpt(group.question, 80)}</span>
        <span className="kn-group-count">{searchesWord(group.count)}</span>
        <span className="kn-group-rank ask-muted">worst opened rank {group.worstOpened ?? NONE}</span>
      </summary>
      <Questions rows={group.rows} />
    </details>
  );
}

function Groups({ category, domains }: { category: CategorySummary; domains: readonly DomainChoice[] }) {
  const shown = category.groups.slice(0, MOST_GROUPS);
  const left = category.groups.length - shown.length;
  return (
    <div className="kn-groups" data-region="groups">
      <h3>{categoryLabel(category.category, domains)}: most-asked questions</h3>
      <p className="ask-muted">Each group holds near-identical questions, headed by the first one asked. Open one to read its questions.</p>
      {shown.map((group) => <Group key={group.key} group={group} />)}
      {left > 0 ? <p className="ask-muted">{left} more {left === 1 ? 'group' : 'groups'}, asked less.</p> : null}
    </div>
  );
}

export function CategoriesView({ product, rows, groups, days, now, query, domains }: {
  product: string; rows: readonly CategorizedRow[]; groups: readonly GroupHead[]; days: Period; now: number; query: Query; domains: readonly DomainChoice[];
}) {
  if (rows.length === 0) return <Section id="search-categories-title" title={CATEGORIES_TITLE} lede={CATEGORIES_LEDE}><p className="products-empty">{NO_SEARCH}</p></Section>;
  const categories = categoriesOf(rows, groups, days, now);
  const open = openCategoryOf(categories, query);
  const shownParam = open === null ? null : categoryParam(open.category);
  return (
    <Section id="search-categories-title" title={CATEGORIES_TITLE} lede={CATEGORIES_LEDE}>
      <Periods product={product} days={days} open={shownParam} />
      {open === null ? <p className="products-empty">{noSearchIn(days)}</p> : (
        <>
          {hasCategory(categories) ? null : <p className="ask-muted" data-note="no-category">{NO_CATEGORY}</p>}
          <Categories product={product} days={days} categories={categories} open={open} domains={domains} />
          <Groups category={open} domains={domains} />
        </>
      )}
    </Section>
  );
}
