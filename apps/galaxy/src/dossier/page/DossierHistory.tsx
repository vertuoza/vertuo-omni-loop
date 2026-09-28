import { filtered, HISTORY_PATH, historyAddress, type HistoryFilters, type HistoryItem } from './history';

// /prd, the history (PRD 216's spec, "The pages"): a search over titles and two picks — a repository, and
// draft or PRD — sent as a GET to this same page, so they work before any script runs; then every
// dossier that passes, newest activity first, each a link to its page. A row shows #n or DRAFT, the
// title, its repository chips, which artifacts it has and how many versions of each, its questions
// answered out of asked, and its last activity. Every title is text: React escapes it. PRD 413: Mine / All,
// two links at the head of the filters that keep every other filter; the form carries who=all under All so
// filtering stays there, and Clear keeps it; an empty Mine points to All at the same address.

type Choices = { repos: string[] };
type Option = { value: string; label: string };

function Pick({ name, label, any, value, options }: { name: string; label: string; any: string; value: string | undefined; options: Option[] }) {
  return (
    <label className="dossier-history-field">
      <span className="ask-hint">{label}</span>
      <select className="ask-share-pick" name={name} defaultValue={value ?? ''}>
        <option value="">{any}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function Who({ filters }: { filters: HistoryFilters }) {
  const link = (who: HistoryFilters['who'], label: string) => (
    <a className="dossier-history-who" aria-current={filters.who === who ? 'page' : undefined} href={historyAddress({ ...filters, who })}>{label}</a>
  );
  return (
    <nav className="dossier-history-whos" aria-label="Whose PRDs">
      {link('mine', 'Mine')}
      {link('all', 'All')}
    </nav>
  );
}

function Filters({ choices, filters }: { choices: Choices; filters: HistoryFilters }) {
  return (
    <form className="dossier-history-filters" method="get" action={HISTORY_PATH} role="search">
      {filters.who === 'all' && <input type="hidden" name="who" value="all" />}
      <label className="dossier-history-field dossier-history-search">
        <span className="ask-hint">Search the titles</span>
        <input className="ask-share-link" type="search" name="q" defaultValue={filters.search ?? ''} placeholder="a word of a PRD's title" />
      </label>
      <Pick name="repo" label="Repository" any="Any" value={filters.repo} options={choices.repos.map((repo) => ({ value: repo, label: repo }))} />
      <Pick
        name="state" label="Draft or PRD" any="Drafts and PRDs" value={filters.state}
        options={[{ value: 'draft', label: 'Drafts' }, { value: 'prd', label: 'PRDs' }]}
      />
      <p className="dossier-history-actions">
        <button type="submit" className="ask-button">Filter</button>
        {filtered(filters) && <a className="dossier-history-clear" href={historyAddress({ who: filters.who })}>Clear</a>}
      </p>
    </form>
  );
}

function Row({ item }: { item: HistoryItem }) {
  return (
    <li>
      <a className="dossier-history-row" href={item.href}>
        <span className="dossier-history-title">
          {item.draft ? <span className="dossier-draft">DRAFT</span> : <span className="dossier-number">{item.heading}</span>}{' '}
          <span>{item.title}</span>
        </span>
        <span className="dossier-repos">
          {item.repos.map((repo) => <span key={repo} className="dossier-repo">{repo}</span>)}
        </span>
        <span className="dossier-history-facts">
          <span className="dossier-history-artifacts">
            {item.artifacts.length === 0
              ? <span className="ask-hint">no artifact yet</span>
              : item.artifacts.map((a) => <span key={a.kind} className="dossier-history-artifact">{a.label} <small>{a.badge}</small></span>)}
          </span>
          <span className="ask-hint">{item.questions}</span>
          <time className="ask-hint" dateTime={item.at}>{item.activity}</time>
        </span>
      </a>
    </li>
  );
}

const ToAll = ({ filters, children }: { filters: HistoryFilters; children: string }) => (
  <a className="dossier-history-to-all" href={historyAddress({ ...filters, who: 'all' })}>{children}</a>
);

export function DossierHistory({ items, choices, filters }: { items: HistoryItem[]; choices: Choices; filters: HistoryFilters }) {
  const mine = filters.who === 'mine';
  const nothingYet = items.length === 0 && !filtered(filters) && !mine;
  const noneOfMine = items.length === 0 && !filtered(filters) && mine;
  return (
    <div className="dossier dossier-history">
      <h1 className="dossier-title">PRDs</h1>
      {nothingYet ? (
        <section className="ask-card">
          <h2>No PRD yet</h2>
          <p className="ask-muted">
            A PRD&apos;s dossier shows here once a brainstorm opens it, or once the page reads it from a repository: its
            before/after page, its spec, its plan and the questions that shaped it.
          </p>
        </section>
      ) : (
        <>
          <Who filters={filters} />
          <Filters choices={choices} filters={filters} />
          {noneOfMine ? (
            <section className="ask-card">
              <h2>You have not opened a PRD yet.</h2>
              <p className="ask-muted">
                The PRDs you open with a brainstorm show here, drafts included. <ToAll filters={filters}>See every PRD of your workspace</ToAll>.
              </p>
            </section>
          ) : items.length === 0 ? (
            <section className="ask-card">
              <h2>No PRD matches</h2>
              <p className="ask-muted">
                Loosen a filter, or search another word.
                {mine && <> Or <ToAll filters={filters}>look in every PRD of your workspace</ToAll>.</>}
              </p>
            </section>
          ) : (
            <ol className="dossier-history-list" aria-label="PRDs, newest activity first">
              {items.map((item) => <Row key={item.id} item={item} />)}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
