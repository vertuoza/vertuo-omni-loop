// A stubbed Supabase client for the dossier API's tests: the two dossier tables in memory, the Auth
// server's token check, and the two functions of supabase/migrations/20260928090000_dossiers.sql,
// written here as the migration writes them, so the API's tests prove its rules:
//
// - dossier_open(title, repo, claude session): a draft (no number) in the caller's workspace for the
//   repository — the one whose github_org owns it, else the one they joined first
//   (ask_session_workspace()); refused 42501 for an account in no workspace.
// - dossier_push(repo, prd, title, draft, artifacts): the draft named (P0002 when the caller cannot
//   read it; 22023 when it is another repository's, or already another PRD), else the dossier keyed
//   by workspace, repository and PRD, else a new one. A draft numbered to a key already taken is merged
//   into that dossier — its versions, its Claude session id and its opener move over, it is dated from
//   the earlier opening, and it goes. Every push sets the title. Each artifact adds a version only when
//   the SHA-256 of its content, computed here and never taken from the caller, differs from the latest
//   version of its kind; a version's number is its place among its kind's versions.
//
// Since PRD 627 a dossier has a kind (prd, visual or bug), keyed with the repository and the number: a push
// names it (a PRD's when it does not), each kind takes only its own versions, a fix is never a draft, and
// a round of variations is added unless one of the same content is there
// (supabase/migrations/20261011090000_fix_dossiers.sql).
//
// The repository is kept in lower case, as the migration keeps it. The page's reads (PRD 216's page to
// share) run on the same tables under the migration's access rules on reading and deleting, written
// here as its policies write them, and name people through ask_members() (PRD 144). That the database holds those rules, and that nothing is ever
// written to the tables but through these functions, is proved by supabase/checks/dossiers.sql, not
// here.
//
// The questions that shaped a dossier (PRD 216, step 3): PRD 144's ask sessions and rounds in memory,
// seeded by a test (seedAsk), each readable by the members of its session's workspace, and
// dossier_rounds(dossier) of supabase/migrations/20260928100000_dossier_rounds.sql written here as the
// migration writes it — brainstorm (the dossier's Claude session, from its opening to that session's
// next dossier) and delivery (its number in its home repository), in its own workspace, a round both
// match once as brainstorm, in the order they were asked, nothing for someone who cannot read it.
//
// The history (PRD 216, step 4): each workspace's plan repository and its ledger's REGION_SURVEYED
// events, seeded by a test (seedPlanet), and dossier_list(dossier) of
// supabase/migrations/20260928110000_dossier_list.sql written here as the migration writes it — each
// dossier `me` may read (or only the one named), its repositories (home first, then its rounds' and, for
// a PRD of its workspace's plan repository, its planet's regions as <github_org>/<region>, in lower case,
// once each, in order), its latest version of each kind, its rounds asked and answered, and its last
// activity (its opening, numbering, versions and rounds asked or answered), newest first.
import { createHash } from 'node:crypto';
import {
  ARTIFACT_KINDS, ARTIFACT_MAX_BYTES, KIND_ARTIFACTS, latestVersions, TITLE_MAX, WORK_KINDS, type ArtifactKind, type DossierListRow, type DossierRoundRow,
  type RoundRule, type WorkKind,
} from './store';
import { FAKE_WORKSPACE, type FakeAccount } from '../ask/store.fake';

type Row = Record<string, unknown>;
type Failure = { code?: string; message: string };
type Result = { data: unknown; error: Failure | null };

// An account, and the workspaces it belongs to in the order it joined them: FAKE_WORKSPACE when none is
// named. `name`: the arcade name ask_members() gives, when they picked one. The ask fake's own.
export { FAKE_WORKSPACE, type FakeAccount };

export type FakeDossier = {
  id: string; workspace_id: string; home_repo: string; prd: number | null; kind: WorkKind; title: string;
  opened_by: string | null; claude_session_id: string | null; created_at: string; numbered_at: string | null;
};
export type FakeVersion = {
  id: string; dossier_id: string; kind: string; content: string; sha256: string; bytes: number;
  source: 'kit' | 'github'; uploaded_by: string | null; commit_sha: string | null; git_blob: string | null; created_at: string;
};

/** An ask session (PRD 71, PRD 144), with the workspace PRD 144 placed it in. */
export type FakeAskSession = {
  id: string; owner: string; workspace_id: string | null; repo: string | null; branch: string | null; claude_session_id: string | null;
};
/** An ask round (PRD 71, PRD 144). */
export type FakeAskRound = {
  id: string; session_id: string; questions: unknown; answers: Record<string, string> | null;
  status: 'open' | 'answered' | 'abandoned'; answered_via: 'page' | 'terminal' | null; answered_by: string | null;
  category: string | null; category_by: string | null; prd: number | null; skill: string | null;
  created_at: string; answered_at: string | null;
};
/** A share (PRD 144): a round, the member it is shared with, who shared it and when. */
export type FakeAskShare = { round_id: string; shared_with: string; shared_by: string; created_at: string };
/** A ledger event (PRD 100), as much of it as the history reads. */
export type FakeLedgerEvent = { workspace_id: string; type: string; planet: number; region: string | null };

const REPO =/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/;
const sha256 = (content: string) => createHash('sha256').update(content, 'utf8').digest('hex');
const refuse = (code: string, message: string): Result => ({ data: null, error: { code, message } });

/**
 * @param accounts by access token
 * @param orgs each workspace's github_org, by workspace id: a workspace not named owns no organisation
 */
export function fakeSupabase(accounts: Record<string, FakeAccount>, orgs: Record<string, string | null> = {}, now: () => number = Date.now) {
  const tables = {
    dossiers: [] as FakeDossier[], dossier_versions: [] as FakeVersion[],
    ask_sessions: [] as FakeAskSession[], ask_rounds: [] as FakeAskRound[], ask_shares: [] as FakeAskShare[],
    ledger_events: [] as FakeLedgerEvent[],
    /** Each workspace's plan repository, a bare name, by workspace id. */
    plan_repos: {} as Record<string, string>,
  };
  const state = { fail: null as Failure | null, calls: 0 };
  let next = 0;
  let tick = 0;
  const newId = () => `00000000-0000-4000-8000-${String((next += 1)).padStart(12, '0')}`;
  const stamp = () => new Date(now()).toISOString();
  // clock_timestamp(): later for every version, even within one push.
  const clock = () => new Date(now() + (tick += 1)).toISOString();

  const workspacesOf = (me: FakeAccount) => me.workspaces ?? [FAKE_WORKSPACE];
  const isMember = (me: FakeAccount, workspace: string) => workspacesOf(me).includes(workspace);

  /** ask_session_workspace(): the caller's workspace whose github_org owns the repository, else the first they joined. */
  function workspaceFor(me: FakeAccount, repo: string): string | null {
    const owner = repo.split('/')[0];
    const mine = workspacesOf(me);
    return mine.find((w) => (orgs[w] ?? '').toLowerCase() === owner && owner !== '') ?? mine[0] ?? null;
  }

  /** dossier_add_version(): the version added, or null when the content equals the latest of its kind (for
   * variations, any round of its kind: 20261011090000_fix_dossiers.sql). */
  function addVersion(
    dossier: FakeDossier, kind: string, content: string,
    { source, uploadedBy = null, commitSha = null }: { source: 'kit' | 'github'; uploadedBy?: string | null; commitSha?: string | null },
  ) {
    const hash = sha256(content);
    const ofKind = tables.dossier_versions.filter((v) => v.dossier_id === dossier.id && v.kind === kind);
    const latest = [...ofKind].sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1);
    if (kind === 'variations' ? ofKind.some((v) => v.sha256 === hash) : latest?.sha256 === hash) return null;
    tables.dossier_versions.push({
      id: newId(), dossier_id: dossier.id, kind, content, sha256: hash, bytes: Buffer.byteLength(content, 'utf8'),
      source, uploaded_by: uploadedBy, commit_sha: commitSha, git_blob: null, created_at: clock(),
    });
    return ofKind.length + 1;
  }

  function open(me: FakeAccount | null, args: Row): Result {
    if (!me) return refuse('42501', 'Sign in first.');
    const title = typeof args.p_title === 'string' ? args.p_title.trim() : '';
    const repo = typeof args.p_repo === 'string' ? args.p_repo.trim().toLowerCase() : '';
    const session = args.p_claude_session_id ?? null;
    if (title.length < 1 || title.length > TITLE_MAX) return refuse('22023', 'A dossier needs a title of 1 to 200 characters.');
    if (!REPO.test(repo)) return refuse('22023', 'A dossier needs its repository as owner/name.');
    if (!(session === null || (typeof session === 'string' && session.length >= 1 && session.length <= 200))) {
      return refuse('22023', 'A Claude session id is 1 to 200 characters.');
    }
    const place = workspaceFor(me, repo);
    if (!place) return refuse('42501', 'Join a workspace first: a dossier belongs to one.');
    const row: FakeDossier = {
      id: newId(), workspace_id: place, home_repo: repo, prd: null, kind: 'prd', title, opened_by: me.id,
      claude_session_id: session as string | null, created_at: stamp(), numbered_at: null,
    };
    tables.dossiers.push(row);
    return { data: row.id, error: null };
  }

  function push(me: FakeAccount | null, args: Row): Result {
    if (!me) return refuse('42501', 'Sign in first.');
    const repo = typeof args.p_repo === 'string' ? args.p_repo.trim().toLowerCase() : '';
    const prd = args.p_prd;
    const title = typeof args.p_title === 'string' ? args.p_title.trim() : '';
    const draftId = args.p_draft ?? null;
    const artifacts = args.p_artifacts;
    const kind = (args.p_kind ?? 'prd') as WorkKind;
    if (!WORK_KINDS.includes(kind)) return refuse('22023', 'A dossier\'s kind is prd, visual or bug.');
    if (!REPO.test(repo)) return refuse('22023', 'A dossier needs its repository as owner/name.');
    if (!Number.isInteger(prd) || (prd as number) <= 0) return refuse('22023', 'A PRD number is a positive whole number.');
    if (title.length < 1 || title.length > TITLE_MAX) return refuse('22023', 'A dossier needs a title of 1 to 200 characters.');
    if (!Array.isArray(artifacts)) return refuse('22023', 'The artifacts are a list.');
    const seen = new Set<string>();
    for (const item of artifacts as Row[]) {
      if (!item || typeof item !== 'object' || !ARTIFACT_KINDS.includes(item.kind as never) || typeof item.content !== 'string') {
        return refuse('22023', 'Each artifact is {kind, content}, its kind one of spec, plan, before-after, variations, bug-record.');
      }
      if (item.kind !== 'variations' && seen.has(item.kind as string)) return refuse('22023', 'Each kind is sent once.');
      if (!KIND_ARTIFACTS[kind].includes(item.kind as ArtifactKind)) return refuse('22023', `A ${kind} dossier takes no ${item.kind as string} version.`);
      seen.add(item.kind as string);
      if (Buffer.byteLength(item.content as string, 'utf8') > ARTIFACT_MAX_BYTES) return refuse('54000', 'An artifact holds 512 KiB at most.');
    }

    let dossier: FakeDossier;
    if (draftId !== null) {
      if (kind !== 'prd') return refuse('22023', 'A fix has no draft: push it by its number alone.');
      const draft = tables.dossiers.find((d) => d.id === draftId && isMember(me, d.workspace_id));
      if (!draft) return refuse('P0002', 'No such draft dossier.');
      if (draft.home_repo !== repo) return refuse('22023', `This draft belongs to ${draft.home_repo}.`);
      if (draft.prd !== null && draft.prd !== prd) return refuse('22023', `This dossier is already PRD #${draft.prd}.`);
      dossier = draft;
      if (draft.prd === null) {
        const keyed = tables.dossiers.find((d) => d.workspace_id === draft.workspace_id && d.home_repo === repo && d.kind === 'prd' && d.prd === prd);
        if (keyed) {
          for (const version of tables.dossier_versions) if (version.dossier_id === draft.id) version.dossier_id = keyed.id;
          keyed.claude_session_id = draft.claude_session_id ?? keyed.claude_session_id;
          keyed.opened_by = draft.opened_by ?? keyed.opened_by;
          if (draft.created_at < keyed.created_at) keyed.created_at = draft.created_at;
          tables.dossiers = tables.dossiers.filter((d) => d.id !== draft.id);
          dossier = keyed;
        } else {
          Object.assign(draft, { prd, numbered_at: stamp() });
        }
      }
    } else {
      const place = workspaceFor(me, repo);
      if (!place) return refuse('42501', 'Join a workspace first: a dossier belongs to one.');
      const keyed = tables.dossiers.find((d) => d.workspace_id === place && d.home_repo === repo && d.kind === kind && d.prd === prd);
      if (keyed) {
        dossier = keyed;
      } else {
        dossier = {
          id: newId(), workspace_id: place, home_repo: repo, prd: prd as number, kind, title, opened_by: me.id,
          claude_session_id: null, created_at: stamp(), numbered_at: stamp(),
        };
        tables.dossiers.push(dossier);
      }
    }
    dossier.title = title;

    const added: Array<{ kind: string; version: number }> = [];
    const unchanged: string[] = [];
    for (const { kind, content } of artifacts as Array<{ kind: string; content: string }>) {
      const version = addVersion(dossier, kind, content, { source: 'kit', uploadedBy: me.id });
      if (version === null) unchanged.push(kind);
      else added.push({ kind, version });
    }
    return { data: { id: dossier.id, added, unchanged }, error: null };
  }

  /**
   * A query on one of the two tables, as `me` under the migration's access rules: a member of the
   * dossier's workspace reads it and its versions, and nobody else reads anything; the opener deletes
   * their own draft (its versions go with it), and no other delete removes a row. Only the steps the
   * page's reads and the lookup take: select, eq, order (nulls where Postgres puts them, or where `nullsFirst` says), limit, maybeSingle, delete.
   */
  function query(me: FakeAccount | null, table: 'dossiers' | 'dossier_versions' | 'ask_shares') {
    let columns: string[] | null = null;
    let removing = false;
    const filters: Array<(row: Row) => boolean> = [];
    const orders: Array<{ column: string; ascending: boolean; nullsFirst: boolean }> = [];
    let most = Infinity;

    const readable = (row: Row): boolean => {
      if (!me) return false;
      if (table === 'ask_shares') {
        // "a member reads the shares of their workspace's rounds" (20260927120000_ask_shares.sql).
        const round = tables.ask_rounds.find((r) => r.id === row.round_id);
        const session = round && tables.ask_sessions.find((s) => s.id === round.session_id);
        return row.shared_with === me.id || (typeof session?.workspace_id === 'string' && isMember(me, session.workspace_id));
      }
      const workspace = table === 'dossiers' ? row.workspace_id : tables.dossiers.find((d) => d.id === row.dossier_id)?.workspace_id;
      return typeof workspace === 'string' && isMember(me, workspace);
    };
    const deletable = (row: Row) => table === 'dossiers' && me !== null && row.opened_by === me.id && row.prd === null;
    const project = (row: Row) => (columns ? Object.fromEntries(columns.map((c) => [c, row[c]])) : { ...row });
    const compare = (a: Row, b: Row) => {
      for (const { column, ascending, nullsFirst } of orders) {
        if ((a[column] === null) !== (b[column] === null)) return (a[column] === null) === nullsFirst ? -1 : 1;
        const [x, y] = [String(a[column]), String(b[column])];
        if (x !== y) return (x < y ? -1 : 1) * (ascending ? 1 : -1);
      }
      return 0;
    };

    function run(): Result {
      state.calls += 1;
      if (state.fail) return { data: null, error: state.fail };
      const rows = (tables[table] as Row[]).filter((row) => readable(row) && filters.every((f) => f(row)));
      if (!removing) return { data: [...rows].sort(compare).slice(0, most).map(project), error: null };
      const gone = new Set(rows.filter(deletable).map((row) => row.id));
      tables.dossiers = tables.dossiers.filter((d) => !gone.has(d.id));
      tables.dossier_versions = tables.dossier_versions.filter((v) => !gone.has(v.dossier_id));
      return { data: columns ? rows.filter((row) => gone.has(row.id)).map(project) : null, error: null };
    }

    const builder = {
      select(list = '*') { columns = list === '*' ? null : list.split(',').map((c) => c.trim()); return builder; },
      delete() { removing = true; return builder; },
      eq(column: string, value: unknown) { filters.push((row) => row[column] === value); return builder; },
      order(column: string, { ascending = true, nullsFirst = !ascending }: { ascending?: boolean; nullsFirst?: boolean } = {}) {
        orders.push({ column, ascending, nullsFirst });
        return builder;
      },
      limit(count: number) { most = count; return builder; },
      maybeSingle: () => Promise.resolve().then((): Result => {
        const result = run();
        if (result.error) return result;
        const rows = result.data as Row[];
        return rows.length > 1 ? refuse('PGRST116', 'More than one row came back.') : { data: rows[0] ?? null, error: null };
      }),
      then: <T>(resolve: (result: Result) => T, reject?: (error: unknown) => T) => Promise.resolve().then(run).then(resolve, reject),
    };
    return builder;
  }

  /** ask_members() (PRD 144), which the page names people with: a workspace's members, to its members only. */
  function members(me: FakeAccount | null, workspace: string) {
    if (!me || !isMember(me, workspace)) return [];
    return Object.values(accounts)
      .filter((account, i, all) => isMember(account, workspace) && all.findIndex((a) => a.id === account.id) === i)
      .map((account) => ({ user_id: account.id, email: account.email, name: account.name ?? null }));
  }

  /** dossier_rounds(): the dossier's rounds by the two rules, as `me` may read them. */
  function rounds(me: FakeAccount | null, dossierId: unknown): DossierRoundRow[] {
    const at = (iso: string) => Date.parse(iso);
    const dossier = tables.dossiers.find((d) => d.id === dossierId && me !== null && isMember(me, d.workspace_id));
    if (!dossier || !me) return [];
    const sessions = tables.ask_sessions.filter((s) => s.workspace_id === dossier.workspace_id && isMember(me, s.workspace_id));
    const next = tables.dossiers
      .filter((d) => d.workspace_id === dossier.workspace_id && d.claude_session_id !== null
        && d.claude_session_id === dossier.claude_session_id && at(d.created_at) > at(dossier.created_at))
      .map((d) => at(d.created_at));
    const windowEnd = next.length ? Math.min(...next) : Infinity;
    const ruleOf = (round: FakeAskRound, session: FakeAskSession): RoundRule | null => {
      const brainstorm = dossier.claude_session_id !== null && session.claude_session_id === dossier.claude_session_id
        && at(round.created_at) >= at(dossier.created_at) && at(round.created_at) < windowEnd;
      if (brainstorm) return 'brainstorm';
      const delivery = dossier.prd !== null && round.prd === dossier.prd && session.repo?.toLowerCase() === dossier.home_repo;
      return delivery ? 'delivery' : null;
    };
    return tables.ask_rounds.flatMap((round): DossierRoundRow[] => {
      const session = sessions.find((s) => s.id === round.session_id);
      const rule = session ? ruleOf(round, session) : null;
      if (!session || !rule) return [];
      const { id, session_id: _session, ...rest } = round;
      return [{ rule, round_id: id, session_id: session.id, asked_by: session.owner, repo: session.repo, branch: session.branch, ...rest }];
    }).sort((a, b) => at(a.created_at) - at(b.created_at) || a.round_id.localeCompare(b.round_id));
  }

  /** dossier_list(): each dossier `me` may read, or only `dossierId`'s, as the history lists it. */
  function list(me: FakeAccount | null, dossierId: unknown): DossierListRow[] {
    if (!me) return [];
    const dossiers = tables.dossiers.filter((d) => isMember(me, d.workspace_id) && (dossierId === null || dossierId === undefined || d.id === dossierId));
    return dossiers.map((d): DossierListRow => {
      const asked = rounds(me, d.id);
      const versions = tables.dossier_versions.filter((v) => v.dossier_id === d.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
      const latest = latestVersions(versions, ARTIFACT_KINDS);
      const org = orgs[d.workspace_id] ?? null;
      const plan = tables.plan_repos[d.workspace_id] ?? null;
      const regions = d.kind === 'prd' && org && plan && d.home_repo === `${org}/${plan}`.toLowerCase()
        ? tables.ledger_events
          .filter((e) => e.workspace_id === d.workspace_id && e.planet === d.prd && e.type === 'REGION_SURVEYED' && e.region !== null)
          .map((e) => `${org}/${e.region}`.toLowerCase())
        : [];
      const others = [...new Set([...asked.flatMap((r) => (r.repo ? [r.repo.toLowerCase()] : [])), ...regions])]
        .filter((repo) => repo !== d.home_repo).sort();
      const times = [d.created_at, d.numbered_at, ...versions.map((v) => v.created_at), ...asked.flatMap((r) => [r.created_at, r.answered_at])]
        .filter((t): t is string => t !== null);
      const { claude_session_id: _session, ...row } = d;
      return {
        ...row,
        repos: [d.home_repo, ...others],
        latest,
        asked: asked.length,
        answered: asked.filter((r) => r.status === 'answered').length,
        last_activity: new Date(Math.max(...times.map((t) => Date.parse(t)))).toISOString(),
      };
    }).sort((a, b) => Date.parse(b.last_activity) - Date.parse(a.last_activity) || a.id.localeCompare(b.id));
  }

  /** The client for one bearer token: acting as its account, as the API's real client does. */
  function client(token: string) {
    const me = accounts[token] ?? null;
    return {
      from: (table: 'dossiers' | 'dossier_versions' | 'ask_shares') => query(me, table),
      rpc: (name: string, args: Row) => Promise.resolve().then((): Result => {
        state.calls += 1;
        if (state.fail) return { data: null, error: state.fail };
        if (name === 'dossier_open') return open(me, args);
        if (name === 'dossier_push') return push(me, args);
        if (name === 'ask_members') return { data: members(me, args.workspace as string), error: null };
        if (name === 'dossier_rounds') return { data: rounds(me, args.p_dossier), error: null };
        if (name === 'dossier_list') return { data: list(me, args.p_dossier), error: null };
        return refuse('PGRST202', `Could not find the function public.${name}`);
      }),
      auth: {
        async getUser(jwt: string) {
          const account = accounts[jwt];
          return account
            ? { data: { user: { id: account.id, email: account.email } }, error: null }
            : { data: { user: null }, error: { name: 'AuthApiError', status: 401, message: 'invalid JWT' } };
        },
      },
    };
  }

  /** A dossier the fallback created (no opener, no Claude session), with versions read from GitHub. */
  function seedFromGithub({ workspace = FAKE_WORKSPACE, repo, prd, kind = 'prd', title, versions = [] }: {
    workspace?: string; repo: string; prd: number; kind?: WorkKind; title: string; versions?: Array<{ kind: string; content: string }>;
  }): FakeDossier {
    const dossier: FakeDossier = {
      id: newId(), workspace_id: workspace, home_repo: repo.toLowerCase(), prd, kind, title, opened_by: null,
      claude_session_id: null, created_at: stamp(), numbered_at: stamp(),
    };
    tables.dossiers.push(dossier);
    for (const { kind, content } of versions) addVersion(dossier, kind, content, { source: 'github', commitSha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678' });
    return dossier;
  }

  /** An ask session and its rounds, as PRD 144 stores them: in `workspace` (FAKE_WORKSPACE when none is
   * named), each round open unless it says otherwise. */
  function seedAsk(
    { owner, workspace = FAKE_WORKSPACE, repo = null, branch = null, claudeSessionId = null }: {
      owner: string; workspace?: string | null; repo?: string | null; branch?: string | null; claudeSessionId?: string | null;
    },
    asked: Array<Partial<FakeAskRound> & Pick<FakeAskRound, 'created_at'>>,
  ): { session: FakeAskSession; rounds: FakeAskRound[] } {
    const session: FakeAskSession = { id: newId(), owner, workspace_id: workspace, repo, branch, claude_session_id: claudeSessionId };
    tables.ask_sessions.push(session);
    const made = asked.map((round): FakeAskRound => ({
      id: newId(), session_id: session.id, questions: [{ question: 'A question?', header: '', multiSelect: false, options: [] }],
      answers: null, status: 'open', answered_via: null, answered_by: null, category: null, category_by: null, prd: null, skill: null,
      answered_at: null, ...round,
    }));
    tables.ask_rounds.push(...made);
    return { session, rounds: made };
  }

  /** A round shared with a member, as ask_round_share() records it (PRD 144). */
  function seedShare(roundId: string, sharedWith: string, sharedBy: string) {
    tables.ask_shares.push({ round_id: roundId, shared_with: sharedWith, shared_by: sharedBy, created_at: stamp() });
  }

  /** A workspace's plan repository (a bare name), and PRD `prd`'s planet surveyed in each of `regions`,
   * as the ledger's REGION_SURVEYED events record it. */
  function seedPlanet({ workspace = FAKE_WORKSPACE, planRepo, prd, regions }: {
    workspace?: string; planRepo: string; prd: number; regions: string[];
  }) {
    tables.plan_repos[workspace] = planRepo;
    for (const region of regions) tables.ledger_events.push({ workspace_id: workspace, type: 'REGION_SURVEYED', planet: prd, region });
  }

  return { tables, client, state, seedFromGithub, seedAsk, seedShare, seedPlanet, sha256 };
}
