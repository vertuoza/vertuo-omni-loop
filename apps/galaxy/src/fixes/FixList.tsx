import { WORK_NAMES, WORK_PATHS } from '../dossier/page/work';
import { fixAddress, fixFiltered, type FixFilters, type FixItem, type FixKind } from './list';
import { STATE_LABELS } from './timeline';

// /visual and /bugs (PRD 627), laid out as /prd's list: Mine / All at the head of the filters, then a
// search over titles and a repository, sent as a GET to the same page so they work before any script
// runs, then every fix that passes, newest activity first, each a link to its page. A row shows #n,
// the title, its repository chips, what it holds and its last activity. Every title is text: React
// escapes it. An empty Mine points to All at the same address.
// PRD 627, s5: a row also shows who asked and the state pill (Asked, In review, Merged, `—` when GitHub
// did not answer), a bug fix's row its risk label and a *regression* badge; the state is a filter.

type Choices = { repos: string[] };

const EMPTY: Record<FixKind, { none: string; how: string }> = {
  visual: {
    none: 'No visual update yet',
    how: 'A visual update shows here once /omni:visual-fix pushes it, or once the page reads it from a repository: its before/after page and the rounds of variations it was picked from.',
  },
  bug: {
    none: 'No bug fix yet',
    how: 'A bug fix shows here once /omni:bug-fix pushes it, or once the page reads it from a repository: its bug record.',
  },
};

function Who({ kind, filters }: { kind: FixKind; filters: FixFilters }) {
  const link = (who: FixFilters['who'], label: string) => (
    <a className="dossier-history-who" aria-current={filters.who === who ? 'page' : undefined} href={fixAddress(kind, { ...filters, who })}>{label}</a>
  );
  return (
    <nav className="dossier-history-whos" aria-label={`Whose ${WORK_NAMES[kind].many.toLowerCase()}`}>
      {link('mine', 'Mine')}
      {link('all', 'All')}
    </nav>
  );
}

function Filters({ kind, choices, filters }: { kind: FixKind; choices: Choices; filters: FixFilters }) {
  return (
    <form className="dossier-history-filters" method="get" action={WORK_PATHS[kind]} role="search">
      {filters.who === 'all' && <input type="hidden" name="who" value="all" />}
      <label className="dossier-history-field dossier-history-search">
        <span className="ask-hint">Search the titles</span>
        <input className="ask-share-link" type="search" name="q" defaultValue={filters.search ?? ''} placeholder={`a word of a ${WORK_NAMES[kind].one}'s title`} />
      </label>
      <label className="dossier-history-field">
        <span className="ask-hint">State</span>
        <select className="ask-share-pick" name="state" defaultValue={filters.state ?? ''}>
          <option value="">Any</option>
          <option value="asked">{STATE_LABELS.asked}</option>
          <option value="in-review">{STATE_LABELS['in-review']}</option>
          <option value="merged">{STATE_LABELS.merged}</option>
        </select>
      </label>
      <label className="dossier-history-field">
        <span className="ask-hint">Repository</span>
        <select className="ask-share-pick" name="repo" defaultValue={filters.repo ?? ''}>
          <option value="">Any</option>
          {choices.repos.map((repo) => <option key={repo} value={repo}>{repo}</option>)}
        </select>
      </label>
      <p className="dossier-history-actions">
        <button type="submit" className="ask-button">Filter</button>
        {fixFiltered(filters) && <a className="dossier-history-clear" href={fixAddress(kind, { who: filters.who })}>Clear</a>}
      </p>
    </form>
  );
}

function Row({ item }: { item: FixItem }) {
  return (
    <li>
      <a className="dossier-history-row" href={item.href}>
        <span className="dossier-history-title">
          <span className="dossier-number">{item.heading}</span> <span>{item.title}</span>{' '}
          <span className={`fix-state fix-state-${item.state ?? 'unknown'}`}>{item.stateLabel}</span>
          {item.risk && <> <span className="fix-badge">{item.risk}</span></>}
          {item.regression && <> <span className="fix-badge fix-badge-regression">regression</span></>}
        </span>
        <span className="dossier-repos">
          {item.repos.map((repo) => <span key={repo} className="dossier-repo">{repo}</span>)}
        </span>
        <span className="dossier-history-facts">
          <span className="dossier-history-artifacts">
            {item.artifacts.length === 0
              ? <span className="ask-hint">nothing pushed yet</span>
              : item.artifacts.map((a) => <span key={a.kind} className="dossier-history-artifact">{a.label} <small>{a.badge}</small></span>)}
          </span>
          {item.asked && <span className="ask-hint">{item.asked}</span>}
          <time className="ask-hint" dateTime={item.at}>{item.activity}</time>
        </span>
      </a>
    </li>
  );
}

export function FixList({ kind, items, choices, filters }: { kind: FixKind; items: FixItem[]; choices: Choices; filters: FixFilters }) {
  const names = WORK_NAMES[kind];
  const mine = filters.who === 'mine';
  const toAll = (words: string) => <a className="dossier-history-to-all" href={fixAddress(kind, { ...filters, who: 'all' })}>{words}</a>;
  const nothingYet = items.length === 0 && !fixFiltered(filters) && !mine;
  const noneOfMine = items.length === 0 && !fixFiltered(filters) && mine;
  return (
    <div className="dossier dossier-history">
      <h1 className="dossier-title">{names.many}</h1>
      {nothingYet ? (
        <section className="ask-card">
          <h2>{EMPTY[kind].none}</h2>
          <p className="ask-muted">{EMPTY[kind].how}</p>
        </section>
      ) : (
        <>
          <Who kind={kind} filters={filters} />
          <Filters kind={kind} choices={choices} filters={filters} />
          {noneOfMine ? (
            <section className="ask-card">
              <h2>You have not pushed a {names.one} yet.</h2>
              <p className="ask-muted">{toAll(`See every ${names.one} of your workspace`)}.</p>
            </section>
          ) : items.length === 0 ? (
            <section className="ask-card">
              <h2>No {names.one} matches</h2>
              <p className="ask-muted">
                Loosen a filter, or search another word.
                {mine && <> Or {toAll(`look in every ${names.one} of your workspace`)}.</>}
              </p>
            </section>
          ) : (
            <ol className="dossier-history-list" aria-label={`${names.many}, newest activity first`}>
              {items.map((item) => <Row key={item.id} item={item} />)}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
