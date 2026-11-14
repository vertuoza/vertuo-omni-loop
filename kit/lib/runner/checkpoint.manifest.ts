// The manifest of a job's save (PRD 2809, s4): what the runner tells the app about a save once it made one,
// read by `CheckpointManifestSchema` on both sides — the runner's `checkpoint.ts` writes it, the app's contract
// (its runners contract) re-exports it and reads what `POST /api/runners/jobs/<id>/checkpoint`
// is sent. It names what the bundle holds and never a file's content: per branch its name, its checkpoint ref, the
// commit origin had that its work starts from, its head, its files and commits saved; the bundle's bytes; what the
// save takes of the runner's disk; the handoff note, masked as logs are and cut to 8 KB; why the upload failed.
//
// No credential reaches a manifest (L-GDPR-2): every text in it is refused while it still holds a token-shaped
// string, and `manifestHandoff` masks the job's own secrets first. A key it does not know is refused, so neither
// the folder on the runner nor anything else travels unnamed. Free of Node: the app's browser-safe contract reads it.
import { z } from 'zod';
import { MASK, maskSecrets } from '../openrouter.ts';

/** The largest bundle the bucket `runner-checkpoints` takes: 100 MB. A bigger one stays a local save. */
export const CHECKPOINT_BYTES_MAX = 100 * 1024 * 1024;
/** The longest handoff note a manifest carries, in UTF-8 bytes. */
export const HANDOFF_BYTES_MAX = 8 * 1024;
/** The most branches one save names. */
const CHECKPOINT_BRANCHES_MAX = 50;
/** Where every saved branch's ref lives, in the bundle and once restored. */
const CHECKPOINT_REF_PREFIX = 'refs/heads/omni-checkpoint/';

const bytesOf = (text: string): number => new TextEncoder().encode(text).length;
/** Whether `text` holds nothing a token looks like: masking it changes nothing. */
const noCredential = (text: string): boolean => maskSecrets(text) === text;

/** A text of at most `max` UTF-8 bytes holding no credential. */
const safeText = (max: number) => z.string().refine((text) => bytesOf(text) <= max, `at most ${String(max)} bytes`).refine(noCredential, 'no credential');

const CommitSchema = z.string().regex(/^[0-9a-f]{40}([0-9a-f]{24})?$/, 'a commit id');
const DateSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'a date');

/** One worktree's saved work. */
const CheckpointBranchSchema = z.strictObject({
  /** The branch the worktree was on, `null` when it was detached. */
  branch: safeText(255).nullable(),
  ref: safeText(512).refine((ref) => ref.startsWith(CHECKPOINT_REF_PREFIX) && ref.length > CHECKPOINT_REF_PREFIX.length, 'a ref under omni-checkpoint/'),
  /** The worktree's path in the job's folder, `.` for the folder itself. */
  path: safeText(1024),
  /** The commit origin had that the saved work starts from, `null` when origin had none of it. */
  base: CommitSchema.nullable(),
  head: CommitSchema,
  files: z.number().int().nonnegative(),
  commits: z.number().int().nonnegative(),
});

/** A save as the app records it: `portable` once its bundle is in the bucket, `local` while it stays on its runner. */
export const CheckpointManifestSchema = z.strictObject({
  job: z.string().min(1).max(64),
  /** The runner that saved it, by name. */
  runner: safeText(120),
  repo: safeText(200),
  kind: z.enum(['portable', 'local']),
  savedAt: DateSchema,
  /** Until when the runner keeps its folder (a local save). */
  keepUntil: DateSchema,
  bundleBytes: z.number().int().nonnegative(),
  /** The folder and the bundle together: what the save takes of the runner's disk while it keeps it. */
  bytes: z.number().int().nonnegative(),
  branches: z.array(CheckpointBranchSchema).max(CHECKPOINT_BRANCHES_MAX),
  /** The job's handoff note, masked and cut to 8 KB; `null` when it has none. */
  handoff: safeText(HANDOFF_BYTES_MAX).nullable(),
  /** Why the save, or its upload, failed; `null` when nothing did. */
  failed: safeText(300).nullable(),
}).refine((manifest) => manifest.kind === 'local' || manifest.bundleBytes <= CHECKPOINT_BYTES_MAX, { message: 'a portable bundle is 100 MB at most', path: ['bundleBytes'] })
  .refine((manifest) => manifest.branches.length > 0 || manifest.failed !== null, { message: 'a save names a branch, or why it failed', path: ['branches'] });

export type CheckpointManifest = z.output<typeof CheckpointManifestSchema>;

/** `text` cut to its first `max` UTF-8 bytes, on a character's first byte so none is split. */
function cutBytes(text: string, max: number): string {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length <= max) return text;
  let end = max;
  while (end > 0 && ((bytes[end] ?? 0) & 0xc0) === 0x80) end -= 1;
  return new TextDecoder().decode(bytes.slice(0, end));
}

/**
 * The handoff note as a manifest carries it: `secrets` (the job's tokens, its accounts' keys) and every token-shaped
 * string masked, as logs are, then cut to 8 KB, its start kept; `null` for no note or an empty one.
 */
export function manifestHandoff(note: string | null, secrets: readonly string[]): string | null {
  if (note === null || note.trim() === '') return null;
  const known = [...new Set(secrets)].filter((secret) => secret !== '').sort((a, b) => b.length - a.length);
  const own = known.reduce((out, secret) => out.split(secret).join(MASK), note);
  return cutBytes(maskSecrets(own), HANDOFF_BYTES_MAX);
}
