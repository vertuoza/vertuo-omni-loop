import { PersonChip } from '../../people/PersonChip';
import { CATEGORIES, CATEGORY_LABELS } from '../classify';
import { ContextLine } from './ContextLine';
import { Screenshots } from './History';
import { filtered, type HistoryChoices, type HistoryFilters, type HistoryItem } from './workspace-history';

// The workspace's history (PRD 144): a form of filters and a search, sent as a GET to this same page
// so it works before any script runs, and the rounds that pass, newest first, each opening
// /ask/q/<round>. The sidebar's History item leads here (PRD 438).

const LABELS: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [CATEGORY_LABELS[c], c]));

type Option = { value: string; label: string };

function Pick({ name, label, value, options }: { name: string; label: string; value: string | undefined; options: Option[] }) {
  return (
    <label className="ask-history-field">
      <span className="ask-hint">{label}</span>
      <select className="ask-share-pick" name={name} defaultValue={value ?? ''}>
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function Filters({ choices, filters }: { choices: HistoryChoices; filters: HistoryFilters }) {
  const plain = (values: string[]) => values.map((v) => ({ value: v, label: v }));
  return (
    <form className="ask-history-filters" method="get" action="/ask/history" role="search">
      <label className="ask-history-field ask-history-search">
        <span className="ask-hint">Search the questions and answers</span>
        <input className="ask-share-link" type="search" name="q" defaultValue={filters.search ?? ''} placeholder="a word of a question or its answer" />
      </label>
      <Pick
        name="category" label="Category" value={filters.category}
        options={[...CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })), { value: 'unsorted', label: 'unsorted' }]}
      />
      <Pick name="repo" label="Repository" value={filters.repo} options={plain(choices.repos)} />
      <Pick name="prd" label="PRD" value={filters.prd?.toString()} options={choices.prds.map((n) => ({ value: String(n), label: `PRD #${n}` }))} />
      <Pick name="skill" label="Skill" value={filters.skill} options={plain(choices.skills)} />
      <Pick name="asked" label="Asked by" value={filters.askedBy} options={choices.askedBy.map((c) => ({ value: c.id, label: c.label }))} />
      <Pick name="answered" label="Answered by" value={filters.answeredBy} options={choices.answeredBy.map((c) => ({ value: c.id, label: c.label }))} />
      <p className="ask-history-actions">
        <button type="submit" className="ask-button">Filter</button>
        {filtered(filters) && <a className="ask-history-clear" href="/ask/history">Clear</a>}
      </p>
    </form>
  );
}

const STATUS: Record<HistoryItem['status'], string> = { open: 'waiting', answered: 'answered', abandoned: 'moved to the terminal' };

/** Who asked and who answered, each as a chip (PRD 652): the text reads as it did, the faces added. */
function Who({ item }: { item: HistoryItem }) {
  const asked = <>asked by <PersonChip person={{ name: item.askedBy, face: item.askedByFace }} size="inline" link={false} /></>;
  if (item.answeredBy === null || item.answeredByFace === null) return <span className="ask-hint">{asked}{` · ${STATUS[item.status]}`}</span>;
  const via = item.via ? `, ${item.via === 'page' ? 'on the page' : 'in the terminal'}` : '';
  return (
    <span className="ask-hint">
      {asked}{' · answered by '}<PersonChip person={{ name: item.answeredBy, face: item.answeredByFace }} size="inline" link={false} />{via}
    </span>
  );
}

function Row({ item }: { item: HistoryItem }) {
  return (
    <li>
      <a className="ask-history-link" href={item.href}>
        <span className="ask-history-top">
          <span className="ask-category-tag" data-category={LABELS[item.category] ?? 'unsorted'}>{item.category}</span>
          <time className="ask-hint" dateTime={item.at} suppressHydrationWarning>{new Date(item.at).toISOString().slice(0, 16).replace('T', ' ')} UTC</time>
        </span>
        <span className="ask-for-me-question">
          {item.question}
          {item.more > 0 && <span className="ask-hint"> (+{item.more} more)</span>}
        </span>
        {item.answer !== null && <span className="ask-history-answer">{item.answer}</span>}
        <Screenshots count={item.screenshots} />
        <Who item={item} />
      </a>
      <ContextLine parts={item.context} />
    </li>
  );
}

export function WorkspaceHistory({ items, choices, filters }: { items: HistoryItem[]; choices: HistoryChoices; filters: HistoryFilters }) {
  const nothingYet = items.length === 0 && !filtered(filters);
  return (
    <div className="ask-col">
      <p className="ask-title">History</p>
      {nothingYet ? (
        <section className="ask-card">
          <h1>No question yet</h1>
          <p className="ask-muted">Every question Claude asks your workspace while ask mode is on is kept here.</p>
        </section>
      ) : (
        <>
          <Filters choices={choices} filters={filters} />
          {items.length === 0 ? (
            <section className="ask-card">
              <h1>No question matches</h1>
              <p className="ask-muted">Loosen a filter, or search another word.</p>
            </section>
          ) : (
            <ol className="ask-history-list" aria-label="Questions, newest first">
              {items.map((item) => <Row key={item.roundId} item={item} />)}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
