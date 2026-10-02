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
import { readRepoFile } from '../check-report.ts';
import { parseFrontMatterLines, withFile } from '../front-matter.ts';
import { SPEC_VALUES, SpecFrontMatterSchema } from '../schema/front-matter.ts';
import { KIT_MESSAGES } from '../schema/messages.ts';
import type { Context } from '../context.ts';
import type { InboxItem } from '../types.ts';

export { SPEC_VALUES };

/** A spec parsed: its record, or every reason it was refused. */
export type ParsedSpec = { ok: true; record: InboxItem; errors?: undefined } | { ok: false; errors: string[]; record?: undefined };

/** One inbox record as `readInbox` returns it: the spec's fields, its file and its folder's name. */
export type InboxRecord = Pick<InboxItem, 'prd' | 'title' | 'blockedBy' | 'spec'> & { file: string; folder: string };

const FRONT_MATTER_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
/** Front-matter field names this schema never admits — named so a refusal can quote the field. */
const FORBIDDEN_STATUS_LIKE_FIELDS = ['status', 'branch', 'value', 'priority'];

function unrecognizedKeyMessage(key: string): string {
  if (key === 'plan') {
    return 'unexpected field "plan" — the plan is always the sibling plan.md, never a front-matter value';
  }
  const named = FORBIDDEN_STATUS_LIKE_FIELDS.includes(key) ? ` — an inbox spec names no ${key}` : '';
  return `unexpected field "${key}"${named}; an inbox spec's front matter holds only prd, title, blocked-by, spec, and an optional areas and proof`;
}

/**
 * Parses one spec's full markdown text into a typed record, or a list of human-readable errors.
 * Pure — no filesystem access, so a fixture string is enough to exercise every case.
 *
 * @param {string} text raw file content
 * @param {{ file?: string | null }} [options] `file` is only used to prefix error messages
 * @returns {{ ok: true, record: object } | { ok: false, errors: string[] }}
 */
export function parseSpec(text: string, { file = null }: { file?: string | null } = {}): ParsedSpec {
  const blockMatch = text.match(FRONT_MATTER_BLOCK);
  if (!blockMatch) {
    return {
      ok: false,
      errors: [withFile(file, 'missing a front-matter block (a "---" fenced header)')],
    };
  }
  const [, rawFrontMatter] = blockMatch;

  const errors: string[] = [];
  const { data, errors: lineErrors } = parseFrontMatterLines(rawFrontMatter ?? '');
  errors.push(...lineErrors.map((message) => withFile(file, message)));

  const parsed = SpecFrontMatterSchema.safeParse(data, { error: KIT_MESSAGES });
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

  // A refused parse always pushed at least one error, so `!parsed.success` adds no case.
  if (errors.length > 0 || !parsed.success) return { ok: false, errors };

  const fm = parsed.data;
  const record: InboxItem = {
    prd: fm.prd,
    title: fm.title,
    blockedBy: fm['blocked-by'],
    spec: fm.spec,
    ...(fm.areas !== undefined ? { areas: fm.areas } : {}),
    ...(fm.proof !== undefined ? { proof: fm.proof } : {}),
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
export function readInbox({ ctx }: { ctx: Pick<Context, 'root' | 'layout'> }): InboxRecord[] {
  const records: InboxRecord[] = [];
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
