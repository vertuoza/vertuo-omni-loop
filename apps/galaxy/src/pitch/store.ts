// The pitches of a shipped PRD (PRD 859 s3, supabase/migrations/20261101100000_pitch_runs.sql): what
// /omni:pitch made on the person's computer — one row per pitch in `pitch_runs`, its five files in the
// private `pitches` bucket under `<dossier id>/<run id>/<name>`.
//
// Two small ports, so the API's rules are tested on a fake (./store.fake.ts):
// - `PitchStore`, as the caller (their access token): finds the dossier they may read, says whether its
//   PRD is shipped, signs upload links, lists what a run's folder holds, and registers the run through
//   pitch_run_add(). The bucket's rules and the function's checks decide who may do what: members of the
//   dossier's workspace, for a PRD at shipped or retro.
// - `PitchPublic`, as the service role: the one read without sign-in, the GIF's stable link. It reads
//   only a run's dossier and files and signs a 5-minute link to its GIF.
import type { SupabaseClient } from '@supabase/supabase-js';
import { dossierReader } from '../dossier/store';

/** The bucket, private (the migration's). */
const PITCH_BUCKET = 'pitches';
/** The largest file the bucket takes: 50 MB. */
export const PITCH_FILE_MAX_BYTES = 50 * 1024 * 1024;
/** How long the GIF's signed link lives: the stable link redirects to a fresh one each time. */
export const PITCH_GIF_LINK_SECONDS = 5 * 60;

/** The five files of every pitch, by name, in the order the Pitch tab lists their downloads, with the
 * type each is uploaded as. */
export const PITCH_FILES = {
  'slide.png': 'image/png',
  'slide-square.png': 'image/png',
  'pitch.mp4': 'video/mp4',
  'pitch-square.mp4': 'video/mp4',
  'pitch.gif': 'image/gif',
} as const;
export type PitchFile = keyof typeof PITCH_FILES;
export const PITCH_FILE_NAMES = Object.keys(PITCH_FILES) as PitchFile[];
export const isPitchFile = (value: unknown): value is PitchFile => typeof value === 'string' && Object.hasOwn(PITCH_FILES, value);
/** The GIF the stable link serves. */
export const PITCH_GIF: PitchFile = 'pitch.gif';

export const AUDIENCES = ['customers', 'inside'] as const;
export type Audience = (typeof AUDIENCES)[number];
export const isAudience = (value: unknown): value is Audience => AUDIENCES.includes(value as Audience);

const LOOKS = ['arcade', 'keynote'] as const;
export type Look = (typeof LOOKS)[number];
export const isLook = (value: unknown): value is Look => LOOKS.includes(value as Look);

/** The longest each of a pitch's words may be, as the table's checks say. */
export const WORD_MAX = { hook: 200, benefit: 400, kicker: 100, closing: 300 } as const;
export type PitchWords = Record<keyof typeof WORD_MAX, string>;

/** A pitch as it is registered. */
export type PitchRunNew = PitchWords & {
  id: string;
  dossierId: string;
  audience: Audience;
  look: Look;
  commit: string;
};

/** A pitch as a member reads it. */
export type PitchRunRow = {
  id: string;
  dossier_id: string;
  audience: Audience;
  look: Look;
  commit_sha: string;
  hook: string;
  benefit: string;
  kicker: string;
  closing: string;
  files: string[];
  created_by: string | null;
  created_at: string;
};

const PITCH_RUN_COLUMNS = 'id, dossier_id, audience, look, commit_sha, hook, benefit, kicker, closing, files, created_by, created_at';

/** The path of a run's file in the bucket. */
export const pitchPath = (dossierId: string, runId: string, name: string) => `${dossierId}/${runId}/${name}`;

/**
 * The database refused or failed; `code` is Postgres's: 42501 the caller may not write to the dossier,
 * P0002 no such dossier for them, 55000 a PRD not shipped or retro, 22023 a malformed run or a file it
 * did not upload, 23505 a run registered already.
 */
export class PitchStoreError extends Error {
  constructor(what: string, readonly code: string | undefined, readonly reason: string) {
    super(`${what}: ${reason}`);
  }
}

/** An upload link for one file: `url` takes one PUT of its bytes. */
export type SignedUpload = { name: string; path: string; url: string };

export type PitchStore = {
  /** The id of PRD `prd`'s dossier in `repo` the caller may read, or null. */
  dossierOf(repo: string, prd: number): Promise<string | null>;
  /** Whether the dossier's PRD reached shipped or retro, as the caller reads its stages. */
  shipped(dossierId: string): Promise<boolean>;
  /** One signed upload link per name, under the run's folder, in order. */
  signUploads(dossierId: string, runId: string, names: string[]): Promise<SignedUpload[]>;
  /** The names of the files the run's folder holds. */
  uploaded(dossierId: string, runId: string): Promise<string[]>;
  /** Stores the run, naming its five files. */
  register(run: PitchRunNew): Promise<void>;
  /** The dossier's pitches, newest first. */
  runs(dossierId: string): Promise<PitchRunRow[]>;
  /** A signed link per path, valid `seconds`, in order; null for one that could not be made. */
  links(paths: string[], seconds: number): Promise<Array<string | null>>;
};

export type PitchPublic = {
  /** The GIF's path in the bucket, or null for no such run. */
  gifPath(runId: string): Promise<string | null>;
  /** A signed link to `path`, valid `seconds`, or null when it could not be made. */
  link(path: string, seconds: number): Promise<string | null>;
};

type Outcome<T> = { data: T | null; error: { code?: string; message: string } | null };

function settle<T>(what: string, { data, error }: Outcome<T>): T | null {
  if (error) throw new PitchStoreError(what, error.code, error.message);
  return data;
}

/** A signed link per path, by path; a path missing could not be signed, and none are when the call fails. */
async function signedByPath(db: Pick<SupabaseClient, 'storage'>, paths: string[], seconds: number): Promise<Map<string, string>> {
  const signed = new Map<string, string>();
  if (paths.length === 0) return signed;
  try {
    const { data } = await db.storage.from(PITCH_BUCKET).createSignedUrls(paths, seconds);
    for (const entry of data ?? []) {
      if (entry.path && !entry.error && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
    }
  } catch (error) {
    console.error(error);
  }
  return signed;
}

async function signedLinks(db: Pick<SupabaseClient, 'storage'>, paths: string[], seconds: number): Promise<Array<string | null>> {
  const signed = await signedByPath(db, paths, seconds);
  return paths.map((path) => signed.get(path) ?? null);
}

/** The pitch store as the caller: row-level security and the bucket's rules decide. */
export function pitchStore(db: Pick<SupabaseClient, 'rpc' | 'from' | 'storage'>): PitchStore {
  return {
    dossierOf: (repo, prd) => dossierReader(db).numbered(repo, prd, 'prd'),

    async shipped(dossierId) {
      return settle<boolean>('read the stage', await db.rpc('pitch_dossier_shipped', { p_dossier: dossierId })) === true;
    },

    signUploads(dossierId, runId, names) {
      const bucket = db.storage.from(PITCH_BUCKET);
      const signOne = async (name: string): Promise<SignedUpload> => {
        const path = pitchPath(dossierId, runId, name);
        const signed = await bucket.createSignedUploadUrl(path);
        if (!signed.data) throw new PitchStoreError('sign the upload', '42501', signed.error?.message ?? 'no link came back');
        return { name, path, url: signed.data.signedUrl };
      };
      return Promise.all(names.map(signOne));
    },

    async uploaded(dossierId, runId) {
      const { data, error } = await db.storage.from(PITCH_BUCKET).list(`${dossierId}/${runId}`, { limit: 100 });
      if (error) throw new PitchStoreError('list the run', undefined, error.message);
      return (data ?? []).map((file) => file.name);
    },

    async register(run) {
      settle('register the pitch', await db.rpc('pitch_run_add', {
        p_dossier: run.dossierId, p_run: run.id, p_audience: run.audience, p_look: run.look, p_commit: run.commit,
        p_hook: run.hook, p_benefit: run.benefit, p_kicker: run.kicker, p_closing: run.closing, p_files: PITCH_FILE_NAMES,
      }));
    },

    async runs(dossierId) {
      return settle<PitchRunRow[]>('read the pitches', await db.from('pitch_runs').select(PITCH_RUN_COLUMNS)
        .eq('dossier_id', dossierId).order('created_at', { ascending: false }).order('id', { ascending: true })) ?? [];
    },

    links: (paths, seconds) => signedLinks(db, paths, seconds),
  };
}

/** The GIF's store as the service role: it reads a run's dossier and files only. */
export function pitchPublic(db: Pick<SupabaseClient, 'from' | 'storage'>): PitchPublic {
  return {
    async gifPath(runId) {
      const row = settle<{ dossier_id: string; files: string[] }>('read the pitch', await db.from('pitch_runs')
        .select('dossier_id, files').eq('id', runId).maybeSingle());
      return row?.files.includes(PITCH_GIF) ? pitchPath(row.dossier_id, runId, PITCH_GIF) : null;
    },
    async link(path, seconds) {
      return (await signedLinks(db, [path], seconds))[0] ?? null;
    },
  };
}
