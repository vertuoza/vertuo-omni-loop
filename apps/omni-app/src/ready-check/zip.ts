// One file out of a zip archive (PRD 2898 s8): the App downloads the `acceptance-report` artifact CI kept, a zip of
// one JSON file, and reads it here, with node's own inflate, no dependency. Only what such an artifact holds is read:
// the central directory (so a data descriptor after a file is never needed), files stored or deflated, and no
// ZIP64. Anything else is refused with why, never guessed.
import { inflateRawSync } from 'node:zlib';

const END = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const STORED = 0;
const DEFLATED = 8;

/** The longest a file read out of an archive may be: an acceptance report is a few kilobytes. */
export const UNZIPPED_MAX = 1024 * 1024;

type Read = { ok: true; text: string } | { ok: false; why: string };

/** One file of the central directory: its path, how it is compressed, its sizes and where its local header is. */
type Entry = { path: string; method: number; size: number; unzipped: number; local: number };

/** The end of the central directory: its offset in `zip`, or -1. */
function endOf(zip: Buffer): number {
  for (let at = zip.length - 22; at >= Math.max(0, zip.length - 22 - 0xffff); at -= 1) if (zip.readUInt32LE(at) === END) return at;
  return -1;
}

/** The files of the central directory, or why it cannot be read. */
function entriesOf(zip: Buffer): Entry[] | string {
  const end = endOf(zip);
  if (end === -1) return 'the artifact is not a zip archive';
  const entries: Entry[] = [];
  let at = zip.readUInt32LE(end + 16);
  for (let i = 0; i < zip.readUInt16LE(end + 10); i += 1) {
    if (at + 46 > zip.length || zip.readUInt32LE(at) !== CENTRAL) return 'the archive\'s directory is broken';
    const nameLength = zip.readUInt16LE(at + 28);
    entries.push({
      path: zip.toString('utf8', at + 46, at + 46 + nameLength),
      method: zip.readUInt16LE(at + 10),
      size: zip.readUInt32LE(at + 20),
      unzipped: zip.readUInt32LE(at + 24),
      local: zip.readUInt32LE(at + 42),
    });
    at += 46 + nameLength + zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32);
  }
  return entries;
}

/** The text of one file of the archive. */
function textOf(zip: Buffer, entry: Entry, name: string): Read {
  if (entry.unzipped > UNZIPPED_MAX) return { ok: false, why: `${name} is over ${String(UNZIPPED_MAX)} bytes` };
  const { local } = entry;
  if (local + 30 > zip.length || zip.readUInt32LE(local) !== LOCAL) return { ok: false, why: 'the archive\'s file header is broken' };
  const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
  const data = zip.subarray(start, start + entry.size);
  if (entry.method === STORED) return { ok: true, text: data.toString('utf8') };
  if (entry.method !== DEFLATED) return { ok: false, why: `${name} is compressed in a way this reader does not read (method ${String(entry.method)})` };
  try {
    return { ok: true, text: inflateRawSync(data, { maxOutputLength: UNZIPPED_MAX }).toString('utf8') };
  } catch {
    return { ok: false, why: `${name} could not be inflated` };
  }
}

/** The text of the file named `name` in `zip` (its path within the archive, or its last segment); or why it cannot be read. */
export function unzipText(zip: Buffer, name: string): Read {
  const entries = entriesOf(zip);
  if (typeof entries === 'string') return { ok: false, why: entries };
  const entry = entries.find(({ path }) => path === name || path.split('/').at(-1) === name);
  return entry === undefined ? { ok: false, why: `the artifact holds no ${name}` } : textOf(zip, entry, name);
}
