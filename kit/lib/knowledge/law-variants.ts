/**
 * **Law variants** (PRD 3375): for whom a business law plays out differently. A product keeps them in one
 * JSON file of its law home's knowledge folder, `<knowledgeRoot>/product/law-variants.json`, which a pack
 * carries as it carries the laws, at the same commit:
 *
 * ```json
 * {
 *   "version": 1,
 *   "staleAfterDays": 30,
 *   "audiences": [{ "id": "BETA", "label": "Beta" }],
 *   "variants": [{
 *     "id": "new-planning", "condition": { "kind": "flag", "key": "new-planning" },
 *     "feature": "Where Absences are recorded", "on": "…", "off": "…",
 *     "audiences": { "BETA": "on" }, "laws": ["BL-PLANNING-1"], "legal": [],
 *     "checked": { "how": "live", "on": "2026-11-27", "release": "v3.15.9", "note": null }
 *   }]
 * }
 * ```
 *
 * Every reader (the check, the terminal, the MCP, the page) goes through this module, as every reader of a
 * law goes through `business-laws.ts`. All of it is pure: the clock is always the caller's. A missing file
 * is no variants, and a file that does not read is one note; nothing here throws.
 *
 * {@link parseLawVariants} grades the file alone (its JSON, its schema, unknown keys refused, so a typo never
 * passes as data); {@link lawVariantProblems} what needs more than one field, or the folder's laws, or today.
 * A problem reads `<JSON path> — <what is wrong>`; the check puts the file's path before it.
 */
import { z } from 'zod';
import { diskSource, LEGAL_ID_SHAPE, productDir, type KnowledgeCtx, type KnowledgeSource } from './registers.ts';

/** The file a product's law variants live in, in its knowledge folder's `product/`. */
export const LAW_VARIANTS_FILE = 'law-variants.json';

/** Past this size the check warns: a pack leaves out a file over 1 MiB, so the page would never see it. */
export const LAW_VARIANTS_WARN_BYTES = 512 * 1024;

const DEFAULT_STALE_AFTER_DAYS = 30;
const DAY_SHAPE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Whether `value` is a day of the calendar written `YYYY-MM-DD` (`2026-02-30` is none). */
function isRealDay(value: string): boolean {
  if (!DAY_SHAPE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** The UTC day of a clock, `YYYY-MM-DD`. */
const dayOf = (date: Date): string => date.toISOString().slice(0, 10);

const text = z.string().min(1);
const day = z.string().refine(isRealDay, 'must be a real day, YYYY-MM-DD');
const legalId = z.string().refine((id) => LEGAL_ID_SHAPE.test(id), { error: (issue) => `${String(issue.input)} is not shaped L-<CODE>-<n>` });

const CheckedSchema = z
  .strictObject({
    how: z.enum(['live', 'code', 'unchecked']),
    on: day.nullable().default(null),
    release: z.string().nullable().default(null),
    note: z.string().nullable().default(null),
  })
  .superRefine((checked, issues) => {
    if (checked.how !== 'unchecked' && checked.on === null) issues.addIssue({ code: 'custom', path: ['on'], message: 'a live or code check needs its day' });
  });

const AudienceSchema = z.strictObject({ id: text, label: text, note: z.string().optional() });

const VariantSchema = z.strictObject({
  id: text,
  condition: z.strictObject({ kind: text, key: text }),
  feature: text,
  on: text,
  off: text,
  audiences: z
    .record(z.string(), z.enum(['on', 'off']))
    .refine((map) => Object.keys(map).length > 0, 'must map at least one audience'),
  laws: z.array(text),
  legal: z.array(legalId),
  checked: CheckedSchema,
});

/** Version 1 of `law-variants.json`. */
export const LawVariantsSchema = z.strictObject({
  version: z.literal(1),
  about: z.string().refine((about) => !about.includes('\n'), 'must be one line').optional(),
  staleAfterDays: z.int().min(1).default(DEFAULT_STALE_AFTER_DAYS),
  audiences: z.array(AudienceSchema).min(1),
  variants: z.array(VariantSchema),
});

export type LawVariants = z.output<typeof LawVariantsSchema>;
export type LawVariant = LawVariants['variants'][number];
export type LawVariantCheck = LawVariant['checked'];

/** A file read: its variants, or why it does not read (at least one problem). */
export type LawVariantsRead = { ok: true; value: LawVariants } | { ok: false; problems: string[] };

/** A JSON path as the problems write it: `variants[0].audiences.BETA`. */
function pathText(path: readonly PropertyKey[]): string {
  return path.reduce<string>((at, key) => (typeof key === 'number' ? `${at}[${String(key)}]` : at === '' ? String(key) : `${at}.${String(key)}`), '');
}

/** A problem as every reader prints it: the path, then what is wrong; what is wrong alone for the whole file. */
const problem = (path: readonly PropertyKey[], why: string): string => (path.length === 0 ? why : `${pathText(path)} — ${why}`);

const KIND_WORDS: Record<string, string> = { string: 'text', number: 'a number', int: 'a whole number', array: 'a list', object: 'an object', record: 'an object' };

/** `"a"`, `"a" or "b"`, `"a", "b" or "c"`. */
function choices(values: readonly unknown[]): string {
  const quoted = values.map((value) => JSON.stringify(value));
  return quoted.length < 2 ? quoted.join('') : `${quoted.slice(0, -1).join(', ')} or ${quoted.at(-1) ?? ''}`;
}

/** What a value under its minimum lacks: text that is empty, a list too short, a number too small. */
function tooSmall({ origin, minimum }: { origin: string; minimum: number | bigint }): string {
  if (origin === 'string') return 'must not be empty';
  return origin === 'array' ? `must hold at least ${String(minimum)}` : `must be ${String(minimum)} or more`;
}

/** Plain words for what one schema issue finds wrong at its path. */
function whyOf(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      return issue.input === undefined ? 'is missing' : `must be ${KIND_WORDS[issue.expected] ?? issue.expected}`;
    case 'too_small':
      return tooSmall(issue);
    case 'invalid_value':
      return `must be ${choices(issue.values)}`;
    default:
      return issue.message;
  }
}

/** One schema issue as problems: an unknown key is one problem per key. */
function issueProblems(issue: z.core.$ZodIssue): string[] {
  if (issue.code === 'unrecognized_keys') return issue.keys.map((key) => problem([...issue.path, key], 'not a known field'));
  return [problem(issue.path, whyOf(issue))];
}

/** Reads `law-variants.json`'s text: its JSON and its schema, with what it leaves out defaulted. Never throws. */
export function parseLawVariants(source: string): LawVariantsRead {
  let json: unknown;
  try {
    json = JSON.parse(source);
  } catch (error) {
    return { ok: false, problems: [`does not parse as JSON: ${error instanceof Error ? error.message : String(error)}`] };
  }
  const parsed = LawVariantsSchema.safeParse(json, { reportInput: true });
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, problems: parsed.error.issues.flatMap(issueProblems) };
}

/** Where each id is first used in a list: a later use of it is a duplicate. */
function firstIndexes(ids: readonly string[]): Map<string, number> {
  const first = new Map<string, number>();
  ids.forEach((id, at) => {
    if (!first.has(id)) first.set(id, at);
  });
  return first;
}

/** The problem of the item at `at` of `list` whose `id` an earlier item already uses; none for its first use. */
function duplicateAt(first: ReadonlyMap<string, number>, list: string, id: string, at: number, said: (earlier: string) => string): string[] {
  const seen = first.get(id) ?? at;
  return seen === at ? [] : [problem([list, at, 'id'], said(`${list}[${String(seen)}]`))];
}

/**
 * What a file that reads still gets wrong: an audience or a variant id used twice, an audience a variant maps
 * that the file does not declare, a law that is none of `laws` (the folder's business-law ids; `null` looks
 * none up), and a check dated after `today`.
 */
export function lawVariantProblems(file: LawVariants, { laws, today }: { laws: readonly string[] | null; today: Date }): string[] {
  const declared = new Set(file.audiences.map(({ id }) => id));
  const known = laws === null ? null : new Set(laws);
  const firstAudience = firstIndexes(file.audiences.map(({ id }) => id));
  const firstVariant = firstIndexes(file.variants.map(({ id }) => id));
  const ofVariant = (variant: LawVariant, at: number): string[] => [
    ...duplicateAt(firstVariant, 'variants', variant.id, at, (earlier) => `${variant.id} is already the id of ${earlier}`),
    ...Object.keys(variant.audiences)
      .filter((id) => !declared.has(id))
      .map((id) => problem(['variants', at, 'audiences', id], 'not a declared audience')),
    ...variant.laws.flatMap((id, n) => (known === null || known.has(id) ? [] : [problem(['variants', at, 'laws', n], `${id} is none of this knowledge folder's business laws`)])),
    ...(variant.checked.on !== null && variant.checked.on > dayOf(today) ? [problem(['variants', at, 'checked', 'on'], `${variant.checked.on} is after today, ${dayOf(today)}`)] : []),
  ];
  return [
    ...file.audiences.flatMap(({ id }, at) => duplicateAt(firstAudience, 'audiences', id, at, (earlier) => `${id} is already declared at ${earlier}`)),
    ...file.variants.flatMap(ofVariant),
  ];
}

/** How recent a variant's check is: unchecked, or its age in whole days and whether that is past the file's limit. */
export type Freshness = { state: 'unchecked' } | { state: 'fresh' | 'stale'; days: number };

/** A check's freshness on the caller's clock: day `staleAfterDays` is still fresh, the day after is stale. */
export function freshnessOf(checked: LawVariantCheck, staleAfterDays: number, today: Date): Freshness {
  if (checked.how === 'unchecked' || checked.on === null) return { state: 'unchecked' };
  const days = Math.floor((Date.parse(`${dayOf(today)}T00:00:00Z`) - Date.parse(`${checked.on}T00:00:00Z`)) / DAY_MS);
  return { state: days > staleAfterDays ? 'stale' : 'fresh', days };
}

/** The labels of the audiences a variant maps `on`, in the file's order. */
function onLabels(file: LawVariants, variant: LawVariant): string[] {
  return file.audiences.filter(({ id }) => variant.audiences[id] === 'on').map(({ label }) => label);
}

/** A check in words: `checked live 2026-11-27 · v3.15.9`, `· stale` past the limit; `not checked` when none was made. */
function checkText(file: LawVariants, checked: LawVariantCheck, today: Date): string {
  const freshness = freshnessOf(checked, file.staleAfterDays, today);
  if (freshness.state === 'unchecked') return 'not checked';
  return [`checked ${checked.how} ${checked.on ?? ''}`, checked.release, freshness.state === 'stale' ? 'stale' : null].filter((part) => part !== null).join(' · ');
}

/**
 * One `Differs for:` line per variant naming `id` (a business law in its `laws`, or a Legal entry in its
 * `legal`), in the file's order: `Differs for: Internal, New tenants — Where Absences are recorded (flag
 * remove-absences-sidebar-rh) · checked live 2026-11-27 · v3.15.9`. The terminal indents it; the MCP and
 * the page show it as it is.
 */
export function variantLines(file: LawVariants, id: string, today: Date): string[] {
  return file.variants
    .filter((variant) => variant.laws.includes(id) || variant.legal.includes(id))
    .map((variant) => {
      const labels = onLabels(file, variant);
      const who = labels.length === 0 ? 'none' : labels.join(', ');
      return `Differs for: ${who} — ${variant.feature} (${variant.condition.kind} ${variant.condition.key}) · ${checkText(file, variant.checked, today)}`;
    });
}

/** One field that changed in a variant, in words. */
export type FieldChange = { field: string; from: string; to: string };

/** What changed between two versions of the file: the variants added, removed, and each changed one's fields. */
export type LawVariantsDiff = {
  added: LawVariant[];
  removed: LawVariant[];
  changed: { id: string; feature: string; fields: FieldChange[] }[];
};

const NOTHING = '—';
const listText = (ids: readonly string[]): string => (ids.length === 0 ? NOTHING : ids.join(', '));
const checkedText = ({ how, on }: LawVariantCheck): string => (on === null ? how : `${how} ${on}`);

/** Every field of one variant in words, in the order a change is printed; each audience by its id. */
function fieldsOf(variant: LawVariant, audiences: readonly string[]): [string, string][] {
  return [
    ['feature', variant.feature],
    ['condition', `${variant.condition.kind} ${variant.condition.key}`],
    ['on', variant.on],
    ['off', variant.off],
    ...audiences.map((id): [string, string] => [id, variant.audiences[id] ?? NOTHING]),
    ['laws', listText(variant.laws)],
    ['legal', listText(variant.legal)],
    ['checked', checkedText(variant.checked)],
    ['checked.release', variant.checked.release ?? NOTHING],
    ['checked.note', variant.checked.note ?? NOTHING],
  ];
}

/** Every audience id either side declares or maps, the head's declared order first. */
function audienceIds(base: LawVariants | null, head: LawVariants | null): string[] {
  const declared = [head, base].flatMap((file) => file?.audiences.map(({ id }) => id) ?? []);
  const mapped = [head, base].flatMap((file) => file?.variants.flatMap((variant) => Object.keys(variant.audiences)) ?? []);
  return [...new Set([...declared, ...mapped])];
}

/**
 * What changed from `base` to `head` (either `null` when the file is absent there): the variants added and
 * removed, by id, and per variant on both sides each field that differs as `old → new` (`BETA: off → on`, an
 * audience left out reading `—`). Nothing changed: three empty lists.
 */
export function lawVariantsDiff(base: LawVariants | null, head: LawVariants | null): LawVariantsDiff {
  const before = new Map((base?.variants ?? []).map((variant) => [variant.id, variant]));
  const after = new Map((head?.variants ?? []).map((variant) => [variant.id, variant]));
  const audiences = audienceIds(base, head);
  const changed = [...after.values()].flatMap((variant) => {
    const old = before.get(variant.id);
    if (old === undefined) return [];
    const was = new Map(fieldsOf(old, audiences));
    const fields = fieldsOf(variant, audiences)
      .filter(([field, to]) => was.get(field) !== to)
      .map(([field, to]) => ({ field, from: was.get(field) ?? NOTHING, to }));
    return fields.length === 0 ? [] : [{ id: variant.id, feature: variant.feature, fields }];
  });
  return {
    added: [...after.values()].filter(({ id }) => !before.has(id)),
    removed: [...before.values()].filter(({ id }) => !after.has(id)),
    changed,
  };
}

/** Where a product's variants were found: none, read, or a file that does not read, with the one note every reader shows. */
export type LawVariantsFound =
  | { state: 'none' }
  | { state: 'read'; file: string; variants: LawVariants }
  | { state: 'unreadable'; file: string; problems: string[]; note: string };

/** The file at `path`, read: its variants, or its problems and the note naming the first. */
function found(path: string, source: string): LawVariantsFound {
  const read = parseLawVariants(source);
  if (read.ok) return { state: 'read', file: path, variants: read.value };
  return { state: 'unreadable', file: path, problems: read.problems, note: `law variants: ${path} does not read — ${read.problems[0] ?? 'no problem named'}` };
}

/** Where a knowledge folder keeps its variants. */
const lawVariantsPath = (knowledgeRoot: string): string => `${knowledgeRoot}/product/${LAW_VARIANTS_FILE}`;

/** The variants of a knowledge pack's files (`knowledgeRoot` the folder its config names), as `lawsOfPackFiles` reads its laws. */
export function lawVariantsOfPackFiles(files: readonly { path: string; content: string }[], knowledgeRoot = '.omni-loop/knowledge'): LawVariantsFound {
  const path = lawVariantsPath(knowledgeRoot);
  const file = files.find((one) => one.path === path);
  return file === undefined ? { state: 'none' } : found(path, file.content);
}

/** The variants of the knowledge folder at `ctx`, with the file's size in bytes when there is one. */
export function readLawVariants({ ctx, source = diskSource(ctx.root) }: { ctx: KnowledgeCtx; source?: KnowledgeSource }): LawVariantsFound & { bytes?: number } {
  if (!source.files(productDir(ctx)).includes(LAW_VARIANTS_FILE)) return { state: 'none' };
  const path = `${productDir(ctx)}/${LAW_VARIANTS_FILE}`;
  const content = source.read(path);
  return { ...found(path, content), bytes: new TextEncoder().encode(content).length };
}
