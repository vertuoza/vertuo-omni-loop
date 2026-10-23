/**
 * **The local copy of the Omni settings' tech playbook** (PRD 2417, s1): what a checkout reads
 * offline of its workspace's settings repository, at the tree's Omni settings folder
 * (`levelFolder('omni settings')`), where the resolver reads it as the `[omni settings]` level.
 *
 * {@link writeSettingsCopy} takes a settings repository's files (form, text) and where they came
 * from (repository, commit, time), and writes each page where a knowledge folder keeps it
 * (`./layout.ts`), without its `owner:` line (`./page.ts`), beside one record of the copy:
 *
 * ```text
 * .omni-loop/local/tree/omni-settings/
 *   playbook/<form>.md     each page read
 *   adr/README.md          the decisions form, when the settings repository sets it
 *   source.json            { repository, commit, readAt, forms, skipped: [{ form, reason }] }
 * ```
 *
 * Each write replaces the last copy's playbook whole, so a page the settings repository dropped
 * leaves the copy; what else the folder holds (the level's product knowledge, its decision records)
 * is left alone. A file that is not a page the kit reads is skipped and named in the record, never
 * an error. The local folder carries its own `.gitignore`, so the copy is never committed.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { ensureLocalDir } from '../ask/local-state.ts';
import { levelFolder } from '../knowledge-tree/levels.ts';
import { defined } from '../narrow.ts';
import { formRelativePath } from './layout.ts';
import { readSettingsPage } from './page.ts';
import type { SettingsPage } from './page.ts';
import { SettingsSourceSchema } from './schema.ts';
import type { SettingsFile, SettingsSource } from './schema.ts';

/** The copy's record, under its folder. */
export const SETTINGS_COPY_RECORD = 'source.json';

/** A file the copy left out, and why. */
const SkippedSchema = z.object({ form: z.string(), reason: z.string() }).strict();
export type SkippedFile = z.infer<typeof SkippedSchema>;

/** The copy's record: where its pages came from, which it holds, and which it skipped. */
const RecordSchema = SettingsSourceSchema.extend({ forms: z.array(z.string()), skipped: z.array(SkippedSchema) }).strict();

/** What a write did: the copy's folder, the forms written, in the order given, and the files skipped. */
export type SettingsCopyWrite = { folder: string; written: string[]; skipped: SkippedFile[] };

/** What the last copy holds: none, a record that does not read, or the record. */
export type SettingsCopyRead = { state: 'absent' } | { state: 'unreadable' } | ({ state: 'copied' } & z.infer<typeof RecordSchema>);

/** The pages of `files` to write, the first of each form kept, and every other file with why it was left out. */
function sortFiles(files: readonly SettingsFile[]): { pages: SettingsPage[]; skipped: SkippedFile[] } {
  const pages: SettingsPage[] = [];
  const skipped: SkippedFile[] = [];
  for (const file of files) {
    const read = readSettingsPage(file);
    if (!read.ok) skipped.push({ form: file.form, reason: read.reason });
    else if (pages.some((page) => page.form === file.form)) skipped.push({ form: file.form, reason: 'appears twice: the first is kept' });
    else pages.push(read.page);
  }
  return { pages, skipped };
}

/**
 * Writes the copy at the tree's Omni settings folder under `root` from a settings repository's
 * `files`, read at `source`. Throws only when `source` does not say where the files came from (a
 * caller's mistake), before anything is written.
 */
export function writeSettingsCopy({ root, files, source }: { root: string; files: readonly SettingsFile[]; source: SettingsSource }): SettingsCopyWrite {
  const from = SettingsSourceSchema.parse(source);
  const { pages, skipped } = sortFiles(files);
  const folder = levelFolder('omni settings');
  const absolute = join(root, folder);
  ensureLocalDir(root);
  mkdirSync(absolute, { recursive: true });
  rmSync(join(absolute, 'playbook'), { recursive: true, force: true });
  rmSync(join(absolute, defined(formRelativePath('decisions'), 'the decisions form’s path')), { force: true });
  for (const page of pages) {
    const path = join(absolute, defined(formRelativePath(page.form), `the path of ${page.form}`)); // a page is always a form the kit has
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, page.text);
  }
  const written = pages.map(({ form }) => form);
  const record = RecordSchema.parse({ ...from, forms: written, skipped });
  writeFileSync(join(absolute, SETTINGS_COPY_RECORD), `${JSON.stringify(record, null, 2)}\n`);
  return { folder, written, skipped };
}

/** The record of the last copy under `root`, read without a network call. */
export function readSettingsCopy({ root }: { root: string }): SettingsCopyRead {
  let text: string;
  try {
    text = readFileSync(join(root, levelFolder('omni settings'), SETTINGS_COPY_RECORD), 'utf8');
  } catch {
    return { state: 'absent' };
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { state: 'unreadable' };
  }
  const record = RecordSchema.safeParse(value);
  return record.success ? { state: 'copied', ...record.data } : { state: 'unreadable' };
}
