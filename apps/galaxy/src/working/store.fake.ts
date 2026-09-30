// A stubbed Supabase client for the heartbeat's tests: the working_pings table and the dossiers it
// resolves to, in memory, the Auth server's token check, and working_ping() of
// supabase/migrations/20261020090000_working_pings.sql written here as the migration writes it:
//
// - refused 42501 for a session another account owns, and for a caller with no workspace (the fake's
//   repo_workspace(): the member workspace whose GitHub org owns the repository, else the one joined
//   first);
// - the dossier: a draft by its id in that workspace, else the one keyed by workspace, repository (lower
//   case), kind and number, else null;
// - an ended ping stamps the end and keeps the work; any other ping sets the work and clears the end.
//
// Reading runs under the migration's policy: a member of the row's workspace reads it. That the
// database holds these rules is proved by supabase/checks/working_pings.sql, not here.

type Failure = { code?: string; message: string };
type Result = { data: unknown; error: Failure | null };
type Row = Record<string, unknown>;

/** An account, and the workspaces it belongs to in the order it joined them. */
export type FakeAccount = { id: string; email: string | null; workspaces: string[] };

type FakeDossierKey = { id: string; workspace_id: string; home_repo: string; kind: 'prd' | 'visual' | 'bug'; prd: number | null };

type FakePing = {
  claude_session_id: string; user_id: string; workspace_id: string; repo: string; work_kind: string | null;
  work_number: number | null; dossier_id: string | null; seen_at: string; ended_at: string | null;
};

const refused = (code: string, message: string): Result => ({ data: null, error: { code, message } });

/**
 * `accounts`: token → account. `orgs`: workspace id → the GitHub org it owns. `now`: the clock, in ms.
 */
export function fakeWorking(accounts: Record<string, FakeAccount>, orgs: Record<string, string>, now: () => number) {
  const tables = { working_pings: [] as FakePing[], dossiers: [] as FakeDossierKey[] };
  const calls: Array<{ fn: string; args: Row }> = [];

  // repo_workspace(): the member workspace owning the repository's organisation; none when another
  // workspace owns it; else the one joined first.
  const workspaceFor = (account: FakeAccount, repo: string): string | null => {
    const owner = repo.split('/')[0];
    const owning = Object.keys(orgs).filter((w) => orgs[w].toLowerCase() === owner);
    if (owning.length > 0) return account.workspaces.find((w) => owning.includes(w)) ?? null;
    return account.workspaces[0] ?? null;
  };

  // The refusal for a caller no workspace places the repository in.
  const noWorkspace = (me: FakeAccount, repo: string): Result =>
    me.workspaces.length === 0 && !Object.values(orgs).some((org) => org.toLowerCase() === repo.split('/')[0])
      ? refused('42501', `no workspace owns ${repo} yet — install the Omni App`)
      : refused('42501', `you are not a member of the workspace which owns ${repo}`);

  // The dossier a ping's work resolves to in the workspace, if any.
  type Work = { repo: string; kind: string | null; number: number | null; draft: string | null };
  const dossierFor = (workspace: string, { repo, kind, number, draft }: Work) => {
    if (kind === 'draft') return tables.dossiers.find((d) => d.id === draft && d.workspace_id === workspace);
    if (kind === null) return undefined;
    return tables.dossiers.find((d) => d.workspace_id === workspace && d.home_repo === repo && d.kind === kind && d.prd === number);
  };

  const workOf = (args: Row): Work => ({
    repo: String(args.p_repo ?? '').trim().toLowerCase(),
    kind: (args.p_work_kind ?? null) as string | null,
    number: (args.p_work_number ?? null) as number | null,
    draft: (args.p_draft ?? null) as string | null,
  });

  function workingPing(me: FakeAccount | null, args: Row): Result {
    calls.push({ fn: 'working_ping', args });
    if (!me) return refused('42501', 'Sign in first.');
    const session = args.p_claude_session_id as string;
    const work = workOf(args);
    const { repo, kind, number } = work;
    const ended = Boolean(args.p_ended);
    const existing = tables.working_pings.find((p) => p.claude_session_id === session);
    if (existing && existing.user_id !== me.id) return refused('42501', 'This Claude session is another account\'s.');
    const workspace = workspaceFor(me, repo);
    if (!workspace) return noWorkspace(me, repo);
    const dossierId = dossierFor(workspace, work)?.id ?? null;
    const at = new Date(now()).toISOString();
    save(existing, {
      claude_session_id: session, user_id: me.id, workspace_id: workspace, repo, work_kind: kind, work_number: number,
      dossier_id: dossierId, seen_at: at, ended_at: ended ? at : null,
    });
    return { data: null, error: null };
  }

  // An ended ping stamps the end and keeps the work; any other sets the work and clears the end.
  function save(existing: FakePing | undefined, ping: FakePing) {
    if (!existing) {
      tables.working_pings.push(ping);
    } else if (ping.ended_at !== null) {
      Object.assign(existing, { seen_at: ping.seen_at, ended_at: ping.ended_at });
    } else {
      const { workspace_id, repo, work_kind, work_number, dossier_id, seen_at } = ping;
      Object.assign(existing, { workspace_id, repo, work_kind, work_number, dossier_id, seen_at, ended_at: null });
    }
  }

  /** A read of working_pings as `me`, under the policy: only rows of their workspaces. */
  function query(me: FakeAccount | null) {
    let rows: FakePing[] = me ? tables.working_pings.filter((p) => me.workspaces.includes(p.workspace_id)) : [];
    const builder = {
      select: () => builder,
      eq: (column: keyof FakePing, value: unknown) => { rows = rows.filter((r) => r[column] === value); return builder; },
      is: (column: keyof FakePing, value: null) => { rows = rows.filter((r) => r[column] === value); return builder; },
      order: (column: keyof FakePing, { ascending }: { ascending: boolean }) => {
        rows = [...rows].sort((a, b) => String(a[column]).localeCompare(String(b[column])) * (ascending ? 1 : -1));
        return builder;
      },
      limit: (n: number) => { rows = rows.slice(0, n); return builder; },
      maybeSingle: async (): Promise<Result> => ({ data: rows[0] ?? null, error: null }),
      then: (resolve: (r: Result) => unknown) => resolve({ data: rows.map((r) => ({ ...r })), error: null }),
    };
    return builder;
  }

  function client(token: string) {
    const me = accounts[token] ?? null;
    return {
      auth: {
        async getUser(jwt: string) {
          const account = accounts[jwt];
          return account ? { data: { user: { id: account.id, email: account.email } }, error: null } : { data: { user: null }, error: { status: 401 } };
        },
      },
      async rpc(fn: string, args: Row): Promise<Result> {
        if (fn === 'working_ping') return workingPing(me, args);
        return refused('42883', `no function ${fn}`);
      },
      from(table: string) {
        if (table !== 'working_pings') throw new Error(`the fake reads no ${table}`);
        return query(me);
      },
    };
  }

  return { tables, calls, client };
}
