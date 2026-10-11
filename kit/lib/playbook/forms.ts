/**
 * **A form is a typed thing the kit reads** (PRD #45, slice s1) — the ONE parser for the playbook:
 * one form per question an agent asks while delivering, each a Markdown file under
 * `ctx.layout.playbookDir`, except the decisions form, which sits beside the decision records
 * (`ctx.layout.formPath(id)` names every file):
 *
 * ```text
 * ---
 * form: testing                 one of FORM_IDS
 * form-version: 1
 * state: filled                 blank | filled | pointer
 * points-to: null               the path a pointer form points to; null on any other form
 * index: <path>                 a pointer form only, optional: the page to read first in a folder
 * evidence:                     <path>@<hex>: the files it was filled from, at their git hash-object
 *   - package.json@50fa1bd
 * invaded: 2026-09-25           or null
 * ---
 *
 * # Testing
 *
 * Use this page when adding, changing, or choosing tests.        the opener
 *
 * ## Commands
 * <!-- slot: commands · required · by: invade · verified: 2026-09-25 -->
 * …the section's body
 * ```
 *
 * A **slot** is a `## <heading>` whose first non-blank line is its marker,
 * `<!-- slot: <id> · required|optional[ · by: invade|human][ · verified: YYYY-MM-DD] -->`. A
 * `##` heading with no marker is no slot; it is listed apart (`unmarked`).
 *
 * **Old spellings** (PRD #68): a form written before `/omni:invade` was named says `terraformed:` for
 * `invaded:` and `by: terraform` for `by: invade`. The parser still reads both, as the new spelling,
 * and lists each one it met in `oldSpellings`, so `omni check kb` can warn on it. Nothing the kit
 * writes carries an old spelling.
 *
 * A slot's **body** is read as one of four kinds: `text` (repository text); `pointer` (a lone
 * `See: <path>[#anchor]` line, a section pointer); `empty`; or `holes` (nothing but
 * `TODO(human): <question>` lines). An HTML comment renders as nothing, so it is not body. A body
 * that holds text beside an open question is text, and still lists its questions.
 *
 * `FORMS` is the spec's forms table — each form's id, kind and slots, required or not, in order:
 * the contract between this parser, the kit's templates and the `omni kb` commands. Whether a
 * form's slots match its template, and whether a path it names exists, are the check's questions,
 * not the parser's.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import type { Context } from '../context.ts';
import { messageOf } from '../narrow.ts';
import { KIT_MESSAGES } from '../schema/messages.ts';

/** One slot of a form's template: its id, and whether a filled form must carry it. */
export type SlotSpec = Readonly<{ id: string; required: boolean }>;

/** One row of the spec's forms table. */
export type FormSpec = Readonly<{ id: string; kind: 'core' | 'extended'; pointerOnly: boolean; slots: readonly SlotSpec[] }>;

const req = (id: string): SlotSpec => Object.freeze({ id, required: true });
const opt = (id: string): SlotSpec => Object.freeze({ id, required: false });
const form = (id: string, kind: FormSpec['kind'], slots: SlotSpec[], { pointerOnly = false } = {}): FormSpec =>
  Object.freeze({ id, kind, pointerOnly, slots: Object.freeze(slots) });

/** The fifteen forms, in the spec's order: eight core, then seven extended. */
export const FORMS: readonly FormSpec[] = Object.freeze([
  form('briefing', 'core', [req('never'), opt('hooks'), opt('links'), opt('next')]),
  form('setup', 'core', [req('prerequisites'), req('install'), opt('run'), opt('env')]),
  form('architecture', 'core', [req('layout'), req('boundaries'), opt('patterns')]),
  form('testing', 'core', [req('commands'), req('layout'), opt('levels'), req('never'), opt('data')]),
  form('verification', 'core', [req('preflight'), opt('before-push'), opt('checks')]),
  form('ci', 'core', [req('workflows'), req('gating'), opt('known-reds'), opt('rerun')]),
  form('pull-requests', 'core', [req('body'), opt('title'), opt('labels'), opt('reviewers')]),
  form('decisions', 'core', [req('where'), req('format'), opt('numbering')]),
  form('definition-of-done', 'extended', [req('done'), opt('docs'), opt('commits')]),
  form('conventions', 'extended', [opt('naming'), opt('formatting'), opt('commits')]),
  form('releasing', 'extended', [req('publishes'), opt('how'), opt('rollback'), opt('notes')]),
  form('bug-fixing', 'extended', [req('steps'), opt('guard')]),
  form('review', 'extended', [req('fix'), req('push-back'), req('ask')]),
  form('design', 'extended', [req('product'), req('system'), opt('deliberate'), opt('review'), opt('language')]),
  form('glossary', 'extended', [req('where')], { pointerOnly: true }),
]);

export const FORM_IDS: readonly string[] = Object.freeze(FORMS.map((entry) => entry.id));

/** The form that lives beside the decision records, under the front door, not in the playbook. */
export const DECISIONS_FORM = 'decisions';

const FORM_STATES: readonly ['blank', 'filled', 'pointer'] = ['blank', 'filled', 'pointer'];

/** What a form written before PRD #68 may say, and what it says now. */
const OLD_DATE_KEY = 'terraformed';
const OLD_BY = 'terraform';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EVIDENCE = /^(.+)@([0-9a-f]{7,40})$/;

const FrontMatterSchema = z
  .object({
    form: z.enum(FORM_IDS),
    'form-version': z.number().int().positive(),
    state: z.enum(FORM_STATES),
    'points-to': z.string().min(1).nullable(),
    evidence: z.array(z.string().regex(EVIDENCE, 'each entry is <path>@<hex>, the file at its git hash-object')).nullable(),
    invaded: z.string().regex(DATE, 'a YYYY-MM-DD date').nullable().optional(),
    [OLD_DATE_KEY]: z.string().regex(DATE, 'a YYYY-MM-DD date').nullable().optional(),
    index: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((fm, context) => {
    if (fm.invaded === undefined && fm[OLD_DATE_KEY] === undefined) {
      context.addIssue({ code: 'custom', path: ['invaded'], message: 'missing — a YYYY-MM-DD date, or null' });
    }
    if (fm.invaded !== undefined && fm[OLD_DATE_KEY] !== undefined) {
      context.addIssue({ code: 'custom', path: [OLD_DATE_KEY], message: 'is the old spelling of invaded — keep invaded only' });
    }
    const pointer = fm.state === 'pointer';
    if (pointer && fm['points-to'] === null) {
      context.addIssue({ code: 'custom', path: ['points-to'], message: 'a pointer form names the path it points to' });
    }
    if (!pointer && fm['points-to'] !== null) {
      context.addIssue({ code: 'custom', path: ['points-to'], message: 'only a pointer form points to a path; null otherwise' });
    }
    if (!pointer && fm.index !== undefined) {
      context.addIssue({ code: 'custom', path: ['index'], message: 'only a pointer form carries an index' });
    }
  });

/** A form's front matter, checked. */
export type FormFrontMatter = z.infer<typeof FrontMatterSchema>;

/** A form's state: blank, filled, or a pointer to a page elsewhere. */
export type FormState = FormFrontMatter['state'];

/** A slot's body, read as one of four kinds. */
export type SlotBody =
  | { kind: 'empty' | 'holes' | 'text'; text: string; see: null; questions: string[] }
  | { kind: 'pointer'; text: string; see: { path: string; anchor: string | null }; questions: string[] };

/** One slot of a parsed form, in file order. */
export type Slot = {
  id: string;
  heading: string;
  required: boolean;
  by: string | null;
  verified: string | null;
  body: SlotBody;
};

/** An old spelling met while parsing, and the new one it was read as. */
export type OldSpelling = { where: string; old: string; now: string };

/** One form file, parsed. */
export type Form = {
  id: string;
  formVersion: number;
  state: FormState;
  pointsTo: string | null;
  index: string | null;
  evidence: { path: string; hash: string }[];
  invaded: string | null | undefined;
  oldSpellings: OldSpelling[];
  title: string | null;
  opener: string | null;
  slots: Slot[];
  unmarked: string[];
  file: string | null;
};

/** `parseForm`'s answer: the form, or every line saying why not. */
export type ParsedForm = { ok: true; form: Form; errors?: undefined } | { ok: false; errors: string[]; form?: undefined };

/** `readForm`'s answer: the form's file, whether it exists, and when it does, the parse. */
export type ReadForm =
  | { file: string; exists: false; ok?: undefined; form?: undefined; errors?: undefined }
  | ({ file: string; exists: true } & ParsedForm);

const FRONT_MATTER_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const TITLE = /^#\s+(.+?)\s*$/;
const HEADING = /^##\s+(.+?)\s*$/;
const FENCE = /^\s*(?:```|~~~)/;
const MARKER_START = /^<!--\s*slot:/;
const MARKER =
  /^<!--\s*slot:\s*([a-z][a-z0-9-]*)\s*·\s*(required|optional)(?:\s*·\s*by:\s*(invade|human|terraform))?(?:\s*·\s*verified:\s*(\d{4}-\d{2}-\d{2}))?\s*-->$/;
const COMMENT = /<!--[\s\S]*?-->/g;
const SEE = /^See:\s+([^\s#]+)(?:#(\S+))?$/;
const HOLE = /^(?:[-*]\s+)?TODO\(human\):\s*(.*\S)\s*$/;

function withFile(file: string | null, message: string): string {
  return file ? `${file}: ${message}` : message;
}

/** The front matter, checked: `{ data }` or `{ errors }`, each error one line without the file. */
function readFrontMatter(raw: string): { data: FormFrontMatter; errors?: undefined } | { errors: string[]; data?: undefined } {
  let data: unknown;
  try {
    data = parse(raw);
  } catch (error) {
    return { errors: [`front matter is not YAML — ${messageOf(error).split('\n')[0]}`] };
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { errors: ['front matter is not a set of keys'] };
  }
  const result = FrontMatterSchema.safeParse(data, { error: KIT_MESSAGES });
  if (result.success) return { data: result.data };
  return {
    errors: result.error.issues.map((issue) => {
      const keys = issue.code === 'unrecognized_keys' ? ` (${issue.keys.join(', ')})` : '';
      const field = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      return `front matter ${field}${issue.message}${keys}`;
    }),
  };
}

/** The lines before the first `##` heading, and one `{ heading, lines }` per heading after it. A
 * heading inside a fenced block is body. */
function splitSections(lines: readonly string[]): { head: string[]; sections: { heading: string; lines: string[] }[] } {
  const head: string[] = [];
  const sections: { heading: string; lines: string[] }[] = [];
  let current: { heading: string; lines: string[] } | null = null;
  let fenced = false;
  for (const line of lines) {
    const heading = fenced ? null : line.match(HEADING);
    if (FENCE.test(line)) fenced = !fenced;
    if (heading) {
      current = { heading: heading[1] ?? '', lines: [] };
      sections.push(current);
    } else {
      (current ? current.lines : head).push(line);
    }
  }
  return { head, sections };
}

/** The title (`# …`) and the first line of prose under it. */
function readHead(head: readonly string[]): { title: string | null; opener: string | null } {
  const at = head.findIndex((line) => TITLE.test(line));
  if (at === -1) return { title: null, opener: null };
  const opener = head
    .slice(at + 1)
    .map((line) => line.trim())
    .find((line) => line !== '' && !line.startsWith('<!--'));
  return { title: head[at]?.match(TITLE)?.[1] ?? null, opener: opener ?? null };
}

/** A section body, read as `text`, `pointer`, `empty` or `holes`. */
function readBody(raw: string): SlotBody {
  const text = raw.replace(COMMENT, '').trim();
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const questions = lines.map((line) => line.match(HOLE)?.[1]).filter((question): question is string => Boolean(question));
  if (lines.length === 0) return { kind: 'empty', text: '', see: null, questions: [] };
  if (questions.length === lines.length) return { kind: 'holes', text, see: null, questions };
  const see = lines.length === 1 ? (lines[0]?.match(SEE) ?? null) : null;
  if (see) return { kind: 'pointer', text, see: { path: see[1] ?? '', anchor: see[2] ?? null }, questions: [] };
  return { kind: 'text', text, see: null, questions };
}

/** One section read as a slot: no marker, a malformed one, or the slot it opens. */
type SectionRead = { kind: 'unmarked' } | { kind: 'malformed'; first: string } | { kind: 'slot'; slot: Slot; oldBy: boolean };

function readSection(heading: string, lines: readonly string[]): SectionRead {
  const at = lines.findIndex((line) => line.trim() !== '');
  const first = at === -1 ? '' : (lines[at] ?? '').trim();
  if (!MARKER_START.test(first)) return { kind: 'unmarked' };
  const marker = first.match(MARKER);
  if (!marker) return { kind: 'malformed', first };
  const [, id = '', need, by, verified] = marker;
  const slot: Slot = {
    id,
    heading,
    required: need === 'required',
    by: by === OLD_BY ? 'invade' : (by ?? null),
    verified: verified ?? null,
    body: readBody(lines.slice(at + 1).join('\n')),
  };
  return { kind: 'slot', slot, oldBy: by === OLD_BY };
}

/** The slots of `sections`, in file order, and the headings with no marker. A malformed marker or
 * a slot used twice is pushed onto `errors`; an old `by:` spelling onto `oldSpellings`. */
function readSlots(
  sections: readonly { heading: string; lines: string[] }[],
  { file, errors, oldSpellings }: { file: string | null; errors: string[]; oldSpellings: OldSpelling[] },
): { slots: Slot[]; unmarked: string[] } {
  const slots: Slot[] = [];
  const unmarked: string[] = [];
  for (const { heading, lines } of sections) {
    const read = readSection(heading, lines);
    if (read.kind === 'unmarked') {
      unmarked.push(heading);
      continue;
    }
    if (read.kind === 'malformed') {
      errors.push(withFile(file, `"## ${heading}": malformed slot marker ${read.first} — want <!-- slot: <id> · required|optional[ · by: invade|human][ · verified: YYYY-MM-DD] -->`));
      continue;
    }
    const { slot, oldBy } = read;
    if (slots.some((known) => known.id === slot.id)) {
      errors.push(withFile(file, `slot "${slot.id}" appears twice`));
      continue;
    }
    if (oldBy) oldSpellings.push({ where: `"## ${heading}"`, old: `by: ${OLD_BY}`, now: 'by: invade' });
    slots.push(slot);
  }
  return { slots, unmarked };
}

/**
 * Parses one form file's text. `{ ok: true, form }`, or `{ ok: false, errors }` whose every line
 * starts with `file`: front matter that is missing, is not YAML, lacks a key or holds another, a
 * malformed slot marker, a slot id used twice.
 *
 * `form` is `{ id, formVersion, state, pointsTo, index, evidence: [{ path, hash }], invaded,
 * oldSpellings: [{ where, old, now }], title, opener, slots: [{ id, heading, required, by, verified,
 * body }], unmarked, file }`, the slots in file order, `body` as {@link readBody} reads it, an old
 * spelling read as the new one and listed in `oldSpellings` (see the module note).
 */
export function parseForm(text: string, { file = null }: { file?: string | null } = {}): ParsedForm {
  const block = text.match(FRONT_MATTER_BLOCK);
  if (!block) return { ok: false, errors: [withFile(file, 'missing its front matter (a "---" fenced header)')] };
  const [, rawFrontMatter, body] = block;

  const errors: string[] = [];
  const { data, errors: frontMatterErrors = [] } = readFrontMatter(rawFrontMatter ?? '');
  errors.push(...frontMatterErrors.map((message) => withFile(file, message)));

  const { head, sections } = splitSections((body ?? '').split(/\r?\n/));
  const oldSpellings: OldSpelling[] = [];
  if (data?.[OLD_DATE_KEY] !== undefined) oldSpellings.push({ where: 'front matter', old: `${OLD_DATE_KEY}:`, now: 'invaded:' });
  const { slots, unmarked } = readSlots(sections, { file, errors, oldSpellings });

  // Front matter that did not read always left an error, so `data === undefined` adds no case.
  if (errors.length > 0 || data === undefined) return { ok: false, errors };
  return {
    ok: true,
    form: {
      id: data.form,
      formVersion: data['form-version'],
      state: data.state,
      pointsTo: data['points-to'],
      index: data.index ?? null,
      evidence: (data.evidence ?? []).map((entry) => {
        const [, path = '', hash = ''] = entry.match(EVIDENCE) ?? [];
        return { path, hash };
      }),
      invaded: data.invaded !== undefined ? data.invaded : data[OLD_DATE_KEY],
      oldSpellings,
      ...readHead(head),
      slots,
      unmarked,
      file,
    },
  };
}

/**
 * Reads the form `id` from its file under `ctx.layout`: `{ file, exists: false }` when the file is
 * missing, else `{ file, exists: true, ...parseForm(text) }`. A form the kit does not have is a
 * caller's mistake, and throws.
 */
export function readForm(id: string, { ctx }: { ctx: Pick<Context, 'root' | 'layout'> }): ReadForm {
  const file = ctx.layout.formPath(id);
  if (file === null) throw new Error(`the kit has no form "${id}"`);
  if (!existsSync(join(ctx.root, file))) return { file, exists: false };
  return { file, exists: true, ...parseForm(readFileSync(join(ctx.root, file), 'utf8'), { file }) };
}

/** `playbook/<form>#<slot>` — a settled entry's `Became:` for a process lesson. */
const PLAYBOOK_ID = /^playbook\/([^#\s]+)#([^#\s]+)$/;

/** Whether a `Became:` id names a playbook section rather than a law. */
export function isPlaybookId(id: string): boolean {
  return id.startsWith('playbook/');
}

/**
 * `playbook/<form>#<slot>` → `{ ok: true }` when that form's file holds that slot and its body is
 * not blank, else `{ ok: false, reason }` naming what is missing: the form, its file, the slot or
 * the slot's body.
 */
export function resolvePlaybookId(id: string, { ctx }: { ctx: Pick<Context, 'root' | 'layout'> }): { ok: true; reason?: undefined } | { ok: false; reason: string } {
  const match = id.match(PLAYBOOK_ID);
  if (!match) return { ok: false, reason: `${id}: not playbook/<form>#<slot>` };
  const [, formId = '', slotId = ''] = match;
  if (!FORM_IDS.includes(formId)) return { ok: false, reason: `the kit has no form "${formId}"` };
  const read = readForm(formId, { ctx });
  if (!read.exists) return { ok: false, reason: `no form file at ${read.file}` };
  if (!read.ok) return { ok: false, reason: read.errors.join('; ') };
  const slot = read.form.slots.find((entry) => entry.id === slotId);
  if (!slot) return { ok: false, reason: `${read.file} has no slot "${slotId}"` };
  if (slot.body.kind === 'empty') return { ok: false, reason: `${read.file}: slot "${slotId}" is blank` };
  return { ok: true };
}
