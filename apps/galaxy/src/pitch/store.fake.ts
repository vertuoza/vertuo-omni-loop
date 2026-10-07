// The pitch store in memory, for the API's tests: the dossiers a test seeds (each readable by the
// members of its workspace, each shipped or not), the bucket's files, and pitch_run_add() of
// supabase/migrations/20261101100000_pitch_runs.sql written here as the migration writes it — the
// caller must read the dossier (P0002), its PRD must be shipped (55000), the run must be new (23505),
// and each of the five files uploaded to the run's folder (22023). Uploads land only in a folder of a
// shipped dossier the caller reads and of a run not yet registered, as the bucket's insert rule says.
// That the database holds those rules is proved against a real database (supabase/checks/pitch.sql).
import { firstPart } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import {
  isAudience, isLook, pitchPath, PITCH_FILE_NAMES, PitchStoreError, type PitchPublic, type PitchRunNew, type PitchRunRow, type PitchStore,
} from './store';
import { settled } from '../stages/settled';

export type FakePitchDossier = { id: string; workspace: string; repo: string; prd: PrdNumber; shipped: boolean };

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
    const who = this.accounts.get(token);
    const workspaces = who?.workspaces ?? [];
    const fail = (code: string, reason: string) => new PitchStoreError('register the pitch', code, reason);
    const store: PitchStore = {
      dossierOf: (repo, prd) => settled(() => this.dossiers.find((d) => d.repo === repo.toLowerCase() && d.prd === prd && workspaces.includes(d.workspace))?.id ?? null),
      shipped: (dossierId) => settled(() => this.reads(workspaces, dossierId)?.shipped ?? false),
      signUploads: (dossierId, runId, names) => settled(() => {
        const dossier = this.reads(workspaces, dossierId);
        if (!dossier?.shipped || this.runs.some((r) => r.id === runId)) throw new Error('new row violates row-level security policy');
        return names.map((name) => {
          const path = pitchPath(dossierId, runId, name);
          return { name, path, url: `https://storage.test/upload/${path}?token=t` };
        });
      }),
      uploaded: (dossierId, runId) => settled(() => {
        if (!this.reads(workspaces, dossierId)) return [];
        const prefix = `${dossierId}/${runId}/`;
        return [...this.files].filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length));
      }),
      register: (run: PitchRunNew) => settled(() => {
        if (!who) throw fail('42501', 'Sign in first.');
        const dossier = this.reads(workspaces, run.dossierId);
        if (!dossier) throw fail('P0002', 'No such dossier.');
        if (!dossier.shipped) throw fail('55000', 'This PRD is not shipped: a pitch is for shipped PRDs.');
        if (!isAudience(run.audience)) throw fail('22023', 'A pitch is for customers or inside.');
        if (!isLook(run.look)) throw fail('22023', 'Look: arcade or keynote.');
        for (const name of PITCH_FILE_NAMES) {
          if (!this.files.has(pitchPath(run.dossierId, run.id, name))) throw fail('22023', `${name} was not uploaded to this run.`);
        }
        if (this.runs.some((r) => r.id === run.id)) throw fail('23505', 'This run is registered already.');
        this.clock += 1000;
        this.runs.push({
          id: run.id, dossier_id: run.dossierId, audience: run.audience, look: run.look, commit_sha: run.commit,
          hook: run.hook, benefit: run.benefit, kicker: run.kicker, closing: run.closing, files: [...PITCH_FILE_NAMES],
          created_by: who.id, created_at: new Date(this.clock).toISOString(), workspace: dossier.workspace,
        });
      }),
      runs: (dossierId) => settled(() => {
        return this.runs.filter((r) => r.dossier_id === dossierId && workspaces.includes(r.workspace))
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .map((r): PitchRunRow => ({
            id: r.id, dossier_id: r.dossier_id, audience: r.audience, look: r.look, commit_sha: r.commit_sha,
            hook: r.hook, benefit: r.benefit, kicker: r.kicker, closing: r.closing, files: r.files,
            created_by: r.created_by, created_at: r.created_at,
          }));
      }),
      links: (paths, seconds) => settled(() => {
        return paths.map((p) => (this.files.has(p) && this.reads(workspaces, firstPart(p, '/')) ? `https://storage.test/sign/${p}?ttl=${seconds}` : null));
      }),
    };
    return {
      auth: {
        getUser: (jwt: string) => settled(() => {
          const account = this.accounts.get(jwt);
          return account ? { data: { user: { id: account.id } }, error: null } : { data: { user: null }, error: { status: 401, message: 'invalid' } };
        }),
      },
      pitches: store,
    };
  }

  /** The service role's view: every run, every file. */
  public(): PitchPublic {
    return {
      gifPath: (runId) => settled(() => {
        const run = this.runs.find((r) => r.id === runId);
        return run ? pitchPath(run.dossier_id, run.id, 'pitch.gif') : null;
      }),
      link: (path, seconds) => settled(() => (this.files.has(path) ? `https://storage.test/sign/${path}?ttl=${seconds}` : null)),
    };
  }
}
