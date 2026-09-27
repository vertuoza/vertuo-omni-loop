// A stubbed Supabase client for the outbox route's tests: the dossiers and their outboxes in memory,
// and dossier_outbox_put() of supabase/migrations/20260929090000_outbox_answers.sql written here as the
// migration writes it — the dossier found by its key in the workspace whose github_org owns the
// repository (created, titled after the PRD, when there is none; P0002 when no workspace owns the
// organisation), the repository kept in lower case, and an evaluation older than the stored one
// changing nothing. That the database holds those rules, and that nobody writes the table but through
// the function, is proved by supabase/checks/outbox_answers.sql, not here.

type Failure = { code?: string; message: string };
type Result = { data: unknown; error: Failure | null };

export type FakeWorkspace = { id: string; github_org: string | null };
export type FakeDossier = { id: string; workspace_id: string; home_repo: string; prd: number | null; title: string };
export type FakeOutbox = {
  dossier_id: string; pr_number: number; pr_url: string; head_sha: string; state: string;
  outbox: unknown; evaluated_at: string;
};

const REPO = /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/;
const refuse = (code: string, message: string): Result => ({ data: null, error: { code, message } });

export function fakeOutboxDb(workspaces: FakeWorkspace[], dossiers: FakeDossier[] = []) {
  const tables = { workspaces, dossiers: [...dossiers], dossier_outboxes: [] as FakeOutbox[] };
  const state: { fail: Failure | null; calls: Array<{ fn: string; args: Record<string, unknown> }> } = { fail: null, calls: [] };
  let next = 1;

  function put(args: Record<string, unknown>): Result {
    const repo = String(args.p_repo ?? '').trim().toLowerCase();
    if (!REPO.test(repo)) return refuse('22023', 'An outbox names its repository as owner/name.');
    if (!['open', 'merged', 'closed'].includes(String(args.p_state))) return refuse('22023', 'A pull request is open, merged or closed.');
    const org = repo.split('/')[0];
    const place = tables.workspaces.find((w) => w.github_org !== null && w.github_org.toLowerCase() === org);
    if (!place) return refuse('P0002', `No workspace owns ${org}.`);

    let dossier = tables.dossiers.find((d) => d.workspace_id === place.id && d.home_repo === repo && d.prd === args.p_prd);
    if (!dossier) {
      dossier = { id: `00000000-0000-4000-8000-${String(next++).padStart(12, '0')}`, workspace_id: place.id, home_repo: repo, prd: args.p_prd as number, title: `PRD ${args.p_prd}` };
      tables.dossiers.push(dossier);
    }
    const stored = tables.dossier_outboxes.find((o) => o.dossier_id === dossier.id);
    const evaluatedAt = String(args.p_evaluated_at);
    if (stored && Date.parse(stored.evaluated_at) > Date.parse(evaluatedAt)) return { data: { id: dossier.id, stale: true }, error: null };

    const row: FakeOutbox = {
      dossier_id: dossier.id, pr_number: args.p_pr_number as number, pr_url: String(args.p_pr_url), head_sha: String(args.p_head_sha),
      state: String(args.p_state), outbox: structuredClone(args.p_outbox), evaluated_at: evaluatedAt,
    };
    if (stored) Object.assign(stored, row);
    else tables.dossier_outboxes.push(row);
    return { data: { id: dossier.id, stale: false }, error: null };
  }

  const client = {
    async rpc(fn: string, args: Record<string, unknown>): Promise<Result> {
      state.calls.push({ fn, args });
      if (state.fail) return { data: null, error: state.fail };
      if (fn === 'dossier_outbox_put') return put(args);
      return refuse('42883', `function ${fn} does not exist`);
    },
  };
  return { client, tables, state };
}
