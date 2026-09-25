/**
 * **An inbox spec is a typed thing** (PRD #1015, slice s1; folders layout, this task).
 *
 * The ONE parser for `<delivery>/inbox/<prd>-<topic>/spec.md` — one folder per PRD approved for
 * delivery, its front matter carrying only what is written once and never changes. Pure: markdown
 * text in, a typed record out — Zod-first per invariant N1. No filesystem access happens in
 * {@link parseSpec}; only {@link readInbox} touches disk, through `ctx.layout.specFiles()`, and it
 * takes the context so a caller can point it at a fixture tree instead of the real repository.
 *
 * **The central rule this PRD exists to enforce: there is no `status`, no `branch`, no `value`, no
 * `priority` field, ever — and, in this layout, no `plan` field either.** Whether a PRD is
 * unplanned, planned, in flight, stalled or done is derived elsewhere (slice s2, `status.mjs`)
 * from a pull-request payload and the feature branch — never stored here. The plan itself is
 * always the sibling `plan.md`, never a front-matter value that could point somewhere else or go
 * stale. The front-matter schema is `.strict()`, so a file carrying any of those fields, or any
 * other field this schema does not name, is refused by name rather than silently accepted.
 *
 * An optional `areas:` list names the knowledge domains a spec bears on. Structurally it is just a
 * bracketed list of names here — whether each named area is a real domain folder is a cross-file
 * check `check-inbox.mjs` makes, not something one file's text can answer on its own.
 *
 * Deliberately unlike an outbox item: an inbox spec has no required body shape. The body is
 * free-form prose (the PRD's moved spec, when `spec: file`) this parser does not need to
 * understand.
 */
// Ported from vertuo-ai-domain@c4a210122:scripts/inbox.mjs — changes in kit/porting/inbox--inbox.md.
import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { z } from 'zod';
import { readRepoFile } from '../check-report.mjs';

/** The two ways a PRD's full prose is reached, in the order the plan lists them. */
export const SPEC_VALUES = /** @type {const} */ (['file', 'issue']);

const FRONT_MATTER_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const FRONT_MATTER_LINE = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/;
const BLOCKED_BY_LIST = /^\[\s*(\d+\s*(?:,\s*\d+\s*)*)?\]$/;
const BRACKET_LIST = /^\[([\s\S]*)\]$/;

/** Front-matter field names this schema never admits — named so a refusal can quote the field. */
const FORBIDDEN_STATUS_LIKE_FIELDS = ['status', 'branch', 'value', 'priority'];

function withFile(file, message) {
  return file ? `${file}: ${message}` : message;
}

function stripQuotes(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

/**
 * Reads a fenced front-matter block's raw text (between the `---` fences, exclusive) into a plain
 * `{ key: value }` object. Deliberately dumb, the same shape every other kit front matter reads:
 * one `key: value` per line, quotes stripped, nothing nested. A line that isn't `key: value` is
 * reported rather than silently dropped.
 */
export function parseFrontMatterLines(rawFrontMatter) {
  const data = {};
  const errors = [];
  for (const rawLine of rawFrontMatter.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(FRONT_MATTER_LINE);
    if (!match) {
      errors.push(`front matter line is not "key: value": "${rawLine}"`);
      continue;
    }
    const [, key, rawValue] = match;
    data[key] = stripQuotes(rawValue);
  }
  return { data, errors };
}

/**
 * `blocked-by`'s raw string into `'none'` or an array of PRD numbers. Structural only — whether a
 * named PRD actually exists is a boundary check `check-inbox.mjs` makes across the whole inbox
 * tree, not something one file's text can answer on its own.
 */
const BlockedBySchema = z
  .string()
  .trim()
  .min(1, 'blocked-by is required')
  .transform((raw, ctx) => {
    if (raw === 'none') return 'none';
    const match = raw.match(BLOCKED_BY_LIST);
    if (!match) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'blocked-by must be "none" or a bracketed list of PRD numbers, e.g. [966]',
      });
      return z.NEVER;
    }
    const inner = (match[1] ?? '').trim();
    return inner.length === 0 ? [] : inner.split(',').map((token) => Number(token.trim()));
  });

/**
 * `areas`'s raw string into an array of domain-folder names. Structural only, same reasoning as
 * `blocked-by` — whether a named area is a real folder under the knowledge root, when this
 * repository's laws come from it, is `check-inbox.mjs`'s own cross-file check.
 */
const AreasSchema = z
  .string()
  .trim()
  .transform((raw, ctx) => {
    const match = raw.match(BRACKET_LIST);
    if (!match) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'areas must be a bracketed list of domain folder names, e.g. [credits]',
      });
      return z.NEVER;
    }
    const inner = match[1].trim();
    return inner.length === 0 ? [] : inner.split(',').map((token) => token.trim());
  })
  .optional();

const FrontMatterSchema = z
  .object({
    prd: z.coerce.number({ message: 'prd must be a number' }).int().positive(),
    title: z.string().trim().min(1, 'title is required'),
    'blocked-by': BlockedBySchema,
    spec: z.enum(SPEC_VALUES, { message: `spec must be one of: ${SPEC_VALUES.join(', ')}` }),
    areas: AreasSchema,
  })
  .strict();

function unrecognizedKeyMessage(key) {
  if (key === 'plan') {
    return 'unexpected field "plan" — the plan is always the sibling plan.md, never a front-matter value';
  }
  const named = FORBIDDEN_STATUS_LIKE_FIELDS.includes(key) ? ` — an inbox spec names no ${key}` : '';
  return `unexpected field "${key}"${named}; an inbox spec's front matter holds only prd, title, blocked-by, spec, and an optional areas`;
}

/**
 * Parses one spec's full markdown text into a typed record, or a list of human-readable errors.
 * Pure — no filesystem access, so a fixture string is enough to exercise every case.
 *
 * @param {string} text raw file content
 * @param {{ file?: string | null }} [options] `file` is only used to prefix error messages
 * @returns {{ ok: true, record: object } | { ok: false, errors: string[] }}
 */
export function parseSpec(text, { file = null } = {}) {
  const blockMatch = text.match(FRONT_MATTER_BLOCK);
  if (!blockMatch) {
    return {
      ok: false,
      errors: [withFile(file, 'missing a front-matter block (a "---" fenced header)')],
    };
  }
  const [, rawFrontMatter] = blockMatch;

  const errors = [];
  const { data, errors: lineErrors } = parseFrontMatterLines(rawFrontMatter);
  errors.push(...lineErrors.map((message) => withFile(file, message)));

  const parsed = FrontMatterSchema.safeParse(data);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      if (issue.code === 'unrecognized_keys') {
        for (const key of issue.keys) {
          errors.push(withFile(file, unrecognizedKeyMessage(key)));
        }
        continue;
      }
      const field = issue.path.length > 0 ? issue.path.join('.') : '(front matter)';
      errors.push(withFile(file, `${field}: ${issue.message}`));
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const fm = parsed.data;
  const record = {
    prd: fm.prd,
    title: fm.title,
    blockedBy: fm['blocked-by'],
    spec: fm.spec,
    ...(fm.areas !== undefined ? { areas: fm.areas } : {}),
    file,
  };
  return { ok: true, record };
}

/**
 * Every inbox record, read and parsed through `ctx.layout.specFiles()`. A trusted-reader shape:
 * unlike `check-inbox.mjs` (which grades every folder and collects every violation so a human sees
 * them all at once), this throws on the first malformed spec — a caller composing the backlog
 * (status, collisions, the planner) wants valid records or a loud failure, never a silently partial
 * list.
 *
 * @param {{ ctx: object }} options
 * @returns {{ prd: number, title: string, blockedBy: 'none'|number[], spec: 'file'|'issue', file: string, folder: string }[]}
 */
export function readInbox({ ctx }) {
  const records = [];
  for (const file of ctx.layout.specFiles()) {
    if (!existsSync(join(ctx.root, file))) {
      throw new Error(`readInbox: ${file}: spec.md is missing`);
    }
    const text = readRepoFile(ctx, file);
    const parsed = parseSpec(text, { file });
    if (!parsed.ok) {
      throw new Error(`readInbox: ${parsed.errors.join('; ')}`);
    }
    const { prd, title, blockedBy, spec } = parsed.record;
    records.push({ prd, title, blockedBy, spec, file, folder: basename(dirname(file)) });
  }
  return records;
}
