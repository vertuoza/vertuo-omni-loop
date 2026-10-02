// The proof runs of a PRD (PRD 798, supabase/migrations/20261023090000_proof_runs.sql): what
// /omni:prove recorded against a ready feature PR's preview — one row per run in `proof_runs`, its clips,
// scripts and GIF in the private `proof-videos` bucket under `<dossier id>/<run id>/<name>`.
//
// Two small ports, so the API's rules are tested on a fake (./store.fake.ts):
// - `ProofStore`, as the caller (their access token): finds the dossier they may read, signs upload
//   links, lists what a run's folder holds, and registers the run through proof_run_add(). The bucket's
//   rules and the function's checks decide who may do what: members of the dossier's workspace only.
// - `ProofPublic`, as the service role: the one read without sign-in, the GIF's stable link (GitHub's
//   image proxy cannot sign in). It reads only a run's GIF path and signs a 5-minute link to it.
import type { SupabaseClient } from '@supabase/supabase-js';
import { listOf } from '../data/unparsed';
import { dossierReader } from '../dossier/store';

/** The bucket, private (the migration's). */
const PROOF_BUCKET = 'proof-videos';
/** The largest file the bucket takes: 50 MB. */
export const PROOF_FILE_MAX_BYTES = 50 * 1024 * 1024;
/** The most files one run uploads. */
export const PROOF_FILES_MAX = 25;
/** The most criteria one run films (the spec's first 10). */
export const PROOF_CRITERIA_MAX = 10;
/** The name the GIF excerpt is uploaded under, in the run's folder. */
export const PROOF_GIF_NAME = 'preview.gif';
/** How long the GIF's signed link lives: the stable link redirects to a fresh one each time. */
export const GIF_LINK_SECONDS = 5 * 60;

/** The types the bucket takes, and the extensions each is named with. */
export const PROOF_TYPES = {
  'video/webm': ['webm'],
  'image/gif': ['gif'],
  'text/plain': ['ts', 'txt'],
} as const satisfies Record<string, readonly string[]>;
export type ProofType = keyof typeof PROOF_TYPES;
export const isProofType = (value: unknown): value is ProofType => typeof value === 'string' && Object.hasOwn(PROOF_TYPES, value);

/** A file's name inside its run's folder: no folder, no leading dot, at most 128 characters. */
export const PROOF_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export const VERDICTS = ['pass', 'fail', 'unfilmable'] as const;
export type Verdict = (typeof VERDICTS)[number];
export const isVerdict = (value: unknown): value is Verdict => VERDICTS.some((verdict) => verdict === value);

/** One criterion of a run: its text, verdict, the note (a fail's first error line, an unfilmable's
 * reason), and the names of its clip and script in the run's folder. */
export type ProofCriterion = { text: string; verdict: Verdict; note?: string; video?: string; script?: string };

/** A run as it is registered. */
export type ProofRunNew = {
  id: string;
  dossierId: string;
  commit: string;
  url: string;
  criteria: ProofCriterion[];
  /** The GIF's name in the run's folder, or null when the run has none. */
  gif: string | null;
};

/** A run as a member reads it (s4's Proof tab). */
export type ProofRunRow = {
  id: string;
  dossier_id: string;
  commit_sha: string;
  url: string;
  criteria: ProofCriterion[];
  gif: string | null;
  created_by: string | null;
  created_at: string;
};

const PROOF_RUN_COLUMNS = 'id, dossier_id, commit_sha, url, criteria, gif, created_by, created_at';

/** The path of a run's file in the bucket. */
export const proofPath = (dossierId: string, runId: string, name: string) => `${dossierId}/${runId}/${name}`;

/**
 * The database refused or failed; `code` is Postgres's: 42501 the caller may not write to the dossier,
 * P0002 no such dossier for them, 22023 a malformed run or a file it did not upload, 23505 a run
 * registered already.
 */
export class ProofStoreError extends Error {
  readonly code: string | undefined;
  readonly reason: string;
  constructor(what: string, code: string | undefined, reason: string) {
    super(`${what}: ${reason}`);
    this.code = code;
    this.reason = reason;
  }
}

/** An upload link for one file: `url` takes one PUT of its bytes. */
export type SignedUpload = { name: string; path: string; url: string };

export type ProofStore = {
  /** The id of PRD `prd`'s dossier in `repo` the caller may read, or null. */
  dossierOf(repo: string, prd: number): Promise<string | null>;
  /** One signed upload link per name, under the run's folder, in order. */
  signUploads(dossierId: string, runId: string, names: string[]): Promise<SignedUpload[]>;
  /** The names of the files the run's folder holds. */
  uploaded(dossierId: string, runId: string): Promise<string[]>;
  /** Stores the run. */
  register(run: ProofRunNew): Promise<void>;
  /** The dossier's runs, newest first. */
  runs(dossierId: string): Promise<ProofRunRow[]>;
  /** A signed link per path, valid `seconds`, in order; null for one that could not be made. */
  links(paths: string[], seconds: number): Promise<Array<string | null>>;
};

export type ProofPublic = {
  /** The GIF's path in the bucket, or null for no such run or a run without a GIF. */
  gifPath(runId: string): Promise<string | null>;
  /** A signed link to `path`, valid `seconds`, or null when it could not be made. */
  link(path: string, seconds: number): Promise<string | null>;
};

type Outcome<T> = { data: T | null; error: { code?: string; message: string } | null };

function settle<T>(what: string, { data, error }: Outcome<T>): T | null {
  if (error) throw new ProofStoreError(what, error.code, error.message);
  return data;
}

async function signedLinks(db: Pick<SupabaseClient, 'storage'>, paths: string[], seconds: number): Promise<Array<string | null>> {
  if (paths.length === 0) return [];
  try {
    const { data, error } = await db.storage.from(PROOF_BUCKET).createSignedUrls(paths, seconds);
    if (error) return paths.map(() => null);
    const links = listOf(data);
    return paths.map((path, i) => {
      const signed = links.find((d) => d.path === path) ?? links[i];
      return signed && !signed.error && signed.signedUrl ? signed.signedUrl : null;
    });
  } catch {
    return paths.map(() => null);
  }
}

/** The proof store as the caller: row-level security and the bucket's rules decide. */
export function proofStore(db: Pick<SupabaseClient, 'rpc' | 'from' | 'storage'>): ProofStore {
  return {
    dossierOf: (repo, prd) => dossierReader(db).numbered(repo, prd, 'prd'),

    async signUploads(dossierId, runId, names) {
      const bucket = db.storage.from(PROOF_BUCKET);
      return Promise.all(names.map(async (name) => {
        const path = proofPath(dossierId, runId, name);
        const { data, error } = await bucket.createSignedUploadUrl(path);
        // The link as it came: nothing parsed it, so an answer with none is refused.
        const link: { signedUrl: string } | null = data;
        if (error || !link) throw new ProofStoreError('sign the upload', '42501', error?.message ?? 'no link came back');
        return { name, path, url: link.signedUrl };
      }));
    },

    async uploaded(dossierId, runId) {
      const { data, error } = await db.storage.from(PROOF_BUCKET).list(`${dossierId}/${runId}`, { limit: 100 });
      if (error) throw new ProofStoreError('list the run', undefined, error.message);
      return listOf(data).map((file) => file.name);
    },

    async register(run) {
      settle('register the run', await db.rpc('proof_run_add', {
        p_dossier: run.dossierId, p_run: run.id, p_commit: run.commit, p_url: run.url, p_criteria: run.criteria, p_gif: run.gif,
      }));
    },

    async runs(dossierId) {
      return settle<ProofRunRow[]>('read the runs', await db.from('proof_runs').select(PROOF_RUN_COLUMNS)
        .eq('dossier_id', dossierId).order('created_at', { ascending: false }).order('id', { ascending: true })) ?? [];
    },

    links: (paths, seconds) => signedLinks(db, paths, seconds),
  };
}

/** The GIF's store as the service role: it reads a run's GIF path only. */
export function proofPublic(db: Pick<SupabaseClient, 'from' | 'storage'>): ProofPublic {
  return {
    async gifPath(runId) {
      const row = settle<{ dossier_id: string; gif: string | null }>('read the run', await db.from('proof_runs')
        .select('dossier_id, gif').eq('id', runId).maybeSingle());
      return row?.gif ? proofPath(row.dossier_id, runId, row.gif) : null;
    },
    async link(path, seconds) {
      return (await signedLinks(db, [path], seconds))[0] ?? null;
    },
  };
}
