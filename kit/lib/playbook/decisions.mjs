/**
 * **The decision records, read live** (PRD #45, slice s3). The decisions form says where the
 * records live and how one is written; the list itself is never kept by hand. Every time it is
 * asked, this module reads `ctx.layout.adrDir`: each record's number and title, each number more
 * than one record uses, and the next free number.
 *
 * A record is a file directly in that folder named `NNNN-<slug>.md`, four digits, as `ADR-NNNN`
 * resolves it; its title is its first `# ` heading, as written. Any other file (the folder's
 * `README.md`, the decisions form itself when the records live beside it) is no record. The next
 * free number is one past the highest in use: a gap is a record that was never written or was
 * removed, never a number to hand out again.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const RECORD = /^(\d{4})-.+\.md$/;
const TITLE = /^#\s+(.+?)\s*$/m;

/**
 * `{ dir, records: [{ number, file, title }], shared: [{ number, files }], next }`: the records in
 * number order (a shared number's files by name), `title` `null` when the file has no `# `
 * heading, `next` the next free number, four digits. A folder that does not exist has no records.
 */
export function readDecisions({ ctx }) {
  const dir = ctx.layout.adrDir.replace(/\/+$/, '');
  const absolute = join(ctx.root, dir);
  const names = existsSync(absolute)
    ? readdirSync(absolute, { withFileTypes: true })
        .filter((entry) => entry.isFile() && RECORD.test(entry.name))
        .map((entry) => entry.name)
        .sort()
    : [];

  const records = names.map((name) => {
    const file = `${dir}/${name}`;
    const title = readFileSync(join(ctx.root, file), 'utf8').match(TITLE)?.[1] ?? null;
    return { number: name.match(RECORD)[1], file, title };
  });

  const byNumber = new Map();
  for (const record of records) byNumber.set(record.number, [...(byNumber.get(record.number) ?? []), record.file]);
  const shared = [...byNumber].filter(([, files]) => files.length > 1).map(([number, files]) => ({ number, files }));

  const highest = records.reduce((max, record) => Math.max(max, Number(record.number)), 0);
  return { dir, records, shared, next: String(highest + 1).padStart(4, '0') };
}
