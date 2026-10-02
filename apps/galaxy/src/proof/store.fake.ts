// The proof store in memory, for the API's tests: the dossiers a test seeds (each readable by the
// members of its workspace), the bucket's files, and proof_run_add() of
// supabase/migrations/20261023090000_proof_runs.sql written here as the migration writes it — the
// caller must read the dossier (P0002), the run must be new (23505), each verdict one of the three and
// each file named uploaded to the run's folder (22023). Uploads land only in a folder of a dossier the
// caller reads and of a run not yet registered, as the bucket's insert rule says. That the database
// holds those rules is proved against a real database, not here.
import { proofPath, ProofStoreError, type ProofPublic, type ProofRunNew, type ProofRunRow, type ProofStore, isVerdict, PROOF_FILE_NAME } from './store';

export type FakeProofDossier = { id: string; workspace: string; repo: string; prd: number };

export class FakeProofWorld {
  dossiers: FakeProofDossier[] = [];
  /** path → true, for every file in the bucket. */
  files = new Set<string>();
  runs: Array<ProofRunRow & { workspace: string }> = [];
  /** Tokens the Auth server knows: token → account id and its workspaces. */
  accounts = new Map<string, { id: string; workspaces: string[] }>();
  private clock = Date.parse('2026-09-30T10:00:00Z');

  account(token: string, id: string, workspaces: string[]) {
    this.accounts.set(token, { id, workspaces });
  }

  dossier(d: FakeProofDossier) {
    this.dossiers.push(d);
    return d;
  }

  /** What a PUT to a signed link would leave behind. */
  put(path: string) {
    this.files.add(path);
  }

  private reads(workspaces: string[], dossierId: string) {
    return this.dossiers.find((d) => d.id === dossierId && workspaces.includes(d.workspace)) ?? null;
  }

  /** The Auth server's check and the store, as the account behind `token`. */
  client(token: string) {
    const world = this;
    const who = this.accounts.get(token);
    const workspaces = who?.workspaces ?? [];
    const store: ProofStore = {
      async dossierOf(repo, prd) {
        return world.dossiers.find((d) => d.repo === repo.toLowerCase() && d.prd === prd && workspaces.includes(d.workspace))?.id ?? null;
      },
      async signUploads(dossierId, runId, names) {
        if (!world.reads(workspaces, dossierId) || world.runs.some((r) => r.id === runId)) throw new Error('new row violates row-level security policy');
        return names.map((name) => {
          const path = proofPath(dossierId, runId, name);
          return { name, path, url: `https://storage.test/upload/${path}?token=t` };
        });
      },
      async uploaded(dossierId, runId) {
        if (!world.reads(workspaces, dossierId)) return [];
        const prefix = `${dossierId}/${runId}/`;
        return [...world.files].filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length));
      },
      async register(run: ProofRunNew) {
        if (!who) throw new ProofStoreError('register the run', '42501', 'Sign in first.');
        const dossier = world.reads(workspaces, run.dossierId);
        if (!dossier) throw new ProofStoreError('register the run', 'P0002', 'No such dossier.');
        if (world.runs.some((r) => r.id === run.id)) throw new ProofStoreError('register the run', '23505', 'This run is registered already.');
        for (const c of run.criteria) {
          if (!isVerdict(c.verdict)) throw new ProofStoreError('register the run', '22023', `A verdict is pass, fail or unfilmable, not ${String(c.verdict)}.`);
        }
        const named = [...run.criteria.flatMap((c) => [c.video, c.script]), run.gif].filter((n): n is string => typeof n === 'string');
        for (const name of named) {
          if (!PROOF_FILE_NAME.test(name) || !world.files.has(proofPath(run.dossierId, run.id, name))) {
            throw new ProofStoreError('register the run', '22023', `${name} was not uploaded to this run.`);
          }
        }
        world.clock += 1000;
        world.runs.push({
          id: run.id, dossier_id: run.dossierId, commit_sha: run.commit, url: run.url, criteria: run.criteria, gif: run.gif,
          created_by: who.id, created_at: new Date(world.clock).toISOString(), workspace: dossier.workspace,
        });
      },
      async runs(dossierId) {
        return world.runs.filter((r) => r.dossier_id === dossierId && workspaces.includes(r.workspace))
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .map(({ workspace: _, ...row }) => row);
      },
      async links(paths, seconds) {
        return paths.map((p) => (world.files.has(p) && world.reads(workspaces, p.split('/')[0]!) ? `https://storage.test/sign/${p}?ttl=${seconds}` : null));
      },
    };
    return {
      auth: {
        async getUser(jwt: string) {
          const account = world.accounts.get(jwt);
          return account ? { data: { user: { id: account.id } }, error: null } : { data: { user: null }, error: { status: 401, message: 'invalid' } };
        },
      },
      proofs: store,
    };
  }

  /** The service role's view: every run, every file. */
  public(): ProofPublic {
    const world = this;
    return {
      async gifPath(runId) {
        const run = world.runs.find((r) => r.id === runId);
        return run?.gif ? proofPath(run.dossier_id, run.id, run.gif) : null;
      },
      async link(path, seconds) {
        return world.files.has(path) ? `https://storage.test/sign/${path}?ttl=${seconds}` : null;
      },
    };
  }
}
