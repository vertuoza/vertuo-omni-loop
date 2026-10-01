// @ts-nocheck
/**
 * **A release note is a typed thing** (PRD 262, slice s1) — the ONE parser for `release.md`, the file
 * beside a PRD's `spec.md` that says, for anyone outside, what the PRD shipped:
 *
 * ```markdown
 * ---
 * prd: 238
 * title: Jump between work and play in one tap
 * ---
 * A Game mode button on every app page and an App mode switch in the arcade move you between the
 * reading pages and the game, with a confirmation before each switch.
 * ```
 *
 * Pure: text in, a record or its refusals out. {@link parseReleaseNote} reads the shape: a front
 * matter holding exactly `prd`, `title` and, only on the initial release's notes, `version`, and a
 * body that is the description. Any other field is refused by name. {@link gradeReleaseNote} adds
 * the rules `omni check releases` and the ship guard enforce, in the spec's order:
 *
 * 1. the front matter parses and holds exactly those fields (the parser's refusals);
 * 2. `prd` is the folder's number;
 * 3. `version`, when present, is {@link INITIAL_VERSION};
 * 4. the title is 1 to {@link TITLE_MAX} characters on one line, does not end with a full stop and
 *    names no PRD number;
 * 5. the description is 1 to {@link DESCRIPTION_MAX} characters, one paragraph: no blank line, no
 *    heading, no list item;
 * 6. neither holds a URL, a `#<digit>` reference, a backtick or a path under the kit's own folder.
 *
 * The front matter is read line by line, never as YAML: a value is the rest of its line as written
 * (a quoted one without its quotes), so a title holding a colon or a `#` reads as the reader sees
 * it. An indented line continues the field above it, so a title wrapped onto a second line is kept,
 * and refused by rule 4. A wrapped description is one paragraph: its lines are joined by a space,
 * as Markdown renders them, and counted that way. Characters are counted as code points.
 *
 * A message never names the file: `omni check releases` puts the file before it, and `omni ship`
 * puts `release note:` before it.
 */
import { dirname } from 'node:path';
import { CONFIG_FILE } from '../config.ts';

/** The note's file name, in a PRD's folder beside `spec.md`. */
export const RELEASE_NOTE_FILE = 'release.md';
/** The one version a note may carry: the initial release's, pinned in its notes. */
export const INITIAL_VERSION = '0.0.1';
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 280;

const FIELDS = ['prd', 'title', 'version'];
const REQUIRED = ['prd', 'title'];

/** The kit's own folder, as a path prefix: the folder that holds its config. */
const KIT_FOLDER = `${dirname(CONFIG_FILE)}/`;

const FRONT_MATTER_BLOCK = /^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/;
const FIELD_LINE = /^([A-Za-z][\w-]*):(?:[ \t]+(.*))?$/;
const PRD_NUMBER = /^[1-9]\d*$/;
const HEADING = /^#{1,6}(?:\s|$)/;
const LIST_ITEM = /^(?:[-*+]|\d+[.)])\s/;
const PRD_REFERENCE = /\bPRD\s*\d+/i;
const FORBIDDEN = [
  { pattern: /https?:\/\/|www\./i, what: (match) => `a URL ("${match}")` },
  { pattern: /#\d+/, what: (match) => `a reference ("${match}")` },
  { pattern: /`/, what: () => 'a backtick' },
  { pattern: new RegExp(KIT_FOLDER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), what: () => `a path under ${KIT_FOLDER}` },
];

const characters = (text) => [...text].length;

function unquote(value) {
  const trimmed = value.trim();
  const first = trimmed[0];
  if (trimmed.length >= 2 && (first === '"' || first === "'") && trimmed.at(-1) === first) return trimmed.slice(1, -1);
  return trimmed;
}

/** The front matter's fields, raw: `{ fields: { key: text }, errors }`, a continued line joined by `\n`. */
function readFields(raw) {
  const fields = {};
  const errors = [];
  let last = null;
  for (const line of raw.split('\n')) {
    if (line.trim() === '') continue;
    const match = /^\s/.test(line) ? null : line.match(FIELD_LINE);
    if (match) {
      const [, key, value = ''] = match;
      if (Object.hasOwn(fields, key)) errors.push(`front matter holds ${key} twice`);
      fields[key] = value;
      last = key;
    } else if (last !== null && /^\s/.test(line)) {
      fields[last] = `${fields[last]}\n${line.trim()}`;
    } else {
      errors.push(`front matter line is not "key: value": "${line}"`);
    }
  }
  return { fields, errors };
}

/** The text split at its front matter: `{ front, body }`, or `null` when it has none. */
function splitNote(text) {
  const match = text.replace(/\r\n?/g, '\n').match(FRONT_MATTER_BLOCK);
  return match ? { front: match[1], body: match[2] } : null;
}

/** The body's lines, blank lines at either end dropped. */
function bodyLines(body) {
  const lines = body.split('\n').map((line) => line.trim());
  while (lines.length && lines[0] === '') lines.shift();
  while (lines.length && lines.at(-1) === '') lines.pop();
  return lines;
}

/**
 * Parses one note's text: `{ ok: true, note: { prd, title, version, description } }`, `version`
 * `null` when the note carries none, or `{ ok: false, errors }`, one line each: no front matter, a
 * line that is not `key: value`, a field given twice, a field a note never carries (named), `prd` or
 * `title` missing, a `prd` that is not a number.
 */
export function parseReleaseNote(text) {
  const parts = splitNote(text);
  if (!parts) return { ok: false, errors: ['no front matter — a release note opens with a "---" fenced header holding prd and title'] };
  const { fields, errors } = readFields(parts.front);
  for (const key of Object.keys(fields)) {
    if (!FIELDS.includes(key)) errors.push(`front matter holds ${key}, which a release note never carries — only prd, title and, optionally, version`);
  }
  for (const key of REQUIRED) {
    if (!Object.hasOwn(fields, key)) errors.push(`front matter lacks ${key}`);
  }
  const prd = Object.hasOwn(fields, 'prd') ? unquote(fields.prd) : null;
  if (prd !== null && !PRD_NUMBER.test(prd)) errors.push(`prd "${prd}" is not a PRD number`);
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    note: {
      prd: Number(prd),
      title: fields.title.split('\n').map(unquote).join('\n'),
      version: Object.hasOwn(fields, 'version') ? unquote(fields.version) : null,
      description: bodyLines(parts.body).join(' '),
    },
  };
}

function titleViolations(title) {
  if (title === '') return [`title is empty — 1 to ${TITLE_MAX} characters`];
  const out = [];
  if (title.includes('\n')) out.push('title spans more than one line — one line');
  if (characters(title) > TITLE_MAX) out.push(`title is ${characters(title)} characters — ${TITLE_MAX} at most`);
  if (title.endsWith('.')) out.push('title ends with a full stop');
  const reference = title.match(PRD_REFERENCE);
  if (reference) out.push(`title names a PRD number ("${reference[0]}")`);
  return out;
}

function descriptionViolations(lines, description) {
  if (description === '') return [`description is empty — one paragraph of 1 to ${DESCRIPTION_MAX} characters`];
  const out = [];
  if (characters(description) > DESCRIPTION_MAX) out.push(`description is ${characters(description)} characters — ${DESCRIPTION_MAX} at most`);
  if (lines.includes('')) out.push('description holds a blank line — one paragraph');
  const heading = lines.find((line) => HEADING.test(line));
  if (heading) out.push(`description holds a heading ("${heading}") — one paragraph of prose`);
  const item = lines.find((line) => LIST_ITEM.test(line));
  if (item) out.push(`description holds a list item ("${item}") — one paragraph of prose`);
  return out;
}

function contentViolations(name, text) {
  return FORBIDDEN.flatMap(({ pattern, what }) => {
    const match = text.match(pattern);
    return match ? [`${name} holds ${what(match[0])}`] : [];
  });
}

/**
 * Every rule the note `text` breaks, in the folder of PRD `prd`: one message per rule, `[]` when it
 * holds. A note that does not parse gives the parser's refusals and nothing more.
 */
export function gradeReleaseNote(text, { prd }) {
  const parsed = parseReleaseNote(text);
  if (!parsed.ok) return parsed.errors;
  const { note } = parsed;
  const out = [];
  if (note.prd !== Number(prd)) out.push(`prd ${note.prd} is not its folder's number, ${Number(prd)}`);
  if (note.version !== null && note.version !== INITIAL_VERSION) {
    out.push(`version ${note.version === '' ? '""' : note.version} is not ${INITIAL_VERSION} — only the initial release's notes carry a version`);
  }
  out.push(...titleViolations(note.title));
  out.push(...descriptionViolations(bodyLines(splitNote(text).body), note.description));
  out.push(...contentViolations('title', note.title), ...contentViolations('description', note.description));
  return out;
}
