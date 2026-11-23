'use client';

import { Popover, Select } from '@omni/ui';
import { useEffect, useRef, useState } from 'react';
import { PersonChip } from '../../people/PersonChip';
import { detailsKey, isTyping } from '../../inbox/keys';
import { CATEGORIES, CATEGORY_LABELS } from '../classify';
import { Screenshots } from './History';
import {
  DONE_PATH, filtered, historyHref,
  type CategoryCount, type HistoryChoices, type HistoryFilters, type HistoryItem,
} from './workspace-history';
// Its own styles (bug #3167): it is drawn on the Inbox's Done tab, under the /app layout, which imports neither.
import './history.css';
import './share.css';

// The workspace's history (PRD 144), on the Inbox's Done tab (PRD omni-loop-22), as PRD omni-loop-23
// (s6) draws it: the categories in a sidebar on the left in style C, a category with none dimmed; beside
// it the shared toolbar line (search, Filters, the count), sent as a GET to this same page so it works
// before any script runs; then one page of answered rounds, newest first, grouped by day, each row
// anchored on who answered and opening /ask/q/<round>; "Show older" carries the cursor. A round's
// branch, skill, model, tokens, cost and time to answer sit in a popover, opened on hover, on the focus
// of its info button, or with `i`. It is a client module for that key; its props are plain data.

type Option = { value: string; label: string };

/** A category's label back to its id, for the row's data-category. */
const IDS: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [CATEGORY_LABELS[c], c]));

const number = new Intl.NumberFormat('en-US');

/** A filter of Filters, shown only when it offers a choice or is already set. */
function Pick({ name, label, all, value, options }: { name: string; label: string; all: string; value: string | undefined; options: Option[] }) {
  if (options.length < 2 && value === undefined) return null;
  return (
    <div className="done-field">
      <span className="done-field-label">{label}</span>
      <Select size="sm" label={label} name={name} defaultValue={value ?? ''} options={[{ value: '', label: all }, ...options]} />
    </div>
  );
}

function Bar({ choices, filters, shown, matched, total, categoryLabel }: {
  choices: HistoryChoices; filters: HistoryFilters; shown: number; matched: number; total: number; categoryLabel: string | null;
}) {
  const plain = (values: string[]) => values.map((v) => ({ value: v, label: v }));
  const more = filters.repo !== undefined || filters.prd !== undefined || filters.skill !== undefined || filters.askedBy !== undefined || filters.answeredBy !== undefined;
  const count = Math.max(matched, shown);
  return (
    <form className="inbox-toolbar done-bar" method="get" action={DONE_PATH} role="search">
      {filters.category && <input type="hidden" name="category" value={filters.category} />}
      <input
        className="omni-input done-search" type="search" name="q" defaultValue={filters.search ?? ''}
        aria-label="Search questions and answers" placeholder="Search questions and answers"
      />
      <details className="done-more" open={more}>
        <summary className="omni-button omni-button--sm">Filters</summary>
        <div className="done-more-panel">
          <Pick name="repo" label="Repository" all="All repositories" value={filters.repo} options={plain(choices.repos)} />
          <Pick name="prd" label="PRD" all="All PRDs" value={filters.prd?.toString()} options={choices.prds.map((n) => ({ value: String(n), label: `PRD #${n}` }))} />
          <Pick name="skill" label="Skill" all="All skills" value={filters.skill} options={plain(choices.skills)} />
          <Pick name="asked" label="Asked by" all="Anyone" value={filters.askedBy} options={choices.askedBy.map((c) => ({ value: c.id, label: c.label }))} />
          <Pick name="answered" label="Answered by" all="Anyone" value={filters.answeredBy} options={choices.answeredBy.map((c) => ({ value: c.id, label: c.label }))} />
          <button type="submit" className="omni-button omni-button--sm omni-button--primary">Apply</button>
        </div>
      </details>
      <span className="inbox-toolbar-end done-count">
        {filtered(filters)
          ? <>{number.format(count)} of {number.format(total)}{categoryLabel === null ? '' : ` in ${categoryLabel}`} · <a className="ask-history-clear" href={DONE_PATH}>Clear all</a></>
          : <>{number.format(total)} answered</>}
      </span>
    </form>
  );
}

function Categories({ categories, filters, all }: { categories: CategoryCount[]; filters: HistoryFilters; all: number }) {
  const link = (id: CategoryCount['id'] | undefined, label: string, count: number) => (
    <a
      key={id ?? 'all'} className={count === 0 && id !== undefined && filters.category !== id ? 'done-cat is-none' : 'done-cat'}
      href={historyHref(filters, { category: id })} aria-current={filters.category === id ? 'page' : undefined}
    >
      {label} <span className="done-cat-count">{number.format(count)}</span>
    </a>
  );
  // All counts every category under the other filters; with none listed, the history's own total.
  const total = categories.length > 0 ? categories.reduce((sum, c) => sum + c.count, 0) : all;
  return (
    <nav className="done-cats" aria-label="Categories">
      <h2 className="done-cats-title">Categories</h2>
      {link(undefined, 'All', total)}
      {categories.map((c) => link(c.id, c.label, c.count))}
    </nav>
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

const isPrd = (part: string) => /^PRD #\d+$/.test(part);
const isTokens = (part: string) => part.endsWith(' tokens');
const isCost = (part: string) => /^<?\$/.test(part);
const isTime = (part: string) => part.startsWith('answered in ');
const isSkill = (part: string) => part.startsWith('/');
const isModel = (part: string) => /^(claude|gpt|gemini)/i.test(part);
const isRepo = (part: string) => /^[\w.-]+\/[\w.-]+$/.test(part);

/** The repository and the branch out of what the other tests left: the repository comes first, and is
 * taken for one only when a branch follows it. */
function placeOf(left: readonly string[]): { repo: string | null; branch: string | null } {
  const [first, second] = left;
  if (first !== undefined && second !== undefined && isRepo(first)) return { repo: first, branch: second };
  return { repo: null, branch: first ?? null };
}

/** The row's context line, read back into the parts the row and its popover tell apart. The parts come in
 * a fixed order (repository, branch, PRD, skill, model, tokens, cost, time to answer), each left out when
 * unknown, so a part is told by its look: a skill starts with `/`, a model with its family, tokens and
 * the time end in a unit, a cost starts with `$`; what is left is the repository then the branch. */
function detailsOf(context: readonly string[]) {
  const left = context.filter((part) => ![isPrd, isTokens, isCost, isTime, isSkill, isModel].some((test) => test(part)));
  return {
    ...placeOf(left),
    prd: context.find(isPrd) ?? null,
    skill: context.find(isSkill) ?? null,
    model: context.find(isModel) ?? null,
    tokens: context.find(isTokens) ?? null,
    cost: context.find(isCost) ?? null,
    time: context.find(isTime)?.slice('answered in '.length) ?? null,
  };
}

const VIA = { page: 'on the page', terminal: 'in the terminal' } as const;

/** The row's one quiet line: the category (under All only), the repository, the PRD, who answered where
 * and how fast, and who asked when it is someone else. */
function quietOf(item: HistoryItem, parts: ReturnType<typeof detailsOf>, showCategory: boolean): string {
  const line: string[] = [];
  if (showCategory) line.push(item.category);
  if (parts.repo !== null) line.push(parts.repo);
  if (parts.prd !== null) line.push(parts.prd);
  if (item.answeredBy === null) line.push('moved to the terminal');
  else {
    const where = item.via ? ` ${VIA[item.via]}` : '';
    line.push(`answered by ${item.answeredBy}${where}${parts.time === null ? '' : ` after ${parts.time}`}`);
  }
  if (item.answeredBy !== null && item.askedBy !== item.answeredBy) line.push(`asked by ${item.askedBy}`);
  return line.join(' · ');
}

const DETAIL_LABELS = [
  ['branch', 'Branch'], ['skill', 'Skill'], ['model', 'Model'], ['tokens', 'Tokens'], ['cost', 'Cost'], ['time', 'Time to answer'],
] as const;

/** The info button and the popover it opens: the round's branch, skill, model, tokens, cost and time to
 * answer. It opens on hover, on the focus of its button, and with `i` while the row is focused or under
 * the pointer. */
function Details({ item, open, onOpenChange }: { item: HistoryItem; open: boolean; onOpenChange: (open: boolean) => void }) {
  const parts = detailsOf(item.context);
  const shown = DETAIL_LABELS.filter(([key]) => parts[key] !== null);
  return (
    <span className="done-info">
      <Popover trigger="Details of this question" title="Details" side="bottom" openOn="hover" triggerIcon="tone-info" open={open} onOpenChange={onOpenChange}>
        {shown.length === 0 ? <span className="done-muted">Nothing recorded.</span> : (
          <dl className="done-details">
            {shown.map(([key, label]) => (
              <div key={key} className="done-detail"><dt>{label}</dt><dd>{parts[key]}</dd></div>
            ))}
          </dl>
        )}
      </Popover>
    </span>
  );
}

function Row({ item, now, showCategory, open, onOpenChange, onHover }: {
  item: HistoryItem; now: number; showCategory: boolean; open: boolean; onOpenChange: (open: boolean) => void; onHover: (hovering: boolean) => void;
}) {
  const parts = detailsOf(item.context);
  const face = item.answeredByFace !== null && item.answeredBy !== null
    ? { name: item.answeredBy, face: item.answeredByFace }
    : { name: item.askedBy, face: item.askedByFace };
  return (
    <li className="done-item" data-round={item.roundId} onMouseEnter={() => { onHover(true); }} onMouseLeave={() => { onHover(false); }}>
      <a className="inbox-r done-row" href={item.href} data-category={IDS[item.category] ?? 'unsorted'}>
        <span className="inbox-r-anchor done-anchor" aria-hidden="true"><PersonChip person={face} size="table" link={false} /></span>
        <span className="inbox-r-main">
          <span className="inbox-r-title">
            {item.question}
            {item.more > 0 && <span className="done-more-count"> (+{item.more} more)</span>}
          </span>
          {item.answer !== null && (
            <span className="inbox-r-line done-answer"><span aria-hidden="true">✓ </span><span className="ask-history-answer">{item.answer}</span><Screenshots count={item.screenshots} /></span>
          )}
          <span className="inbox-r-quiet">{quietOf(item, parts, showCategory)}</span>
        </span>
        <span className="inbox-r-end">
          <time className="done-age" dateTime={item.at} title={`${item.at.slice(0, 16).replace('T', ' ')} UTC`} suppressHydrationWarning>{ago(item.at, now)}</time>
        </span>
      </a>
      <Details item={item} open={open} onOpenChange={onOpenChange} />
    </li>
  );
}

function Days({ items, now, showCategory }: { items: HistoryItem[]; now: number; showCategory: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const hovered = useRef<string | null>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!detailsKey(event, isTyping(target))) return;
      const id = document.activeElement?.closest<HTMLElement>('[data-round]')?.dataset.round ?? hovered.current;
      if (id === null) return;
      event.preventDefault();
      setOpenId((current) => (current === id ? null : id));
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); };
  }, []);
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
        <section key={day.title} className="inbox-group done-day-group" aria-label={day.title}>
          <h2 className="inbox-group-head done-day">{day.title} <span className="done-day-count">{day.items.length}</span></h2>
          <ol className="done-list">
            {day.items.map((item) => (
              <Row
                key={item.roundId} item={item} now={now} showCategory={showCategory} open={openId === item.roundId}
                onOpenChange={(next) => { setOpenId((current) => (next ? item.roundId : current === item.roundId ? null : current)); }}
                onHover={(on) => { hovered.current = on ? item.roundId : hovered.current === item.roundId ? null : hovered.current; }}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

export function WorkspaceHistory({ items, choices, filters, categories = [], all = items.length, matched = all, next = null, now = Date.now() }: {
  items: HistoryItem[];
  choices: HistoryChoices;
  filters: HistoryFilters;
  /** The categories' counts under the other filters, zeros kept; without them, the sidebar holds All alone. */
  categories?: CategoryCount[];
  /** How many rounds the history holds before any filter. */
  all?: number;
  /** How many rounds every filter lets through; every round by default. */
  matched?: number;
  /** The cursor of the older page (`?before=`); null on the last page. */
  next?: string | null;
  now?: number;
}) {
  const nothingYet = items.length === 0 && !filtered(filters) && filters.before === undefined;
  if (nothingYet) {
    return (
      <section className="done-empty">
        <h2 className="done-empty-title">No question yet</h2>
        <p className="done-muted">Every question an agent asks your workspace while ask mode is on is kept here.</p>
      </section>
    );
  }
  const categoryLabel = filters.category === undefined ? null : (categories.find((c) => c.id === filters.category)?.label ?? 'Unsorted');
  return (
    <div className="done">
      <Categories categories={categories} filters={filters} all={all} />
      <div className="done-main">
        <Bar choices={choices} filters={filters} shown={items.length} matched={matched} total={all} categoryLabel={categoryLabel} />
        {items.length === 0 ? (
          <section className="done-empty">
            <h2 className="done-empty-title">No question matches</h2>
            <p className="done-muted">Loosen a filter, or search another word.</p>
          </section>
        ) : (
          <Days items={items} now={now} showCategory={filters.category === undefined} />
        )}
        {(next !== null || filters.before !== undefined) && (
          <p className="done-paging">
            {next !== null && <a className="omni-button omni-button--sm" href={historyHref(filters, { before: next })}>Show older</a>}
            {filters.before !== undefined && <a className="done-newest" href={historyHref(filters, {})}>Back to the newest</a>}
          </p>
        )}
      </div>
    </div>
  );
}
