import { Badge, Select } from '@omni/ui';
import { PersonChip } from '../../people/PersonChip';
import { CATEGORIES, CATEGORY_LABELS } from '../classify';
import { Screenshots } from './History';
import {
  DONE_PATH, filtered, historyHref,
  type CategoryCount, type HistoryChoices, type HistoryFilters, type HistoryItem,
} from './workspace-history';
// Its own styles (bug #3167): it is drawn on the Inbox's Done tab, under the /app layout, which imports neither.
import './history.css';
import './share.css';

// The workspace's history (PRD 144), on the Inbox's Done tab (PRD omni-loop-22), as visual update
// #3169 draws it (pick A of round 3): the categories in a sidebar on the left, each a link with its
// count; beside it one line of search, More filters and the count, sent as a GET to this same page so
// it works before any script runs; then the rounds that pass, newest first, grouped by day, each row
// opening /ask/q/<round>.

type Option = { value: string; label: string };

/** A category's label back to its id, for the row's data-category. */
const IDS: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [CATEGORY_LABELS[c], c]));

/** A filter of More filters, shown only when it offers a choice or is already set. */
function Pick({ name, label, all, value, options }: { name: string; label: string; all: string; value: string | undefined; options: Option[] }) {
  if (options.length < 2 && value === undefined) return null;
  return (
    <div className="done-field">
      <span className="done-field-label">{label}</span>
      <Select size="sm" label={label} name={name} defaultValue={value ?? ''} options={[{ value: '', label: all }, ...options]} />
    </div>
  );
}

function Bar({ choices, filters, shown, total }: { choices: HistoryChoices; filters: HistoryFilters; shown: number; total: number }) {
  const plain = (values: string[]) => values.map((v) => ({ value: v, label: v }));
  const more = filters.repo !== undefined || filters.prd !== undefined || filters.skill !== undefined || filters.askedBy !== undefined || filters.answeredBy !== undefined;
  return (
    <form className="done-bar" method="get" action={DONE_PATH} role="search">
      {filters.category && <input type="hidden" name="category" value={filters.category} />}
      <input
        className="omni-input done-search" type="search" name="q" defaultValue={filters.search ?? ''}
        aria-label="Search questions and answers" placeholder="Search questions and answers"
      />
      <details className="done-more" open={more}>
        <summary className="omni-button omni-button--sm">More filters</summary>
        <div className="done-more-panel">
          <Pick name="repo" label="Repository" all="All repositories" value={filters.repo} options={plain(choices.repos)} />
          <Pick name="prd" label="PRD" all="All PRDs" value={filters.prd?.toString()} options={choices.prds.map((n) => ({ value: String(n), label: `PRD #${n}` }))} />
          <Pick name="skill" label="Skill" all="All skills" value={filters.skill} options={plain(choices.skills)} />
          <Pick name="asked" label="Asked by" all="Anyone" value={filters.askedBy} options={choices.askedBy.map((c) => ({ value: c.id, label: c.label }))} />
          <Pick name="answered" label="Answered by" all="Anyone" value={filters.answeredBy} options={choices.answeredBy.map((c) => ({ value: c.id, label: c.label }))} />
          <button type="submit" className="omni-button omni-button--sm omni-button--primary">Apply</button>
        </div>
      </details>
      <span className="done-count">
        {filtered(filters) ? <>{shown} of {total} · <a className="ask-history-clear" href={DONE_PATH}>Clear filters</a></> : <>{total} questions</>}
      </span>
    </form>
  );
}

function Categories({ categories, filters, all }: { categories: CategoryCount[]; filters: HistoryFilters; all: number }) {
  const total = categories.length > 0 ? categories.reduce((sum, c) => sum + c.count, 0) : all;
  const link = (id: CategoryCount['id'] | undefined, label: string, count: number) => (
    <a key={id ?? 'all'} className="done-cat" href={historyHref(filters, { category: id })} aria-current={filters.category === id ? 'page' : undefined}>
      {label} <span className="done-cat-count">{count}</span>
    </a>
  );
  return (
    <nav className="done-cats" aria-label="Categories">
      <h2 className="done-cats-title">Categories</h2>
      {link(undefined, 'All', total)}
      {categories.map((c) => link(c.id, c.label, c.count))}
    </nav>
  );
}

const STATUS: Record<HistoryItem['status'], string> = { open: 'waiting', answered: 'answered', abandoned: 'moved to the terminal' };

/** Who asked and who answered, each as a chip (PRD 652): the text reads as it did, the faces added. */
function Who({ item }: { item: HistoryItem }) {
  const asked = <>asked by <PersonChip person={{ name: item.askedBy, face: item.askedByFace }} size="inline" link={false} /></>;
  if (item.answeredBy === null || item.answeredByFace === null) return <span className="done-who">{asked}{` · ${STATUS[item.status]}`}</span>;
  const via = item.via ? `, ${item.via === 'page' ? 'on the page' : 'in the terminal'}` : '';
  return (
    <span className="done-who">
      {asked}{' · answered by '}<PersonChip person={{ name: item.answeredBy, face: item.answeredByFace }} size="inline" link={false} />{via}
    </span>
  );
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** How long ago, as the Open tab says it. */
function ago(at: string, now: number): string {
  const ms = Math.max(0, now - Date.parse(at));
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / 60_000))} min ago`;
  if (ms < DAY) return `${Math.round(ms / HOUR)} h ago`;
  const days = Math.round(ms / DAY);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

/** The day title a row falls under, in UTC as the server reads it: Today, Yesterday, then the date. */
function dayOf(at: string, now: number): string {
  const day = (t: number) => new Date(t).toISOString().slice(0, 10);
  const its = day(Date.parse(at));
  if (its === day(now)) return 'Today';
  if (its === day(now - DAY)) return 'Yesterday';
  return new Date(Date.parse(at)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function Row({ item, now }: { item: HistoryItem; now: number }) {
  return (
    <li>
      <a className="done-row" href={item.href}>
        <span className="done-row-main">
          <span className="done-context" title={item.context.join(' · ')}>{item.context.join(' · ')}</span>
          <span className="done-question">
            {item.question}
            {item.more > 0 && <span className="done-more-count"> (+{item.more} more)</span>}
          </span>
          {item.answer !== null && (
            <span className="done-answer">→ <span className="ask-history-answer">{item.answer}</span><Screenshots count={item.screenshots} /></span>
          )}
          <Who item={item} />
        </span>
        <span className="done-row-end">
          <time className="done-age" dateTime={item.at} title={`${item.at.slice(0, 16).replace('T', ' ')} UTC`} suppressHydrationWarning>{ago(item.at, now)}</time>
          <span data-category={IDS[item.category] ?? 'unsorted'}><Badge tone="neutral">{item.category}</Badge></span>
        </span>
      </a>
    </li>
  );
}

function Days({ items, now }: { items: HistoryItem[]; now: number }) {
  const days: Array<{ title: string; items: HistoryItem[] }> = [];
  for (const item of items) {
    const title = dayOf(item.at, now);
    const last = days.at(-1);
    if (last?.title === title) last.items.push(item);
    else days.push({ title, items: [item] });
  }
  return (
    <div className="done-days">
      {days.map((day) => (
        <section key={day.title} className="done-day-group" aria-label={day.title}>
          <h2 className="done-day">{day.title} <span className="done-day-count">{day.items.length}</span></h2>
          <ol className="done-list">{day.items.map((item) => <Row key={item.roundId} item={item} now={now} />)}</ol>
        </section>
      ))}
    </div>
  );
}

export function WorkspaceHistory({ items, choices, filters, categories = [], all = items.length, now = Date.now() }: {
  items: HistoryItem[];
  choices: HistoryChoices;
  filters: HistoryFilters;
  /** The categories' counts under the other filters (`categoryCounts`); without them, the sidebar holds All alone. */
  categories?: CategoryCount[];
  /** How many rounds the history holds before any filter. */
  all?: number;
  now?: number;
}) {
  const nothingYet = items.length === 0 && !filtered(filters);
  if (nothingYet) {
    return (
      <section className="done-empty">
        <h2 className="done-empty-title">No question yet</h2>
        <p className="done-muted">Every question an agent asks your workspace while ask mode is on is kept here.</p>
      </section>
    );
  }
  return (
    <div className="done">
      <Categories categories={categories} filters={filters} all={all} />
      <div className="done-main">
        <Bar choices={choices} filters={filters} shown={items.length} total={all} />
        {items.length === 0 ? (
          <section className="done-empty">
            <h2 className="done-empty-title">No question matches</h2>
            <p className="done-muted">Loosen a filter, or search another word.</p>
          </section>
        ) : (
          <Days items={items} now={now} />
        )}
      </div>
    </div>
  );
}
