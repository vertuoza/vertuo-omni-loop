/**
 * **One page of a settings repository's tech playbook** (PRD 2417, s1), read as the copy keeps it.
 *
 * A page is a playbook form, as the forms' own parser reads one (`../playbook/forms.ts`), with one
 * more front-matter line, `owner:`: the GitHub logins who approve a change to it, or `null` for the
 * law owners (`laws.owners`) of the settings repository's config (spec Q3). The forms' parser knows
 * no `owner:` key, so the copy keeps the page without it: {@link readSettingsPage} takes the line
 * out of the front matter and leaves the body byte for byte, and the resolver then reads the copy
 * as it reads any level.
 *
 * A page that is not a form the kit reads (an unknown form, a page of another form than its file,
 * front matter the parser refuses, an owner that names no login) is refused with one line saying
 * why: the writer skips it and names it, and reads the rest.
 */
import { isMap, parseDocument } from 'yaml';
import { z } from 'zod';
import { FORM_IDS, parseForm } from '../playbook/forms.ts';
import type { SettingsFile } from './schema.ts';

/** A page as the copy keeps it: its form, the logins its owner line names (`null`: the law
 * owners), and its text without that line. */
export type SettingsPage = { form: string; owners: string[] | null; text: string };

/** `readSettingsPage`'s answer: the page, or the one line saying why it is not one. */
export type SettingsPageRead = { ok: true; page: SettingsPage } | { ok: false; reason: string };

const FRONT_MATTER_BLOCK = /^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$)[\s\S]*)$/;
const OWNER_KEY = 'owner';

/** A GitHub login, a leading `@` allowed. */
const LOGIN = /^@?[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const OwnerSchema = z.array(z.string().regex(LOGIN)).min(1).nullable();
const OWNER_SHAPE = 'owner: a list of GitHub logins, or null for the law owners';

/** The text with its `owner:` line taken out of the front matter, and what that line held. `null`
 * when the front matter cannot be read: the forms' parser then says why. */
function splitOwner(text: string): { text: string; owner: unknown } | null {
  const block = FRONT_MATTER_BLOCK.exec(text);
  if (!block) return null;
  const [, open = '', raw = '', rest = ''] = block;
  const doc = parseDocument(raw);
  if (doc.errors.length > 0 || !isMap(doc.contents) || !doc.has(OWNER_KEY)) return { text, owner: null };
  const data: unknown = doc.toJS({ maxAliasCount: 0 });
  const owner: unknown = data !== null && typeof data === 'object' ? Reflect.get(data, OWNER_KEY) : null;
  doc.delete(OWNER_KEY);
  return { text: `${open}${doc.toString().replace(/\r?\n$/, '')}${rest}`, owner };
}

/** The first line of `errors`, its file prefix (none here) dropped. */
const firstError = (errors: readonly string[]): string => errors[0] ?? 'does not parse as a form';

/** Reads one file of the settings repository as the copy keeps it, or says why it is no page. */
export function readSettingsPage(file: SettingsFile): SettingsPageRead {
  if (!FORM_IDS.includes(file.form)) return { ok: false, reason: `${file.form} is not a form the kit reads` };
  const split = splitOwner(file.text) ?? { text: file.text, owner: null };
  const owners = OwnerSchema.safeParse(split.owner);
  if (!owners.success) return { ok: false, reason: OWNER_SHAPE };
  const parsed = parseForm(split.text);
  if (!parsed.ok) return { ok: false, reason: firstError(parsed.errors) };
  if (parsed.form.id !== file.form) return { ok: false, reason: `its front matter says form: ${parsed.form.id}` };
  const logins = owners.data?.map((login) => login.replace(/^@/, '')) ?? null;
  return { ok: true, page: { form: file.form, owners: logins, text: split.text } };
}

/** Who approves a change to a page: the logins its owner line names, else the law owners. */
export function ownersOf(page: Pick<SettingsPage, 'owners'>, { lawOwners }: { lawOwners: readonly string[] }): string[] {
  return page.owners ?? [...lawOwners];
}
