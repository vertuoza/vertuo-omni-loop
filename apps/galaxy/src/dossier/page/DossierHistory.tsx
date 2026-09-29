import { StagePill } from '../../stages/stage-pill';
import { profileHref } from '../../people/PersonChip';
import { filtered, HISTORY_PATH, historyAddress, whoLogin, whoParam, type HistoryFilters, type HistoryItem, type StageBarEntry } from './history';

// /prd, the history (PRD 216's spec, "The pages"): a search over titles and two picks — a repository, and
// draft or PRD — sent as a GET to this same page, so they work before any script runs; then every
// dossier that passes, newest activity first, each a link to its page. A row shows #n or DRAFT, the
// title, its repository chips, which artifacts it has and how many versions of each, its questions
// answered out of asked, and its last activity. Every title is text: React escapes it. PRD 413: Mine / All,
// two links at the head of the filters that keep every other filter; the form carries who=all under All so
// filtering stays there, and Clear keeps it; an empty Mine points to All at the same address. PRD 251: a
// row shows its outbox's open questions as the Outbox tab counts them (`Outbox 2 open`), and the
// Needs an answer box keeps only those rows. PRD 587: a stage bar under the filters counts the seven
// stages over the rows every other filter keeps, each a link to the list at that stage (the selected one
// clears it; the form carries it, so filtering stays on it), and each row shows its current stage pill.
// PRD 698 (s4): under `who=<login>` neither Mine nor All is pressed, a line reads "Opened by @login" and
// links to their profile, and the form carries the login so filtering stays on their PRDs.

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
      {whoParam(filters.who) && <input type="hidden" name="who" value={whoParam(filters.who)!} />}
      {filters.stage && <input type="hidden" name="stage" value={filters.stage} />}
      <label className="dossier-history-field dossier-history-search">
        <span className="ask-hint">Search the titles</span>
        <input className="ask-share-link" type="search" name="q" defaultValue={filters.search ?? ''} placeholder="a word of a PRD's title" />
      </label>
      <Pick name="repo" label="Repository" any="Any" value={filters.repo} options={choices.repos.map((repo) => ({ value: repo, label: repo }))} />
      <Pick
        name="state" label="Draft or PRD" any="Drafts and PRDs" value={filters.state}
        options={[{ value: 'draft', label: 'Drafts' }, { value: 'prd', label: 'PRDs' }]}
      />
      <label className="dossier-history-field">
        <span className="ask-hint">Outbox</span>
        <span><input type="checkbox" name="needs" value="answer" defaultChecked={filters.needsAnswer === true} /> Needs an answer</span>
      </label>
      <p className="dossier-history-actions">
        <button type="submit" className="ask-button">Filter</button>
        {filtered(filters) && <a className="dossier-history-clear" href={historyAddress({ who: filters.who })}>Clear</a>}
      </p>
    </form>
  );
}

// The bar borrows the track's pill look (dossier.css, .stage-*); the two rules a link row needs beyond it
// sit here, since that stylesheet belongs to the PRD page.
const BAR_STYLE = { margin: '0 0 12px' } as const;
const STOP_STYLE = { textDecoration: 'none' } as const;

function StageBar({ stages }: { stages: StageBarEntry[] }) {
  return (
    <nav className="stage-track dossier-history-stages" aria-label="PRDs by stage" style={BAR_STYLE}>
      {stages.map((s) => (
        <a
          key={s.id} className={`stage-stop stage-${s.selected ? 'current' : 'passed'}`} aria-current={s.selected ? 'page' : undefined}
          href={s.href} style={STOP_STYLE}
        >
          {s.label} <small>{s.count}</small>
        </a>
      ))}
    </nav>
  );
}

function Row({ item }: { item: HistoryItem }) {
  return (
    <li>
      <a className="dossier-history-row" href={item.href}>
        <span className="dossier-history-title">
          {item.draft ? <span className="dossier-draft">DRAFT</span> : <span className="dossier-number">{item.heading}</span>}{' '}
          {item.stage && <><StagePill stage={item.stage} />{' '}</>}
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
          {item.open && <span className="dossier-history-artifact dossier-history-open">Outbox <small>{item.open}</small></span>}
          <span className="ask-hint">{item.questions}</span>
          <time className="ask-hint" dateTime={item.at}>{item.activity}</time>
        </span>
      </a>
    </li>
  );
}

/** Whose PRDs these are, under `who=<login>`: a line linking to their profile. */
const OpenedBy = ({ login }: { login: string }) => (
  <p className="ask-hint dossier-history-by">Opened by <a href={profileHref(login)}>@{login}</a></p>
);

const ToAll = ({ filters, children }: { filters: HistoryFilters; children: string }) => (
  <a className="dossier-history-to-all" href={historyAddress({ ...filters, who: 'all' })}>{children}</a>
);

export function DossierHistory({ items, choices, filters, stages }: {
  items: HistoryItem[]; choices: Choices; filters: HistoryFilters; stages?: StageBarEntry[];
}) {
  const mine = filters.who === 'mine';
  const login = whoLogin(filters.who);
  const nothingYet = items.length === 0 && !filtered(filters) && filters.who === 'all';
  const noneOfMine = items.length === 0 && !filtered(filters) && mine;
  const noneOfTheirs = items.length === 0 && !filtered(filters) && login !== null;
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
          {login && <OpenedBy login={login} />}
          <Filters choices={choices} filters={filters} />
          {stages && <StageBar stages={stages} />}
          {noneOfTheirs ? (
            <section className="ask-card">
              <h2>@{login} has not opened a PRD here.</h2>
              <p className="ask-muted"><ToAll filters={filters}>See every PRD of your workspace</ToAll>.</p>
            </section>
          ) : noneOfMine ? (
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
                {filters.who !== 'all' && <> Or <ToAll filters={filters}>look in every PRD of your workspace</ToAll>.</>}
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
