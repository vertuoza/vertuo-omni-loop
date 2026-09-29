import { STAGES, type StageId } from '../stages/stage';
import type { PullRequestRow, ReviewRow } from '../engineering/tally';

// A person's profile (PRD 698 s3), its pure choices: the login a path names, one person's pull
// requests and reviews of one period (newest first, at most 10, and whether more exist), and where
// each of the page's links goes. Logins match ignoring case, as everywhere on the board.

/** How many rows a profile list shows. */
export const PROFILE_LIMIT = 10;

/** A list's first rows, and whether more exist. */
export interface Capped<T> { rows: T[]; more: boolean }

export function capped<T>(rows: readonly T[], limit = PROFILE_LIMIT): Capped<T> {
  return { rows: rows.slice(0, limit), more: rows.length > limit };
}

/** A GitHub login: letters, digits and single hyphens inside, at most 39 characters. */
const LOGIN = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/i;

/** The login a profile path names, in lower case; null for anything that is no GitHub login. */
export function profileLogin(part: string): string | null {
  return LOGIN.test(part) ? part.toLowerCase() : null;
}

export const PEOPLE_PATH = '/app/people';
export const profilePath = (login: string) => `${PEOPLE_PATH}/${encodeURIComponent(login.toLowerCase())}`;

export const githubPullUrl = (repo: string, number: number) => `https://github.com/${repo}/pull/${number}`;

/** Where each count of the profile's PRDs tile opens: /prd at that stage, for that person. */
export function profileStageLinks(login: string): Record<StageId, string> {
  return Object.fromEntries(
    STAGES.map((stage) => [stage, `/prd?${new URLSearchParams({ stage, who: login.toLowerCase() })}`]),
  ) as Record<StageId, string>;
}

/** Where **see all** under a pull request list goes: GitHub's search over the tracked repositories. */
export function moreHref(list: 'authored' | 'reviewed', login: string, tracked: readonly string[]): string {
  const who = list === 'authored' ? `author:${login}` : `reviewed-by:${login}`;
  const q = ['is:pr', who, ...tracked.map((r) => `repo:${r}`)].join(' ');
  return `https://github.com/search?${new URLSearchParams({ type: 'pullrequests', q })}`;
}

type Window = { from: Date; to: Date };

const within = (at: string | null, { from, to }: Window) => {
  if (!at) return false;
  const t = Date.parse(at);
  return t >= from.getTime() && t < to.getTime();
};

const newestFirst = <T extends { at: string; repo: string; number: number }>(a: T, b: T) =>
  Date.parse(b.at) - Date.parse(a.at) || a.repo.localeCompare(b.repo) || b.number - a.number;

/** A pull request on a profile: merged within the period, else opened within it. */
export interface ProfilePullRequest {
  repo: string;
  number: number;
  url: string;
  event: 'opened' | 'merged';
  /** When that happened, an ISO instant. */
  at: string;
  additions: number;
  deletions: number;
}

export function pullRequestsOf(rows: readonly PullRequestRow[], login: string, window: Window): Capped<ProfilePullRequest> {
  const who = login.toLowerCase();
  const chosen = rows.flatMap((r): ProfilePullRequest[] => {
    if (r.author?.toLowerCase() !== who) return [];
    const merged = within(r.mergedAt, window);
    if (!merged && !within(r.openedAt, window)) return [];
    return [{
      repo: r.repo, number: r.number, url: githubPullUrl(r.repo, r.number), event: merged ? 'merged' : 'opened',
      at: merged ? r.mergedAt! : r.openedAt, additions: r.additions, deletions: r.deletions,
    }];
  });
  return capped(chosen.sort(newestFirst));
}

/** A review on a profile: the pull request, and when they first reviewed it. */
export interface ProfileReview { repo: string; number: number; url: string; at: string }

export function reviewsOf(rows: readonly ReviewRow[], login: string, window: Window): Capped<ProfileReview> {
  const who = login.toLowerCase();
  const chosen = rows
    .filter((r) => r.reviewer.toLowerCase() === who && within(r.firstAt, window))
    .map((r) => ({ repo: r.repo, number: r.number, url: githubPullUrl(r.repo, r.number), at: r.firstAt }));
  return capped(chosen.sort(newestFirst));
}
