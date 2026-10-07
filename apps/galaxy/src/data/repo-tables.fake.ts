// What the stubbed Supabase clients of the loops' and the roadmaps' tests share
// (src/loop/store.fake.ts, src/roadmap/store.fake.ts): the accounts, the clock and the ids, the
// Auth server's token check, repo_workspace() as the fake writes it, one function called by rpc(),
// and a read of one in-memory table under the policies.

type Row = Record<string, unknown>;
type Failure = { code?: string; message: string };

/** What the fake's rpc() and reads answer. */
export type FakeResult = { data: unknown; error: Failure | null };

/** An account, and the workspaces it belongs to in the order it joined them. */
export type FakeAccount = { id: string; email: string | null; workspaces: string[] };

/** The Auth server's answer for a token: its account, or a 401 for one it does not know. */
const verdictOn = (account: FakeAccount | undefined) =>
  account === undefined ? { data: { user: null }, error: { status: 401 } } : { data: { user: { id: account.id, email: account.email } }, error: null };

/** A sent value read as text, a list or an object; null, empty or `{}` when it is none. */
export const textOf = (value: unknown) => (typeof value === 'string' ? value : null);
export const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
export const objectOf = (value: unknown): Row => (typeof value === 'object' && value !== null ? { ...value } : {});

/** The database's refusal, with its code. */
export const refused = (code: string, message: string): FakeResult => ({ data: null, error: { code, message } });

/** The calls rpc() received, the fake's clock as an ISO moment, and a fresh uuid at each call. */
export function fakeRecorder(now: () => number) {
  const calls: Array<{ fn: string; args: Row }> = [];
  let ids = 0;
  const at = () => new Date(now()).toISOString();
  const newId = () => `00000000-0000-4000-8000-${String(++ids).padStart(12, '0')}`;
  return { calls, at, newId };
}

/**
 * repo_workspace(): the caller's workspace owning the repository's organisation (the body's `repo`,
 * in lower case); when no workspace owns it, the one they joined first; otherwise the database's
 * refusal. `orgOf` names the GitHub org each of `workspaces` owns.
 */
export function placeRepo(
  me: FakeAccount,
  sentRepo: unknown,
  workspaces: readonly string[],
  orgOf: (workspace: string) => string | undefined,
): { repo: string; workspace: string } | { refusal: FakeResult } {
  const repo = (textOf(sentRepo) ?? '').trim().toLowerCase();
  const org = repo.split('/')[0];
  const owners = workspaces.filter((workspace) => orgOf(workspace)?.toLowerCase() === org);
  const workspace = owners.length === 0 ? me.workspaces[0] : me.workspaces.find((candidate) => owners.includes(candidate));
  if (workspace !== undefined) return { repo, workspace };
  const reason = owners.length === 0 ? `no workspace owns ${repo} yet — install the Omni App` : `you are not a member of the workspace which owns ${repo}`;
  return { refusal: refused('42501', reason) };
}

/** A read of one table as the caller, under the policies: the rows `visible` lets through. */
export function tableQuery<T extends Row>(source: T[], visible: (row: T) => boolean) {
  let rows = source.filter(visible);
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => { rows = rows.filter((r) => r[column] === value); return builder; },
    order: (column: string, { ascending }: { ascending: boolean }) => {
      rows = [...rows].sort((a, b) => {
        const [x, y] = [a[column], b[column]];
        const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
        return ascending ? order : -order;
      });
      return builder;
    },
    maybeSingle: (): Promise<FakeResult> => Promise.resolve({ data: rows[0] ? structuredClone(rows[0]) : null, error: null }),
    then: (resolve: (r: FakeResult) => unknown) => resolve({ data: rows.map((r) => structuredClone(r)), error: null }),
  };
  return builder;
}

/**
 * A client acting as `token`: the Auth server's check, rpc() answering the one function `fn` with
 * `call` (any other is 42883), and the reads `reads` builds from whether a workspace is the caller's.
 */
export function fakeClient<Reads>(
  accounts: Record<string, FakeAccount>,
  token: string,
  { fn, call, reads }: { fn: string; call: (me: FakeAccount | null, args: Row) => FakeResult; reads: (mine: (workspace: string) => boolean) => Reads },
) {
  const me = accounts[token] ?? null;
  const mine = (workspace: string) => me !== null && me.workspaces.includes(workspace);
  return {
    auth: { getUser: (jwt: string) => Promise.resolve(verdictOn(accounts[jwt])) },
    rpc(name: string, args: Row): Promise<FakeResult> {
      return Promise.resolve(name === fn ? call(me, args) : refused('42883', `no function ${name}`));
    },
    from: reads(mine),
  };
}
