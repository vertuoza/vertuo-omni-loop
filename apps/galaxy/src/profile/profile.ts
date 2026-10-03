import 'server-only';
import { at, messageOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { GalaxyView } from '@omni/galaxy';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import { demoGalaxy, loadGalaxy } from '../data/load-galaxy';
import { memberWorkspace, type Workspace } from '../data/workspace';
import { once } from '../dashboard/part';
import { demoActivity, demoAnswered, demoPrds, demoRoster, DEMO_VIEWER } from '../dashboard/board/demo';
import { supabaseReads } from '../dashboard/board/load';
import type { Period } from '../dashboard/board/period';
import { MERGED } from '../dashboard/board/tally';
import { parsedPages } from '../data/all-pages';
import { orThrow, parseRows } from '../data/parse-rows';
import type { PullRequestRow, ReviewRow } from '../engineering/tally';
import { fixFactsStore } from '../fixes/facts/store';
import { DEMO_VIEWER as DEMO_DOSSIER_VIEWER, demoHistory } from '../dossier/page/demo';
import { readCurrentStages } from '../dossier/page/history';
import { readHistory } from '../dossier/page/source';
import type { DossierListRow } from '../dossier/store';
import { stageStore } from '../stages/store';
import { loadProfile, profileOf, type ProfileReads, type ProfileValue } from './load';
import { PR_COLUMNS, REVIEW_COLUMNS, StoredPullRequest, StoredReview, TrackedRepository } from './stored';

// A person's profile (PRD 698 s3), as the signed-in person, in the workspace they joined first (the
// one /app/fleet reads, memberWorkspace): the board's reads, and the tracked repositories' pull
// requests and reviews of that one login, narrowed in the query to the period. No migration and no
// GitHub read: row-level security lets every member read these rows today. With the workspace itself
// out of reach, the page says it could not load. The demo draws a demo member's profile from the demo
// world's made-up merges.
// PRD 698 s5: the dossiers are dossier_list()'s, as the viewer, kept to this workspace; their stages the
// stage store's; and what GitHub says of each fix is read through the server's one cached fix reader, the
// one /bugs and /visual read through, so the profile adds no GitHub read of its own.

export type ProfileBoard = { kind: 'no-workspace' } | ProfileValue;


/** The profile's reads of one workspace, as the signed-in person. `login` is a checked GitHub login
 * (profileLogin), so it holds no pattern character for `ilike`. */
function supabaseProfileReads(db: SupabaseClient, workspace: string, galaxy: () => Promise<GalaxyView>): ProfileReads {
  return {
    ...supabaseReads(db, workspace, galaxy),
    async tracked() {
      const { data, error } = await db.from('repositories').select('full_name').eq('workspace_id', workspace).eq('tracked', true);
      if (error) throw new Error(`Supabase: could not read the tracked repositories (${error.message})`);
      return orThrow(parseRows(TrackedRepository, data, 'profile: repositories')).map((r) => r.full_name);
    },
    async pullRequests(login, from, to, repos) {
      const [a, b] = [`"${from.toISOString()}"`, `"${to.toISOString()}"`];
      const rows = await parsedPages('their pull requests', StoredPullRequest, 'profile: pull_requests', (start, end) => db
        .from('pull_requests')
        .select(PR_COLUMNS)
        .eq('workspace_id', workspace)
        .in('repo', repos)
        .ilike('author', login)
        .or(`and(opened_at.gte.${a},opened_at.lt.${b}),and(merged_at.gte.${a},merged_at.lt.${b})`)
        .order('repo', { ascending: true })
        .order('number', { ascending: true })
        .range(start, end));
      return rows.map((r): PullRequestRow => ({
        repo: r.repo, number: r.number, author: r.author, authorIsBot: r.author_is_bot, openedAt: r.opened_at, mergedAt: r.merged_at,
        closedAt: r.closed_at, mergedBy: r.merged_by, commits: r.commits, additions: r.additions, deletions: r.deletions, omniSigned: r.omni_signed,
      }));
    },
    async reviews(login, from, to, repos) {
      const rows = await parsedPages('their reviews', StoredReview, 'profile: pull_request_reviews', (start, end) => db
        .from('pull_request_reviews')
        .select(REVIEW_COLUMNS)
        .eq('workspace_id', workspace)
        .in('repo', repos)
        .ilike('reviewer', login)
        .gte('first_at', from.toISOString())
        .lt('first_at', to.toISOString())
        .order('repo', { ascending: true })
        .order('number', { ascending: true })
        .range(start, end));
      return rows.map((r): ReviewRow => ({ repo: r.repo, number: r.number, reviewer: r.reviewer, firstAt: r.first_at }));
    },
    async dossiers() {
      return (await readHistory(db)).filter((row) => row.workspace_id === workspace);
    },
    stages: (rows) => readCurrentStages(rows, stageStore(db)),
    // PRD 691: what GitHub said of each fix, from the stored facts, one read for this workspace; a
    // workspace whose facts could not be read shows every fix as `—`.
    fixFacts: (rows) => fixFactsStore(db).readFacts(workspace, rows.map((row) => row.id)).catch((error: unknown) => {
      console.error(error);
      return new Map();
    }),
  };
}

/** The profile of `login` in the workspace the viewer joined first. */
export async function loadProfileBoard(db: SupabaseClient<Database>, user: Pick<User, 'id'>, login: string, period: Period, now: Date): Promise<ProfileBoard> {
  let workspace: Workspace | null;
  try {
    workspace = await memberWorkspace(db, user.id);
  } catch (error) {
    console.error(`profile: your workspace could not be read (${messageOf(error)})`);
    return { kind: 'unreadable', login };
  }
  if (!workspace) return { kind: 'no-workspace' };
  const id = workspace.id;
  return loadProfile(supabaseProfileReads(db, id, once(() => loadGalaxy(db, id, now))), { login, viewerId: user.id, period, now });
}

const DEMO_TRACKED = ['vertuoza/vertuo-core', 'vertuoza/vertuo-api', 'vertuoza/vertuo-ai-domain', 'vertuoza/vertuo-web', 'vertuoza/vertuo-mobile'];
const DAY = 24 * 3_600_000;

/** The demo's profile of `login`, seen by the demo's *you*: the demo world's members, their made-up
 * merges as their pull requests (each opened a day before it merged), and each third merge of someone
 * else as one of their reviews. */
export function demoProfile(login: string, period: Period, now: Date, galaxy: GalaxyView = demoGalaxy(now)): ProfileValue {
  const roster = demoRoster(galaxy);
  const activity = demoActivity(roster, now);
  const merges = activity.filter((a) => a.kind === MERGED && roster.some((m) => m.login === a.login));
  const repo = (name: string) => DEMO_TRACKED.find((r) => r.endsWith(`/${name}`)) ?? `vertuoza/${name}`;
  const pullRequests = merges.map((a): PullRequestRow => ({
    repo: repo(a.repo), number: a.number, author: a.login, authorIsBot: false, openedAt: new Date(Date.parse(a.at) - DAY).toISOString(),
    mergedAt: a.at, closedAt: a.at, mergedBy: null, commits: 1 + (a.number % 4), additions: 12 + ((a.number * 37) % 300),
    deletions: 3 + ((a.number * 13) % 90), omniSigned: false,
  }));
  const logins = roster.flatMap((m) => (m.login ? [m.login] : []));
  const reviews = merges.flatMap((a, i): ReviewRow[] => {
    const reviewer = at(logins, (i + 1) % logins.length, 'a reviewer');
    return i % 3 === 0 && reviewer !== a.login ? [{ repo: repo(a.repo), number: a.number, reviewer, firstAt: new Date(Date.parse(a.at) - DAY / 2).toISOString() }] : [];
  });
  return profileOf(
    {
      board: { roster, activity, answered: demoAnswered(roster), galaxy, prds: demoPrds(roster) },
      work: { tracked: DEMO_TRACKED, pullRequests, reviews },
      dossiers: { rows: demoDossiers(roster, now), stages: new Map(), facts: new Map() },
    },
    { login, viewerId: DEMO_VIEWER.userId, period, now },
  );
}

/** The demo history's dossiers, the demo viewer's credited to the demo's *you*, so their profile lists them. */
function demoDossiers(roster: readonly { userId: string }[], now: Date): DossierListRow[] {
  const you = roster.some((m) => m.userId === DEMO_VIEWER.userId) ? DEMO_VIEWER.userId : null;
  return demoHistory(now.getTime()).map((row) => (row.opened_by === DEMO_DOSSIER_VIEWER ? { ...row, opened_by: you } : row));
}
