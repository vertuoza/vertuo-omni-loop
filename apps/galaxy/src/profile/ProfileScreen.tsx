import type { ReactNode } from 'react';
import { Notice } from '../ask/page/Notice';
import { SwitchAccount } from '../ask/page/SignInCard';
import { DashboardSignIn } from '../dashboard/DashboardSignIn';
import { CouldNotLoad } from '../dashboard/Notes';
import { Board } from '../dashboard/board/Board';
import type { Query } from '../dashboard/board/links';
import { BOARD_ZONE } from '../dashboard/board/period';
import { UNREADABLE, type Read } from '../dashboard/part';
import { APP_CALLBACK } from '../dashboard/sign-in';
import { FleetChip } from '../people/FleetChip';
import { PersonChip } from '../people/PersonChip';
import type { ProfileBoard } from './profile';
import type { ProfileHead, ProfileWork, WorkList } from './load';
import { profilePath, type ProfilePullRequest, type ProfileReview } from './select';
import './profile.css';

// /app/people/<login> in each situation (PRD 698 s3), decided once by the page: a member's profile —
// the header (face, name, @login to GitHub, fleet, season place), their board (Home's *you* board,
// built for them, following ?period=) and their pull requests and reviews of the period, at most 10
// each, then **see all**; "not in this workspace" for a login no member holds, with no data; and, as
// on /app/fleet, closed, signed out and in no workspace. An empty list reads "Nothing in this period";
// a workspace that tracks no repository says so under both pull request lists, linking to Settings ›
// Repositories. Read-only: nothing on it is editable, your own profile included.

type Supabase = { url: string; key: string };

/** Where a workspace's repositories are tracked. */
export const REPOSITORIES_SETTINGS_PATH = '/app/settings/repositories';

export const PROFILE_LINE = {
  notMember: 'Not in this workspace',
  empty: 'Nothing in this period',
  noRepository: 'This workspace tracks no repository yet',
} as const;

export type ProfileView = { kind: 'closed' } | { kind: 'sign-in' } | ProfileBoard;

export interface ProfileScreenProps {
  view: ProfileView;
  supabase: Supabase | null;
  signinError: string | null;
  query: Query;
}

const DATE = new Intl.DateTimeFormat('en-GB', { timeZone: BOARD_ZONE, day: 'numeric', month: 'short' });
const COUNT = new Intl.NumberFormat('en-US');
const dateOf = (at: string) => DATE.format(new Date(at));

function Closed() {
  return (
    <Notice title="Profiles are not open here">
      <p className="ask-muted">This deployment has no database, so it knows nobody’s work.</p>
    </Notice>
  );
}

function Place({ place, season }: { place: ProfileHead['place']; season: string }) {
  if (place === UNREADABLE) return <p className="dash-places">{`${season} place: couldn’t load it`}</p>;
  if (place === null) return <p className="dash-places">{`Not ranked in ${season}`}</p>;
  return <p className="dash-places">{`#${place.rank} of ${place.of} · ${season}`}</p>;
}

function Head({ person, season }: { person: ProfileHead; season: string }) {
  return (
    <header className="profile-head">
      <h1 className="dash-name"><PersonChip person={person} /></h1>
      <p className="profile-who">
        <a href={`https://github.com/${encodeURIComponent(person.login)}`}>@{person.login}</a>
        <span aria-hidden="true"> · </span>
        <FleetChip fleet={person.fleet} size="inline" />
      </p>
      <Place place={person.place} season={season} />
    </header>
  );
}

function NoRepository() {
  return <p className="profile-line">{PROFILE_LINE.noRepository}. <a href={REPOSITORIES_SETTINGS_PATH}>Settings › Repositories</a></p>;
}

function Section<T>({ id, title, list, work, row }: {
  id: string; title: string; list: Read<WorkList<T>> | null; work: Read<ProfileWork>; row: (item: T) => ReactNode;
}) {
  let body: ReactNode;
  if (work === UNREADABLE || list === UNREADABLE) body = <CouldNotLoad />;
  else if (work.kind === 'no-repository' || list === null) body = <NoRepository />;
  else if (list.rows.length === 0) body = <p className="profile-line">{PROFILE_LINE.empty}</p>;
  else {
    body = (
      <>
        <ul className="profile-list">{list.rows.map(row)}</ul>
        {list.more && <p className="profile-more"><a href={list.moreHref}>See all</a></p>}
      </>
    );
  }
  return (
    <section className="profile-work" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {body}
    </section>
  );
}

const pullRow = (p: ProfilePullRequest) => (
  <li key={`${p.repo}#${p.number}`}>
    <a href={p.url}>{`${p.repo}#${p.number}`}</a>
    <span className="profile-meta">{` ${p.event} ${dateOf(p.at)}`}</span>
    <span className="profile-diff">
      <span className="is-add">{`+${COUNT.format(p.additions)}`}</span> <span className="is-del">{`−${COUNT.format(p.deletions)}`}</span>
    </span>
  </li>
);

const reviewRow = (r: ProfileReview) => (
  <li key={`${r.repo}#${r.number}`}>
    <a href={r.url}>{`${r.repo}#${r.number}`}</a>
    <span className="profile-meta">{` reviewed ${dateOf(r.at)}`}</span>
  </li>
);

function Work({ work }: { work: Read<ProfileWork> }) {
  const lists = work !== UNREADABLE && work.kind === 'lists' ? work : null;
  return (
    <div className="profile-works">
      <Section id="profile-prs" title="Pull requests" list={lists ? lists.pullRequests : null} work={work} row={pullRow} />
      <Section id="profile-reviews" title="Reviews" list={lists ? lists.reviews : null} work={work} row={reviewRow} />
    </div>
  );
}

export function ProfileScreen({ view, supabase, signinError, query }: ProfileScreenProps) {
  switch (view.kind) {
    case 'closed':
      return <Closed />;
    case 'sign-in':
      return supabase ? <DashboardSignIn supabase={supabase} returnPath={APP_CALLBACK} error={signinError} /> : <Closed />;
    case 'no-workspace':
      return (
        <Notice title="Your account is not in a workspace">
          <p className="ask-muted">Profiles are for the members of a workspace. Sign in with your GitHub account to see yours.</p>
          {supabase && <SwitchAccount supabase={supabase} />}
        </Notice>
      );
    case 'not-member':
      return (
        <div className="dash">
          <h1 className="dash-name">{`@${view.login}`}</h1>
          <p className="profile-line">{PROFILE_LINE.notMember}</p>
        </div>
      );
    case 'unreadable':
      return (
        <div className="dash">
          <h1 className="dash-name">{`@${view.login}`}</h1>
          <CouldNotLoad />
        </div>
      );
    case 'profile':
      return (
        <div className="dash">
          <Head person={view.person} season={view.board.season.name} />
          <Board board={view.board} path={profilePath(view.person.login)} query={query} peopleTitle="Season and counts" />
          <Work work={view.work} />
        </div>
      );
  }
}
