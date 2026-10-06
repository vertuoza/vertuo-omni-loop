// The pitch store in memory, for the API's tests: the dossiers a test seeds (each readable by the
// members of its workspace, each shipped or not), the bucket's files, and pitch_run_add() of
// supabase/migrations/20261101100000_pitch_runs.sql written here as the migration writes it — the
// caller must read the dossier (P0002), its PRD must be shipped (55000), the run must be new (23505),
// and each of the five files uploaded to the run's folder (22023). Uploads land only in a folder of a
// shipped dossier the caller reads and of a run not yet registered, as the bucket's insert rule says.
// That the database holds those rules is proved against a real database (supabase/checks/pitch.sql).
import {
  isAudience, isLook, pitchPath, PITCH_FILE_NAMES, PitchStoreError, type PitchPublic, type PitchRunNew, type PitchRunRow, type PitchStore,
} from './store';

export type FakePitchDossier = { id: string; workspace: string; repo: string; prd: number; shipped: boolean };

export class FakePitchWorld {
  dossiers: FakePitchDossier[] = [];
  files = new Set<string>();
  runs: Array<PitchRunRow & { workspace: string }> = [];
  accounts = new Map<string, { id: string; workspaces: string[] }>();
  private clock = Date.parse('2026-10-01T10:00:00Z');

  account(token: string, id: string, workspaces: string[]) {
    this.accounts.set(token, { id, workspaces });
  }

  dossier(d: FakePitchDossier) {
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

  client(token: string) {
    const world = this;
    const who = this.accounts.get(token);
    const workspaces = who?.workspaces ?? [];
    const fail = (code: string, reason: string) => new PitchStoreError('register the pitch', code, reason);
    const store: PitchStore = {
      async dossierOf(repo, prd) {
        return world.dossiers.find((d) => d.repo === repo.toLowerCase() && d.prd === prd && workspaces.includes(d.workspace))?.id ?? null;
      },
      async shipped(dossierId) {
        return world.reads(workspaces, dossierId)?.shipped ?? false;
      },
      async signUploads(dossierId, runId, names) {
        const dossier = world.reads(workspaces, dossierId);
        if (!dossier?.shipped || world.runs.some((r) => r.id === runId)) throw new Error('new row violates row-level security policy');
        return names.map((name) => {
          const path = pitchPath(dossierId, runId, name);
          return { name, path, url: `https://storage.test/upload/${path}?token=t` };
        });
      },
      async uploaded(dossierId, runId) {
        if (!world.reads(workspaces, dossierId)) return [];
        const prefix = `${dossierId}/${runId}/`;
        return [...world.files].filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length));
      },
      async register(run: PitchRunNew) {
        if (!who) throw fail('42501', 'Sign in first.');
        const dossier = world.reads(workspaces, run.dossierId);
        if (!dossier) throw fail('P0002', 'No such dossier.');
        if (!dossier.shipped) throw fail('55000', 'This PRD is not shipped: a pitch is for shipped PRDs.');
        if (!isAudience(run.audience)) throw fail('22023', 'A pitch is for customers or inside.');
        if (!isLook(run.look)) throw fail('22023', 'Look: arcade or keynote.');
        for (const name of PITCH_FILE_NAMES) {
          if (!world.files.has(pitchPath(run.dossierId, run.id, name))) throw fail('22023', `${name} was not uploaded to this run.`);
        }
        if (world.runs.some((r) => r.id === run.id)) throw fail('23505', 'This run is registered already.');
        world.clock += 1000;
        world.runs.push({
          id: run.id, dossier_id: run.dossierId, audience: run.audience, look: run.look, commit_sha: run.commit,
          hook: run.hook, benefit: run.benefit, kicker: run.kicker, closing: run.closing, files: [...PITCH_FILE_NAMES],
          created_by: who.id, created_at: new Date(world.clock).toISOString(), workspace: dossier.workspace,
        });
      },
      async runs(dossierId) {
        return world.runs.filter((r) => r.dossier_id === dossierId && workspaces.includes(r.workspace))
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .map(({ workspace: _, ...row }) => row);
      },
      async links(paths, seconds) {
        return paths.map((p) => (world.files.has(p) && world.reads(workspaces, p.split('/')[0]) ? `https://storage.test/sign/${p}?ttl=${seconds}` : null));
      },
    };
    return {
      auth: {
        async getUser(jwt: string) {
          const account = world.accounts.get(jwt);
          return account ? { data: { user: { id: account.id } }, error: null } : { data: { user: null }, error: { status: 401, message: 'invalid' } };
        },
      },
      pitches: store,
    };
  }

  /** The service role's view: every run, every file. */
  public(): PitchPublic {
    const world = this;
    return {
      async gifPath(runId) {
        const run = world.runs.find((r) => r.id === runId);
        return run ? pitchPath(run.dossier_id, run.id, 'pitch.gif') : null;
      },
      async link(path, seconds) {
        return world.files.has(path) ? `https://storage.test/sign/${path}?ttl=${seconds}` : null;
      },
    };
  }
}
