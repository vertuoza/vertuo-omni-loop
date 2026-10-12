/**
 * **How a section is resolved** (PRD #45, slice s1). Three layers per slot, top wins: a pointer,
 * then the repository's section, then the kit default. Each section says where it came from:
 *
 * | the repository section is…        | it resolves to…                                   | label                            |
 * |-----------------------------------|---------------------------------------------------|----------------------------------|
 * | filled                            | the repository text                               | `[repo]`, `[repo · by human]`, `[repo · verified <date>]` |
 * | a `See: <path>` line              | the page it names                                 | `[→ <path>]`                     |
 * | empty                             | the kit default for that slot                     | `[kit default]`                  |
 * | holding `TODO(human)` lines       | the kit default, then each open question          | `[hole]`                         |
 * | in a form with `state: pointer`   | the whole target: a file's text; a folder's `index`, else its Markdown file list | `[→ <path>]` |
 * | in a form file that is missing    | the kit default for every slot                    | `[kit default]`                  |
 *
 * A kit default made only of `TODO(human)` lines (PRD 1369: the design form's `product` and
 * `system`, which only the repository can answer) is no default: a section that falls through to
 * it is a `[hole]` holding the kit's questions, and a repository's own questions replace them.
 *
 * The kit default is passed in: the text of the kit's template for the form, which parses with
 * the same parser and whose slot bodies are the defaults. This module reads no template itself.
 * The sections come in the template's order, under its headings; a slot the template does not
 * define is the check's to report, not this module's to show.
 *
 * A kit default may name a config value as `{config:<key>}`, filled from `ctx.config`. A key the
 * config does not hold, or one holding no single value (unset, a list, a section), is left visible
 * as written and reported: an honest placeholder, never a guess. The repository's own text is
 * never filled.
 *
 * Nothing here throws on a repository's content: a dead pointer or a form that does not parse is
 * reported in `problems`, one `file: detail` line each, and the kit default shows through.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Context } from '../context.ts';
import { defined } from '../narrow.ts';
import { parseForm, readForm } from './forms.ts';
import type { Form, FormState, Slot } from './forms.ts';

/** A config value by its key: its text, or why it holds none. */
type ConfigValue = { ok: true; text: string } | { ok: false; reason: string };

/** A `{config:<key>}` placeholder left as written, and why. */
export type Unresolved = { key: string; reason: string };

/** Where a resolved section came from. */
export type SectionSource = 'repo' | 'pointer' | 'kit' | 'hole';

/** One resolved section: `slot` is `null` for a pointer form's one section. */
export type Section = {
  slot: string | null;
  heading: string | null;
  source: SectionSource;
  label: string;
  text: string;
  questions: string[];
};

/** A form resolved over its template, as `omni kb show` prints it. */
export type ResolvedForm = {
  form: string;
  file: string;
  state: FormState | 'missing' | 'invalid';
  title: string | null;
  sections: Section[];
  problems: string[];
};

/** What resolving reads of a context. */
type Ctx = Pick<Context, 'root' | 'layout' | 'config'>;

const CONFIG_PLACEHOLDER = /\{config:([^{}\s]+)\}/g;

/** One config value by its dotted key, walked as `omni config <key>` walks it. */
function configValue(config: unknown, key: string): ConfigValue {
  let value: unknown = config;
  for (const part of key.split('.')) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, part)) {
      return { ok: false, reason: 'names no config key' };
    }
    const next: unknown = Reflect.get(value, part);
    value = next;
  }
  if (['string', 'number', 'boolean'].includes(typeof value)) return { ok: true, text: String(value) };
  if (value === null) return { ok: false, reason: 'is not set in the config' };
  return { ok: false, reason: 'holds no single value' };
}

/**
 * Fills every `{config:<key>}` in `text` from `config`. `{ text, unresolved: [{ key, reason }] }`:
 * a placeholder that cannot be filled stays in `text` exactly as written.
 */
export function fillConfig(text: string, config: unknown): { text: string; unresolved: Unresolved[] } {
  const unresolved: Unresolved[] = [];
  const filled = text.replace(CONFIG_PLACEHOLDER, (placeholder: string, key: string) => {
    const value = configValue(config, key);
    if (value.ok) return value.text;
    unresolved.push({ key, reason: value.reason });
    return placeholder;
  });
  return { text: filled, unresolved };
}

/**
 * The text a repository path shows: a file's text; a folder's `index` when one is given, else the
 * folder's Markdown files, one path a line. `{ text, missing }`, `missing` naming the path that
 * does not exist.
 */
function readTarget(path: string, index: string | null, { ctx }: { ctx: Pick<Context, 'root'> }): { text: string; missing: string | null } {
  const absolute = join(ctx.root, path);
  if (!existsSync(absolute)) return { text: '', missing: path };
  if (!statSync(absolute).isDirectory()) return { text: readFileSync(absolute, 'utf8').trim(), missing: null };
  if (index) return readTarget(index, null, { ctx });
  const dir = path.replace(/\/+$/, '');
  const pages = readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => `${dir}/${entry.name}`)
    .sort();
  return { text: pages.join('\n'), missing: null };
}

/** `[repo]`, `[repo · by human]`, `[repo · verified <date>]`, or both. */
function repoLabel(slot: Slot): string {
  const parts = ['repo'];
  if (slot.by === 'human') parts.push('by human');
  if (slot.verified) parts.push(`verified ${slot.verified}`);
  return `[${parts.join(' · ')}]`;
}

/** One slot, resolved from the repository's slot (or `null`) over the template's. */
function resolveSlot(
  kitSlot: Slot,
  repoSlot: Slot | null,
  { ctx, formId, file, problems }: { ctx: Ctx; formId: string; file: string; problems: string[] },
): Section {
  const base = { slot: kitSlot.id, heading: kitSlot.heading };
  const body = repoSlot?.body ?? null;

  if (repoSlot !== null && body?.kind === 'text') {
    return { ...base, source: 'repo', label: repoLabel(repoSlot), text: body.text, questions: body.questions };
  }
  if (repoSlot !== null && body?.kind === 'pointer') {
    const { path, anchor } = body.see;
    const target = readTarget(path, null, { ctx });
    if (target.missing) problems.push(`${file}: "## ${repoSlot.heading}" See: ${path} does not exist`);
    const pointer = anchor ? `${path}#${anchor}` : path;
    return { ...base, source: 'pointer', label: `[→ ${pointer}]`, text: target.text, questions: [] };
  }

  const kit = fillConfig(kitSlot.body.text, ctx.config);
  for (const { key, reason } of kit.unresolved) {
    problems.push(`kit default ${formId}#${kitSlot.id}: {config:${key}} ${reason}`);
  }
  const kitHoles = kitSlot.body.kind === 'holes';
  if (body?.kind === 'holes') {
    return { ...base, source: 'hole', label: '[hole]', text: kitHoles ? '' : kit.text, questions: body.questions };
  }
  if (kitHoles) return { ...base, source: 'hole', label: '[hole]', text: '', questions: kitSlot.body.questions };
  return { ...base, source: 'kit', label: '[kit default]', text: kit.text, questions: [] };
}

/**
 * Resolves the form `formId` of the repository at `ctx`, over `template`, the text of the kit's
 * template for it.
 *
 * `{ form, file, state, title, sections: [{ slot, heading, source, label, text, questions }],
 * problems }`: `state` is the form's own (`blank`, `filled`, `pointer`), or `missing` when its file
 * is not there, or `invalid` when it does not parse; `source` is `repo`, `pointer`, `kit` or
 * `hole`. A pointer form resolves to one section, its whole target, with `slot: null`.
 */
export function resolveForm(formId: string, { ctx, template }: { ctx: Ctx; template: string }): ResolvedForm {
  const kit = parseForm(template, { file: `kit template ${formId}` });
  if (!kit.ok) throw new Error(`the kit's template for ${formId} does not parse:\n${kit.errors.join('\n')}`);

  const read = readForm(formId, { ctx });
  const { file } = read;
  const problems: string[] = [];
  let repo: Form | null = null;
  let state: ResolvedForm['state'] = 'missing';
  if (read.exists && read.ok) {
    repo = read.form;
    state = repo.state;
  } else if (read.exists) {
    state = 'invalid';
    problems.push(...read.errors);
  }
  const title = repo?.title ?? kit.form.title;

  if (repo?.state === 'pointer') {
    const target = readTarget(defined(repo.pointsTo, `the points-to of ${file}`), repo.index, { ctx }); // a pointer form always names points-to (its schema refuses one without)
    if (target.missing) problems.push(`${file}: ${target.missing === repo.pointsTo ? 'points-to' : 'index'} ${target.missing} does not exist`);
    const section: Section = { slot: null, heading: title, source: 'pointer', label: `[→ ${repo.pointsTo}]`, text: target.text, questions: [] };
    return { form: formId, file, state, title, sections: [section], problems };
  }

  const sections = kit.form.slots.map((kitSlot) => {
    const repoSlot = repo?.slots.find((slot) => slot.id === kitSlot.id) ?? null;
    return resolveSlot(kitSlot, repoSlot, { ctx, formId, file, problems });
  });
  return { form: formId, file, state, title, sections, problems };
}
