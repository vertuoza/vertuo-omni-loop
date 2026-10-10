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
// (supabase/migrations/20261011090000_fix_dossiers.sql). Since PRD 1272 a concept is a kind too, never a
// draft, and a board round is added as a round of variations is
// (supabase/migrations/20261119090000_concept_dossiers.sql).
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
// The faces (PRD 652): workspace_roster(workspace) of supabase/migrations/20261013090000_roster_hero.sql,
// to its members only — each member's name, their GitHub login, avatar, fleet and hero as seeded by a
// test (seedPlayer), null when none was — and the workspace's fleets (`teams`), readable by its members.
//
// The history (PRD 216, step 4): each workspace's plan repository and its ledger's REGION_SURVEYED
// events, seeded by a test (seedPlanet), and dossier_list(dossier) of
// supabase/migrations/20260928110000_dossier_list.sql written here as the migration writes it — each
// dossier `me` may read (or only the one named), its repositories (home first, then its rounds' and, for
// a PRD of its workspace's plan repository, its planet's regions as <github_org>/<region>, in lower case,
// once each, in order), its latest version of each kind, its rounds asked and answered, and its last
// activity (its opening, numbering, versions and rounds asked or answered), newest first.
//
// A PRD's product (PRD 1364): each workspace's products and their repositories, seeded by a test
// (seedProduct), and dossier_push()'s birth rule of supabase/migrations/20261129100000_prd_product.sql:
// a PRD dossier with no product, in a repository of one product, takes it; in several, the one of them
// its first push names (any case); in none, none. A later push never changes it, and the answer carries
// the dossier's product, {id, name} or null. A member reads the workspace's products.
import 'server-only';
import { createHash } from 'node:crypto';
import { isOneOf, propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import {
  ARTIFACT_KINDS, ARTIFACT_MAX_BYTES, isRoundKind, KIND_ARTIFACTS, latestVersions, PUSH_KINDS, PUSHED_ARTIFACT_KINDS, TITLE_MAX, WORK_KINDS, type DossierListRow,
  type DossierRoundRow, type PushedArtifactKind, type PushKind, type RoundRule,
} from './store';
import { FAKE_WORKSPACE, userOf, type FakeAccount } from '../ask/store.fake';
import { type PrdNumber, PrdNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';

type Row = Record<string, unknown>;
type Failure = { code?: string; message: string };
type Result = { data: unknown; error: Failure | null };

// An account, and the workspaces it belongs to in the order it joined them: FAKE_WORKSPACE when none is
// named. `name`: the arcade name ask_members() gives, when they picked one. The ask fake's own.
export { FAKE_WORKSPACE, type FakeAccount };

export type FakeDossier = {
  id: string; workspace_id: string; home_repo: string; prd: PrdNumber | null; kind: PushKind; title: string;
  opened_by: string | null; claude_session_id: string | null; created_at: string; numbered_at: string | null;
  /** PRD 1364: its product, or none. */
  product_id?: string | null;
};
/** A product of a workspace (PRD 1364), and the repositories linked to it, lower-cased. */
type FakeProduct = { id: string; workspace_id: string; name: string; repos: string[] };
export type FakeVersion = {
  id: string; dossier_id: string; kind: string; content: string; sha256: string; bytes: number;
  source: 'kit' | 'github'; uploaded_by: string | null; commit_sha: string | null; git_blob: string | null; created_at: string;
};

/** What workspace_roster() adds to a member (PRD 652): each left out reads null. */
type FakePlayer = { login?: string; avatar?: string; fleet?: string; hero?: unknown };
/** A fleet of a workspace, as `teams` holds it (PRD 400, PRD 652). */
type FakeFleet = { workspace_id: string; name: string; label: string; color: string | null; mascot: string | null };

/** An ask session (PRD 71, PRD 144), with the workspace PRD 144 placed it in. */
export type FakeAskSession = {
  id: string; owner: string; workspace_id: string | null; repo: string | null; branch: string | null; claude_session_id: string | null;
};
/** An ask round (PRD 71, PRD 144). */
export type FakeAskRound = {
  id: string; session_id: string; questions: unknown; answers: Record<string, string> | null;
  status: 'open' | 'answered' | 'abandoned'; answered_via: 'page' | 'terminal' | null; answered_by: string | null;
  category: string | null; category_by: string | null; prd: PrdNumber | null; skill: string | null;
  created_at: string; answered_at: string | null;
};
/** A share (PRD 144): a round, the member it is shared with, who shared it and when. */
export type FakeAskShare = { round_id: string; shared_with: string; shared_by: string; created_at: string };
/** A ledger event (PRD 100), as much of it as the history reads. */
export type FakeLedgerEvent = { workspace_id: string; type: string; planet: number; region: string | null };

const REPO =/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/;
const sha256 = (content: string) => createHash('sha256').update(content, 'utf8').digest('hex');
const refuse = (code: string, message: string): Result => ({ data: null, error: { code, message } });

/** A check's value, or the refusal it ends the call with. */
type Checked<T> = { ok: true; value: T } | { ok: false; refusal: Result };
const refused = (code: string, message: string): { ok: false; refusal: Result } => ({ ok: false, refusal: refuse(code, message) });
/** A text argument, trimmed: anything else reads as empty. */
const trimmed = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
/** A dossier's title: 1 to TITLE_MAX characters. */
const titleFits = (title: string): boolean => title.length >= 1 && title.length <= TITLE_MAX;
/** A PRD number: a positive whole number. */
const isPrdNumber = (value: unknown): value is PrdNumber => PrdNumberSchema.safeParse(value).success;
/** A Claude session id: none, or 1 to 200 characters. */
const sessionFits = (session: unknown): session is string | null => session === null || (typeof session === 'string' && session.length >= 1 && session.length <= 200);

type SentArtifact = { kind: PushedArtifactKind; content: string };
/** dossier_push()'s arguments, checked. */
type PushArgs = { repo: string; prd: PrdNumber; title: string; draftId: unknown; kind: PushKind; sent: SentArtifact[]; product: string };

/** The artifacts a push sends to a `kind` dossier, each checked, or the refusal of the first that fails. */
function sentArtifacts(artifacts: unknown, kind: PushKind): Checked<SentArtifact[]> {
  if (!Array.isArray(artifacts)) return refused('22023', 'The artifacts are a list.');
  const seen = new Set<string>();
  const sent: SentArtifact[] = [];
  for (const item of artifacts) {
    const artifact = artifactOf(item);
    if (!artifact) return refused('22023', `Each artifact is {kind, content}, its kind one of ${PUSHED_ARTIFACT_KINDS.join(', ')}.`);
    if (!isRoundKind(artifact.kind) && seen.has(artifact.kind)) return refused('22023', 'Each kind is sent once.');
    if (!KIND_ARTIFACTS[kind].includes(artifact.kind)) return refused('22023', `A ${kind} dossier takes no ${artifact.kind} version.`);
    seen.add(artifact.kind);
    if (Buffer.byteLength(artifact.content, 'utf8') > ARTIFACT_MAX_BYTES) return refused('54000', 'An artifact holds 512 KiB at most.');
    sent.push(artifact);
  }
  return { ok: true, value: sent };
}

/** An artifact as a push sends it, `{kind, content}`, or null when it is not one. */
function artifactOf(item: unknown): SentArtifact | null {
  const kind = propertyOf(item, 'kind'), content = propertyOf(item, 'content');
  if (!item || typeof item !== 'object' || !isOneOf(PUSHED_ARTIFACT_KINDS, kind) || typeof content !== 'string') return null;
  return { kind, content };
}

/**
 * @param accounts by access token
 * @param orgs each workspace's github_org, by workspace id: a workspace not named owns no organisation
 */
/** `row` without `keys`: what a rest destructure gave, with no unused name for each key left out. */
function omit<T extends object, K extends keyof T>(row: T, keys: readonly K[]): Omit<T, K> {
  const copy: T = { ...row };
  for (const key of keys) Reflect.deleteProperty(copy, key);
  return copy;
}

export function fakeSupabase(accounts: Record<string, FakeAccount>, orgs: Record<string, string | null> = {}, now: () => number = Date.now) {
  const tables: {
    dossiers: FakeDossier[]; dossier_versions: FakeVersion[];
    ask_sessions: FakeAskSession[]; ask_rounds: FakeAskRound[]; ask_shares: FakeAskShare[];
    ledger_events: FakeLedgerEvent[];
    /** Each workspace's plan repository, a bare name, by workspace id. */
    plan_repos: Record<string, string>;
    /** Each member's GitHub login, avatar, fleet and hero (PRD 652), by workspace id then account id. */
    players: Record<string, Record<string, FakePlayer>>;
    teams: FakeFleet[];
    products: FakeProduct[];
  } = {
    dossiers: [], dossier_versions: [],
    ask_sessions: [], ask_rounds: [], ask_shares: [],
    ledger_events: [],
    plan_repos: {},
    players: {},
    teams: [],
    products: [],
  };
  /** `fail`: every read fails so. `rosterDown` (PRD 652): only the faces' reads (roster and fleets) fail. */
  const state: { fail: Failure | null; calls: number; rosterDown: boolean } = { fail: null, calls: 0, rosterDown: false };
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
   * variations and boards, any round of its kind: 20261011090000_fix_dossiers.sql, 20261119090000_concept_dossiers.sql). */
  function addVersion(
    dossier: FakeDossier, kind: string, content: string,
    { source, uploadedBy = null, commitSha = null }: { source: 'kit' | 'github'; uploadedBy?: string | null; commitSha?: string | null },
  ) {
    const hash = sha256(content);
    const ofKind = tables.dossier_versions.filter((v) => v.dossier_id === dossier.id && v.kind === kind);
    const latest = [...ofKind].sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1);
    if (kind === 'variations' || kind === 'board' ? ofKind.some((v) => v.sha256 === hash) : latest?.sha256 === hash) return null;
    tables.dossier_versions.push({
      id: newId(), dossier_id: dossier.id, kind, content, sha256: hash, bytes: Buffer.byteLength(content, 'utf8'),
      source, uploaded_by: uploadedBy, commit_sha: commitSha, git_blob: null, created_at: clock(),
    });
    return ofKind.length + 1;
  }

  function open(me: FakeAccount | null, args: Row): Result {
    if (!me) return refuse('42501', 'Sign in first.');
    const title = trimmed(args.p_title);
    const repo = trimmed(args.p_repo).toLowerCase();
    const session = args.p_claude_session_id ?? null;
    if (!titleFits(title)) return refuse('22023', 'A dossier needs a title of 1 to 200 characters.');
    if (!REPO.test(repo)) return refuse('22023', 'A dossier needs its repository as owner/name.');
    if (!sessionFits(session)) return refuse('22023', 'A Claude session id is 1 to 200 characters.');
    const place = workspaceFor(me, repo);
    if (!place) return refuse('42501', 'Join a workspace first: a dossier belongs to one.');
    const row: FakeDossier = {
      id: newId(), workspace_id: place, home_repo: repo, prd: null, kind: 'prd', title, opened_by: me.id,
      claude_session_id: session, created_at: stamp(), numbered_at: null,
    };
    tables.dossiers.push(row);
    return { data: row.id, error: null };
  }

  /** dossier_push()'s arguments, checked in the order the migration checks them, or its refusal. */
  function pushArgs(args: Row): Checked<PushArgs> {
    const repo = trimmed(args.p_repo).toLowerCase();
    const prd = args.p_prd;
    const title = trimmed(args.p_title);
    const kind = args.p_kind ?? 'prd';
    if (!isOneOf(PUSH_KINDS, kind)) return refused('22023', 'A dossier\'s kind is prd, visual, bug or concept.');
    if (!REPO.test(repo)) return refused('22023', 'A dossier needs its repository as owner/name.');
    if (!isPrdNumber(prd)) return refused('22023', 'A PRD number is a positive whole number.');
    if (!titleFits(title)) return refused('22023', 'A dossier needs a title of 1 to 200 characters.');
    const sent = sentArtifacts(args.p_artifacts, kind);
    if (!sent.ok) return sent;
    const product = trimmed(args.p_product).toLowerCase();
    return { ok: true, value: { repo, prd, title, draftId: args.p_draft ?? null, kind, sent: sent.value, product } };
  }

  /** The draft named, numbered `prd`: merged into the dossier already keyed so, if there is one. */
  function numberedDraft(me: FakeAccount, { draftId, repo, prd, kind }: PushArgs): Checked<FakeDossier> {
    if (kind !== 'prd') return refused('22023', `A ${kind} dossier has no draft: push it by its number alone.`);
    const draft = tables.dossiers.find((d) => d.id === draftId && isMember(me, d.workspace_id));
    if (!draft) return refused('P0002', 'No such draft dossier.');
    if (draft.home_repo !== repo) return refused('22023', `This draft belongs to ${draft.home_repo}.`);
    if (draft.prd !== null && draft.prd !== prd) return refused('22023', `This dossier is already PRD #${draft.prd}.`);
    if (draft.prd !== null) return { ok: true, value: draft };
    const keyed = tables.dossiers.find((d) => d.workspace_id === draft.workspace_id && d.home_repo === repo && d.kind === 'prd' && d.prd === prd);
    if (!keyed) {
      Object.assign(draft, { prd, numbered_at: stamp() });
      return { ok: true, value: draft };
    }
    mergeDraft(draft, keyed);
    return { ok: true, value: keyed };
  }

  /** A draft numbered to a key already taken: its versions, Claude session id and opener move over,
   * the dossier is dated from the earlier opening, and the draft goes. */
  function mergeDraft(draft: FakeDossier, keyed: FakeDossier): void {
    for (const version of tables.dossier_versions) if (version.dossier_id === draft.id) version.dossier_id = keyed.id;
    keyed.claude_session_id = draft.claude_session_id ?? keyed.claude_session_id;
    keyed.opened_by = draft.opened_by ?? keyed.opened_by;
    if (draft.created_at < keyed.created_at) keyed.created_at = draft.created_at;
    tables.dossiers = tables.dossiers.filter((d) => d.id !== draft.id);
  }

  /** The dossier keyed by the caller's workspace, the repository, the kind and the number, else a new one. */
  function keyedDossier(me: FakeAccount, { repo, prd, kind, title }: PushArgs): Checked<FakeDossier> {
    const place = workspaceFor(me, repo);
    if (!place) return refused('42501', 'Join a workspace first: a dossier belongs to one.');
    const keyed = tables.dossiers.find((d) => d.workspace_id === place && d.home_repo === repo && d.kind === kind && d.prd === prd);
    if (keyed) return { ok: true, value: keyed };
    const dossier: FakeDossier = {
      id: newId(), workspace_id: place, home_repo: repo, prd, kind, title, opened_by: me.id,
      claude_session_id: null, created_at: stamp(), numbered_at: stamp(),
    };
    tables.dossiers.push(dossier);
    return { ok: true, value: dossier };
  }

  function push(me: FakeAccount | null, args: Row): Result {
    if (!me) return refuse('42501', 'Sign in first.');
    const checked = pushArgs(args);
    if (!checked.ok) return checked.refusal;
    const pushed = checked.value;
    const found = pushed.draftId !== null ? numberedDraft(me, pushed) : keyedDossier(me, pushed);
    if (!found.ok) return found.refusal;
    const dossier = found.value;
    dossier.title = pushed.title;
    if (pushed.kind === 'prd') bear(dossier, pushed.product);

    const added: Array<{ kind: string; version: number }> = [];
    const unchanged: string[] = [];
    for (const { kind, content } of pushed.sent) {
      const version = addVersion(dossier, kind, content, { source: 'kit', uploadedBy: me.id });
      if (version === null) unchanged.push(kind);
      else added.push({ kind, version });
    }
    const product = tables.products.find((p) => p.id === dossier.product_id);
    return { data: { id: dossier.id, added, unchanged, product: product ? { id: product.id, name: product.name } : null }, error: null };
  }

  /** The birth rule (PRD 1364): a PRD dossier with no product takes its repository's only one, or, on its
   * first push in a repository of several, the one of them `named` (lower-cased) names. */
  function bear(dossier: FakeDossier, named: string): void {
    if (dossier.product_id) return;
    const first = !tables.dossier_versions.some((v) => v.dossier_id === dossier.id);
    const ofRepo = tables.products.filter((p) => p.workspace_id === dossier.workspace_id && p.repos.includes(dossier.home_repo));
    const [only] = ofRepo;
    if (ofRepo.length === 1 && only) dossier.product_id = only.id;
    else if (first && named !== '') dossier.product_id = ofRepo.find((p) => p.name.toLowerCase() === named)?.id ?? null;
  }

  /**
   * A query on one of the two tables, as `me` under the migration's access rules: a member of the
   * dossier's workspace reads it and its versions, and nobody else reads anything; the opener deletes
   * their own draft (its versions go with it), and no other delete removes a row. Only the steps the
   * page's reads and the lookup take: select, eq, order (nulls where Postgres puts them, or where `nullsFirst` says), limit, maybeSingle, delete.
   */
  function query(me: FakeAccount | null, table: 'dossiers' | 'dossier_versions' | 'ask_shares' | 'teams' | 'products') {
    let columns: string[] | null = null;
    let removing = false;
    const filters: Array<(row: Row) => boolean> = [];
    const orders: Array<{ column: string; ascending: boolean; nullsFirst: boolean }> = [];
    let most = Infinity;

    const readable = (row: Row): boolean => {
      if (!me) return false;
      if (table === 'teams' || table === 'products') return typeof row.workspace_id === 'string' && isMember(me, row.workspace_id);
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
      const all: readonly Row[] = tables[table];
      const rows = all.filter((row) => readable(row) && filters.every((f) => f(row)));
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
        const rows: readonly unknown[] = Array.isArray(result.data) ? result.data : [];
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

  /** workspace_roster() (PRD 652): a workspace's members with their login, avatar, fleet and hero, to its members only. */
  function roster(me: FakeAccount | null, workspace: string) {
    return members(me, workspace).map((member) => {
      const player = tables.players[workspace]?.[member.user_id] ?? {};
      return {
        user_id: member.user_id, name: member.name, github_login: player.login ?? null, avatar_url: player.avatar ?? null,
        fleet: player.fleet ?? null, hero: player.hero ?? null,
      };
    });
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
      const { id } = round;
      const rest = omit(round, ['id', 'session_id']);
      return [{ rule, round_id: id, session_id: session.id, asked_by: session.owner, repo: session.repo, branch: session.branch, ...rest }];
    }).sort((a, b) => at(a.created_at) - at(b.created_at) || a.round_id.localeCompare(b.round_id));
  }

  /** dossier_list(): each dossier `me` may read, or only `dossierId`'s, as the history lists it. */
  function list(me: FakeAccount | null, dossierId: unknown): DossierListRow[] {
    if (!me) return [];
    // A concept (PRD 1272) is left out: the history's rows are of the kinds the pages read, and the
    // concept's own list comes with its pages. The database's dossier_list() does list it.
    const dossiers = tables.dossiers.filter((d) => isMember(me, d.workspace_id) && (dossierId === null || dossierId === undefined || d.id === dossierId));
    return dossiers.flatMap((d): DossierListRow[] => {
      const kind = d.kind;
      if (!isOneOf(WORK_KINDS, kind)) return [];
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
      const row = omit(d, ['claude_session_id']);
      return [{
        ...row,
        kind,
        repos: [d.home_repo, ...others],
        latest,
        asked: asked.length,
        answered: asked.filter((r) => r.status === 'answered').length,
        last_activity: new Date(Math.max(...times.map((t) => Date.parse(t)))).toISOString(),
      }];
    }).sort((a, b) => Date.parse(b.last_activity) - Date.parse(a.last_activity) || a.id.localeCompare(b.id));
  }

  /** One of the functions, called as `me`. */
  function call(me: FakeAccount | null, name: string, args: Row): Result {
    if (name === 'dossier_open') return open(me, args);
    if (name === 'dossier_push') return push(me, args);
    const workspace = typeof args.workspace === 'string' ? args.workspace : '';
    if (name === 'ask_members') return { data: members(me, workspace), error: null };
    if (name === 'workspace_roster') {
      return state.rosterDown ? refuse('57014', 'canceling statement due to statement timeout') : { data: roster(me, workspace), error: null };
    }
    if (name === 'dossier_rounds') return { data: rounds(me, args.p_dossier), error: null };
    if (name === 'dossier_list') return { data: list(me, args.p_dossier), error: null };
    return refuse('PGRST202', `Could not find the function public.${name}`);
  }

  /** The client for one bearer token: acting as its account, as the API's real client does. */
  function client(token: string) {
    const me = accounts[token] ?? null;
    return {
      from: (table: 'dossiers' | 'dossier_versions' | 'ask_shares' | 'teams' | 'products') => query(me, table),
      rpc: (name: string, args: Row) => Promise.resolve().then((): Result => {
        state.calls += 1;
        if (state.fail) return { data: null, error: state.fail };
        return call(me, name, args);
      }),
      auth: {
        getUser(jwt: string) {
          return Promise.resolve(userOf(accounts[jwt]));
        },
      },
    };
  }

  /** A dossier the fallback created (no opener, no Claude session), with versions read from GitHub. */
  function seedFromGithub({ workspace = FAKE_WORKSPACE, repo, prd, kind = 'prd', title, versions = [] }: {
    workspace?: string; repo: string; prd: PrdNumber; kind?: PushKind; title: string; versions?: Array<{ kind: string; content: string }>;
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
    workspace?: string; planRepo: string; prd: PrdNumber; regions: string[];
  }) {
    tables.plan_repos[workspace] = planRepo;
    for (const region of regions) tables.ledger_events.push({ workspace_id: workspace, type: 'REGION_SURVEYED', planet: prd, region });
  }

  /** A member's GitHub login, avatar, fleet and hero in `workspace` (PRD 652), and a fleet they fly in. */
  function seedPlayer(userId: string, player: FakePlayer, { workspace = FAKE_WORKSPACE, fleet }: { workspace?: string; fleet?: Omit<FakeFleet, 'workspace_id'> } = {}) {
    (tables.players[workspace] ??= {})[userId] = player;
    if (fleet) tables.teams.push({ workspace_id: workspace, ...fleet });
  }

  /** A product of `workspace` named `name` (PRD 1364), its repositories linked to it; its id. */
  function seedProduct(name: string, repos: string[], { workspace = FAKE_WORKSPACE }: { workspace?: string } = {}): string {
    const id = newId();
    tables.products.push({ id, workspace_id: workspace, name, repos: repos.map((r) => r.toLowerCase()) });
    return id;
  }

  return { tables, client, state, seedFromGithub, seedAsk, seedShare, seedPlanet, seedPlayer, seedProduct, sha256 };
}
