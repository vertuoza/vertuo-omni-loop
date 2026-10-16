// The pack hasher (PRD 2011 s11): the files read at a commit in, the pack's files out, each with its
// content and the sha256 of its bytes, which is what knowledge_pack_put() computes again of the content
// and refuses when it differs (supabase/migrations/20261212100000_knowledge_packs.sql). Pure.
//
// A pack keeps text: its content is a database text column. A file it cannot keep as it is in the
// commit is left out of the pack, named with why, never changed to fit, so every file a pack holds
// hashes to that commit's file:
//
//   not UTF-8 text           an image or any other binary file
//   holds a NUL character    a database text value cannot hold one
//   over 1 MiB               the database's bound on one file
import { createHash } from 'node:crypto';

/** The largest file a pack keeps, the database's bound. */
export const MAX_FILE_BYTES = 1024 * 1024;

/** One file of a pack, as knowledge_pack_put() takes it. */
export type PackFile = { path: string; content: string; sha256: string };

/** A file left out of the pack, and why. */
export type LeftFile = { path: string; why: string };

/** The lower-case hex sha256 of `bytes`. */
export function sha256Of(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

/** Why `bytes` cannot be kept as a pack's text, or its text. */
function textOf(bytes: Uint8Array): { text: string } | { why: string } {
  if (bytes.length > MAX_FILE_BYTES) return { why: 'over 1 MiB' };
  let text: string;
  try {
    text = utf8.decode(bytes);
  } catch {
    return { why: 'not UTF-8 text' };
  }
  return text.includes('\u0000') ? { why: 'holds a NUL character' } : { text };
}

/** The pack's files from the files read, by repository path; and those left out. Both in path order. */
export function packFiles(read: ReadonlyMap<string, Uint8Array>): { files: PackFile[]; left: LeftFile[] } {
  const files: PackFile[] = [];
  const left: LeftFile[] = [];
  for (const path of [...read.keys()].sort()) {
    const bytes = read.get(path) ?? new Uint8Array();
    const kept = textOf(bytes);
    if ('why' in kept) left.push({ path, why: kept.why });
    else files.push({ path, content: kept.text, sha256: sha256Of(bytes) });
  }
  return { files, left };
}
