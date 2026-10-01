// Send with screenshots (PRD 620, spec "The page"): the screenshots on Other go straight from the
// browser into the private `ask-attachments` bucket, one after the other, then the answer is recorded
// with their paths in one update. A failed upload records nothing, and Send again uploads only what
// is missing. When the round turns out already answered (the terminal won), the uploads are deleted.
//
// The answer form stages its round's screenshots in a tray, keyed by the round, and the page's port
// sends from it: the answer itself stays a string map, so the port's shape and every page that sends
// through it are unchanged. A path is `<round id>/<n>.<ext>`, n from 1 to 5: the numbers are the
// round's, shared by its questions (the bucket's rule allows no other).
import { SHOTS_MAX, type Shot } from '../answer-model';
import type { AskAttachments } from '../store';

/** The bucket, as the page's storage client reaches it (`storage.from(bucket)`). */
export type Bucket = {
  upload(path: string, file: Blob, options: { contentType: string; upsert: false }): Promise<{ error: { message: string; statusCode?: string } | null }>;
  remove(paths: string[]): Promise<{ error: unknown }>;
};

/** Where Send stands with the screenshots: nothing to say, uploading the `at`-th of `total`, or
 * stopped on the `at`-th. */
export type Progress = { kind: 'idle' } | { kind: 'uploading'; at: number; total: number } | { kind: 'failed'; at: number; total: number };

const IDLE: Progress = { kind: 'idle' };

/** What the page says of it, or null when there is nothing to say. */
export function progressText(progress: Progress | undefined): string | null {
  if (!progress || progress.kind === 'idle') return null;
  return progress.kind === 'uploading' ? `Uploading ${progress.at} of ${progress.total}…` : `Could not upload ${progress.at} of ${progress.total} — Send again`;
}

/** An upload that failed: nothing was recorded. */
class UploadFailed extends Error {
  readonly at: number;
  readonly total: number;

  constructor(at: number, total: number) {
    super(progressText({ kind: 'failed', at, total }) ?? '');
    this.at = at;
    this.total = total;
  }
}

/** One round's staged screenshots (question text → its Other's), what already reached the bucket
 * (screenshot id → path), and where Send stands. */
export type Tray = {
  shots: Record<string, Shot[]>;
  uploaded: Map<string, string>;
  progress: Progress;
  setProgress(progress: Progress): void;
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function newTray(): Tray {
  const tray: Tray = {
    shots: {},
    uploaded: new Map(),
    progress: IDLE,
    setProgress(progress) {
      tray.progress = progress;
      emit();
    },
  };
  return tray;
}

const trays = new Map<string, Tray>();

/** The tray of `roundId`, made empty on first use. */
export function trayOf(roundId: string): Tray {
  let tray = trays.get(roundId);
  if (!tray) trays.set(roundId, (tray = newTray()));
  return tray;
}

/** Stages what the form shows for `roundId`: the screenshots each question's Other sends. */
export function stageShots(roundId: string, shots: Record<string, Shot[]>): void {
  trayOf(roundId).shots = shots;
}

/** Where Send stands for `roundId`; idle for a round never staged. */
export const progressOf = (roundId: string): Progress => trays.get(roundId)?.progress ?? IDLE;

/** Hears every move of any tray's progress; returns how to stop. */
export function subscribeTrays(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };
const numberOf = (path: string) => Number(path.slice(path.lastIndexOf('/') + 1).split('.')[0]);
const exists = (error: { message: string; statusCode?: string }) => error.statusCode === '409' || /already exists|duplicate/i.test(error.message);

/** Deletes the uploads whose screenshot was removed from the tray, so their numbers are free again. */
async function dropRemoved(bucket: Bucket, tray: Tray, staged: Shot[]): Promise<void> {
  const kept = new Set(staged.map((s) => s.id));
  const gone = [...tray.uploaded].filter(([id]) => !kept.has(id));
  if (!gone.length) return;
  const { error } = await bucket.remove(gone.map(([, path]) => path)).catch((e: unknown) => ({ error: e }));
  // Not deleted: their numbers stay taken, so no new screenshot lands on an old file.
  if (!error) for (const [id] of gone) tray.uploaded.delete(id);
}

/** The lowest number from 1 to SHOTS_MAX no upload of the tray holds, or undefined when all are taken. */
function freeNumber(tray: Tray): number | undefined {
  const used = new Set([...tray.uploaded.values()].map(numberOf));
  return Array.from({ length: SHOTS_MAX }, (_, i) => i + 1).find((k) => !used.has(k));
}

/** Puts one screenshot in the bucket at `path`: true when it is there (one already there counts). */
async function put(bucket: Bucket, path: string, shot: Shot): Promise<boolean> {
  const { error } = await bucket.upload(path, shot.file, { contentType: shot.type, upsert: false }).catch((e: unknown) => ({ error: { message: String(e) } }));
  return !error || exists(error);
}

/** Uploads what is not in the bucket yet, in order, and names every staged screenshot's path. A
 * screenshot removed after it was uploaded is deleted first, so its number is free again. */
async function upload(bucket: Bucket, roundId: string, tray: Tray, onProgress: (progress: Progress) => void): Promise<AskAttachments> {
  const staged = Object.values(tray.shots).flat();
  await dropRemoved(bucket, tray, staged);
  for (const [at, shot] of staged.entries()) {
    if (tray.uploaded.has(shot.id)) continue;
    onProgress({ kind: 'uploading', at: at + 1, total: staged.length });
    const n = freeNumber(tray);
    const path = n === undefined ? null : `${roundId}/${n}.${EXT[shot.type] ?? 'png'}`;
    if (!path || !(await put(bucket, path, shot))) throw failed(at + 1, staged.length, onProgress);
    tray.uploaded.set(shot.id, path);
  }
  return Object.fromEntries(Object.entries(tray.shots).map(([question, shots]) => [question, shots.map((s) => tray.uploaded.get(s.id) as string)]));
}

function failed(at: number, total: number, onProgress: (progress: Progress) => void): UploadFailed {
  onProgress({ kind: 'failed', at, total });
  return new UploadFailed(at, total);
}

/** Sends a round: its screenshots first, then `record` with their paths (or with none, when there
 * are none). Throws UploadFailed, having recorded nothing, when an upload fails. When `record` says
 * the round was taken, the uploads are deleted. */
export async function sendWithShots(
  bucket: Bucket,
  roundId: string,
  tray: Tray,
  record: (attachments?: AskAttachments) => Promise<'answered' | 'taken'>,
  onProgress: (progress: Progress) => void,
): Promise<'answered' | 'taken'> {
  if (Object.keys(tray.shots).length === 0) return record();
  const attachments = await upload(bucket, roundId, tray, onProgress);
  let outcome: 'answered' | 'taken';
  try {
    outcome = await record(attachments);
  } catch (error) {
    // The uploads stay: Send again records them without uploading anything.
    onProgress(IDLE);
    throw error;
  }
  if (outcome === 'taken' && tray.uploaded.size) {
    // Best effort: the bucket lets the session's owner delete at any time, and the uploader only
    // while the round is open, so a teammate's uploads may stay until the session is deleted.
    await bucket.remove([...tray.uploaded.values()]).catch(() => undefined);
  }
  tray.uploaded.clear();
  onProgress(IDLE);
  return outcome;
}

/** The files a paste or a drop carries. */
export function imagesOf(data: { files: FileList } | null | undefined): File[] {
  return data ? Array.from(data.files) : [];
}

/** A file picked, pasted or dropped, as Other holds it. */
export function shotOf(file: File): Shot {
  return { id: crypto.randomUUID(), type: file.type, size: file.size, file };
}
