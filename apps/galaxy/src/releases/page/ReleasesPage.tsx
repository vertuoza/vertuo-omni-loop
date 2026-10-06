import { INITIAL_RELEASE } from '../row';
import { weeksOf, type Release, type Week } from '../weeks';
import { countsOf, dayOf, isoDateOf, prdOf, prdsOf, RELEASES, weekOf } from '../words';
import type { ReleasesView } from './source';

// /releases (PRD 262): the heading and its line, then the releases week by week, newest first. One
// HTML page, no script of its own: the four newest weeks open, each older one a native <details>
// whose words are all in the page, for a reader and a search engine alike. Each release sits under
// its version as its anchor (/releases#0.0.3), and its version links to it, so one release can be
// shared. A PRD is named as plain text, never a link: the repository is private.

// The spaces between the parts of a line are text: a flex container draws none of them, but a search
// engine and a screen reader read the words apart.

function Meta({ release, label }: { release: Release; label: string }) {
  return (
    <p className="rel-meta">
      <a className="rel-version" href={`#${release.version}`} title={RELEASES.anchor}>{release.version}</a>
      {' '}<span className="rel-dot" aria-hidden="true">·</span>{' '}
      <time dateTime={isoDateOf(release.day)}>{dayOf(release.day)}</time>
      {' '}<span className="rel-dot" aria-hidden="true">·</span>{' '}
      <span>{label}</span>
    </p>
  );
}

/** Every PRD of a release of several, one line each: its title, its description, its number. */
function Lines({ release }: { release: Release }) {
  return (
    <ul className="rel-lines">
      {release.lines.map((line) => (
        <li key={line.prd} className="rel-line">
          <h4 className="rel-line-title">{line.title}</h4>
          {line.description ? <p className="rel-line-text">{line.description}</p> : null}
          <span className="rel-line-prd">{prdOf(line.prd)}</span>
        </li>
      ))}
    </ul>
  );
}

function ReleaseEntry({ release }: { release: Release }) {
  if (release.release === INITIAL_RELEASE) {
    return (
      <article id={release.version} className="rel-release rel-initial">
        <Meta release={release} label={RELEASES.initial.name} />
        <h3 className="rel-title">{RELEASES.initial.headline}</h3>
        <p className="rel-text">{RELEASES.initial.intro}</p>
        <Lines release={release} />
      </article>
    );
  }
  const [only, ...more] = release.lines;
  if (!only) return null; // a release always has a line: the rows make the release
  if (more.length) {
    // The table keeps one PRD per release above 1; should it ever hold more, none is hidden.
    return (
      <article id={release.version} className="rel-release">
        <Meta release={release} label={prdsOf(release.lines.length)} />
        <Lines release={release} />
      </article>
    );
  }
  return (
    <article id={release.version} className="rel-release">
      <Meta release={release} label={prdOf(only.prd)} />
      <h3 className="rel-title">{only.title}</h3>
      {only.description ? <p className="rel-text">{only.description}</p> : null}
    </article>
  );
}

function WeekHead({ week }: { week: Week }) {
  return (
    <>
      <span className="rel-week-name">{weekOf(week.monday)}</span>
      {' '}<span className="ask-sr">·</span>{' '}
      <span className="rel-week-count">{countsOf(week.releases.length, week.prds)}</span>
    </>
  );
}

function WeekOf({ week }: { week: Week }) {
  const releases = week.releases.map((release) => <ReleaseEntry key={release.release} release={release} />);
  if (!week.open) {
    // The browser owns `open`: it opens the week itself for a link to a release inside it
    // (/releases#0.0.1) or for a find in the page, sometimes before React takes the page over.
    return (
      <details className="rel-week rel-fold" suppressHydrationWarning>
        <summary className="rel-week-head"><WeekHead week={week} /></summary>
        {releases}
      </details>
    );
  }
  const id = `week-${isoDateOf(week.monday)}`;
  return (
    <section className="rel-week" aria-labelledby={id}>
      <h2 className="rel-week-head" id={id}><WeekHead week={week} /></h2>
      {releases}
    </section>
  );
}

function Body({ view }: { view: ReleasesView }) {
  if (view.kind === 'unavailable') return <p className="rel-notice" role="status">{RELEASES.unavailable}</p>;
  const weeks = weeksOf(view.rows);
  if (!weeks.length) return <p className="rel-notice">{RELEASES.empty}</p>;
  return <>{weeks.map((week) => <WeekOf key={isoDateOf(week.monday)} week={week} />)}</>;
}

export function ReleasesPage({ view }: { view: ReleasesView }) {
  return (
    <div className="ask-col rel-page">
      <div className="rel-intro">
        <h1 className="rel-heading">{RELEASES.heading}</h1>
        <p className="rel-lede">{RELEASES.line}</p>
      </div>
      <Body view={view} />
    </div>
  );
}
