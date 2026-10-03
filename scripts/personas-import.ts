#!/usr/bin/env node
// node scripts/personas-import.ts <workspace-id> <file.json> [--write] — imports a workspace's
// personas once, from a file kept outside the repository (PRD 799, spec: .omni-loop/delivery/inbox/
// 0799-business-personas/spec.md). Needs SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and
// SUPABASE_SERVICE_ROLE_KEY: `node --env-file=apps/galaxy/.env.local scripts/personas-import.ts …`.
//
// The file is a JSON array of personas:
//   { "product": "<product name>", "name", "stance": "excited|neutral|skeptical", "trade": "<trade id>",
//     "who", "usage", "avatar": { "v": 1, "skin", "hair", "hairColor", "outfit", "accessory" } }
// `product` may be left out when the workspace has one product; `avatar` may be left out, and one is
// picked from the row's product and name, the same every run; `who` and `usage` default to empty.
//
// Without --write it is a dry run: it prints the workspace's name and every row it would add, and
// writes nothing. Every row is checked first, as public.persona_fields() does, against the trades and
// avatar ranges of packages/design: one invalid row refuses the whole file, naming the row and the
// field, and nothing is written. --write then adds each row through persona_add() as the service role.
// A persona whose name is already on its product is left as it is and not added again, so a rerun
// after a refused write adds only the rest. It never changes or deletes a persona.
//
// Exit codes: 0 done (or dry run), 1 refused.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { PERSONA_TRADES, randomAvatar, validPersonaAvatar } from '../packages/design/src/index.ts';
import type { PersonaAvatar } from '../packages/design/src/index.ts';
import { EnvError, readEnv, processEnv, requireGroup, SUPABASE, type EnvSource, type SupabaseEnv } from '../kit/lib/env/read.ts';
import { plainText } from '../kit/lib/outbox/plain-text.ts';
import { parseOrThrow } from '../kit/lib/schema/parse-or-throw.ts';

const STANCES = ['excited', 'neutral', 'skeptical'] as const;
const KEYS = ['product', 'name', 'stance', 'trade', 'who', 'usage', 'avatar'];
const TRADES = new Set<string>(PERSONA_TRADES.map((t) => t.id));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USAGE = 'usage: node scripts/personas-import.ts <workspace-id> <file.json> [--write]';

type Stance = (typeof STANCES)[number];

/** One product of the workspace. */
type Product = { id: string; name: string };

/** A persona as a row of the file describes it, before its fields are checked. */
type Persona = { name: string | null; stance: unknown; trade: unknown; avatar: unknown; who: string | null; usage: string | null };

/** A persona whose every field passed its rule. */
type CheckedPersona = { name: string; stance: Stance; trade: string; avatar: PersonaAvatar; who: string; usage: string };

/** A checked row, ready to add. */
type ReadyRow = CheckedPersona & { row: number; productId: string; productName: string };

const trimmed = (v: unknown): string | null => (typeof v === 'string' ? v.trim() : v == null ? '' : null);
const fold = (s: string): string => s.trim().toLowerCase();
const isRecord = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
const personaKey = (productId: string, name: string): string => `${productId}\n${name}`;

const nameError = (v: string | null): string | null =>
  v === null || v.length < 1 || v.length > 40 || /[\r\n\t]/.test(v) ? 'name: 1 to 40 characters, on one line' : null;
const textError =
  (field: string) =>
  (v: string | null): string | null =>
    v === null || v.length > 400 ? `${field}: a text of 400 characters at most` : null;
const isStance = (v: unknown): v is Stance => STANCES.some((stance) => stance === v);

/** Each field's rule, the same as public.persona_fields(): the field's error, or null. */
const FIELD_RULES: { [F in keyof Persona]: (v: Persona[F]) => string | null } = {
  name: nameError,
  stance: (v) => (isStance(v) ? null : 'stance: excited, neutral or skeptical'),
  trade: (v) => (typeof v === 'string' && TRADES.has(v) ? null : `trade: one of ${[...TRADES].join(', ')}`),
  who: textError('who'),
  usage: textError('usage'),
  avatar: (v) => (validPersonaAvatar(v) ? null : 'avatar: {v 1, skin 0–5, hair 0–5, hairColor 0–3, outfit 0–3, accessory 0–3}'),
};

/** The first error of a persona's fields, in the order `personaOf` gives them, or undefined. */
const personaError = (persona: Persona): string | undefined =>
  [
    FIELD_RULES.name(persona.name),
    FIELD_RULES.stance(persona.stance),
    FIELD_RULES.trade(persona.trade),
    FIELD_RULES.avatar(persona.avatar),
    FIELD_RULES.who(persona.who),
    FIELD_RULES.usage(persona.usage),
  ].find((error): error is string => Boolean(error));

/** Whether every field of `persona` passed its rule. */
const isChecked = (persona: Persona): persona is Persona & CheckedPersona => personaError(persona) === undefined;

/** How an error names a row: `row <n>`, and its name when it has one. */
function rowLabel(raw: Record<string, unknown>, n: number): string {
  const shown = typeof raw.name === 'string' ? raw.name.replace(/\s+/g, ' ').trim() : '';
  return `row ${n}${shown ? ` (${shown})` : ''}`;
}

/** The error of a row's unknown fields, or null. */
function unknownFieldsError(raw: Record<string, unknown>): string | null {
  const unknown = Object.keys(raw).filter((k) => !KEYS.includes(k));
  return unknown.length ? `${unknown.join(', ')}: unknown field (a persona has ${KEYS.join(', ')})` : null;
}

/** The row's product among `products` ({product}), or why it names none ({error}). */
function productOf(raw: Record<string, unknown>, products: Product[]): { product: Product } | { error: string } {
  const [only] = products;
  if (raw.product == null && products.length === 1 && only) return { product: only };
  const names = products.map((p) => p.name).join(', ');
  const named = raw.product;
  if (typeof named !== 'string') return { error: `product: name the product it belongs to (${names})` };
  const matches = products.filter((p) => fold(p.name) === fold(named));
  const [match] = matches;
  return matches.length === 1 && match
    ? { product: match }
    : { error: `product: "${named}" is not one product of this workspace (${names})` };
}

/** The persona a row describes, trimmed, with an avatar picked from its product and name when it has none. */
function personaOf(raw: Record<string, unknown>, product: Product): Persona {
  return {
    name: trimmed(raw.name),
    stance: raw.stance,
    trade: typeof raw.trade === 'string' ? raw.trade.trim() : raw.trade,
    avatar: raw.avatar === undefined ? randomAvatar(`${product.id}/${trimmed(raw.name)}`) : raw.avatar,
    who: trimmed(raw.who),
    usage: trimmed(raw.usage),
  };
}

/** One row on its own: its {label, product, persona}, or its {error}. */
type CheckedRow = { label: string; product: Product; persona: CheckedPersona };

function checkRow(raw: unknown, n: number, products: Product[]): CheckedRow | { error: string } {
  if (!isRecord(raw)) return { error: `row ${n}: a persona is an object with ${KEYS.join(', ')}` };
  const label = rowLabel(raw, n);
  const unknown = unknownFieldsError(raw);
  if (unknown) return { error: `${label}: ${unknown}` };
  const found = productOf(raw, products);
  if ('error' in found) return { error: `${label}: ${found.error}` };
  const { product } = found;
  const persona = personaOf(raw, product);
  return isChecked(persona) ? { label, product, persona } : { error: `${label}: ${personaError(persona)}` };
}

/** The error of a row whose name is already on its product at an earlier row (`seen`), or null. */
function duplicateError({ label, product, persona }: CheckedRow, seen: Map<string, number>): string | null {
  const at = seen.get(personaKey(product.id, persona.name));
  return at === undefined ? null : `${label}: name: "${persona.name}" is on ${product.name} already, at row ${at}`;
}

/**
 * Checks every row of `rows` against the workspace's `products` ({id, name}). Returns the rows ready to
 * add ({row, productId, productName, name, stance, trade, avatar, who, usage}) and one error line per
 * refused row, `row <n> (<name>): <field>: …`. Any error refuses the whole file.
 */
export function checkRows(rows: unknown, products: Product[]): { rows: ReadyRow[]; errors: string[] } {
  if (!Array.isArray(rows)) return { rows: [], errors: ['the file must hold a JSON array of personas'] };
  const ready: ReadyRow[] = [];
  const errors: string[] = [];
  const seen = new Map<string, number>();
  rows.forEach((raw: unknown, i) => {
    const n = i + 1;
    const checked = checkRow(raw, n, products);
    if ('error' in checked) {
      errors.push(checked.error);
      return;
    }
    const duplicate = duplicateError(checked, seen);
    if (duplicate) {
      errors.push(duplicate);
      return;
    }
    const { product, persona } = checked;
    seen.set(personaKey(product.id, persona.name), n);
    ready.push({ row: n, productId: product.id, productName: product.name, ...persona });
  });
  return { rows: ready, errors };
}

/** What Supabase answers each read with, checked before use. */
const NamedRowsSchema = z.array(z.object({ id: z.string(), name: z.string() }));
const PersonaRowsSchema = z.array(z.object({ product_id: z.string(), name: z.string() }));
/** A refusal's body: PostgREST's error fields, each as it came. */
const RefusalSchema = z.object({ code: z.unknown(), message: z.unknown(), hint: z.unknown() }).partial();

/** `value`, what Supabase answered `path` with, parsed by `schema`; else an error naming the field. */
function answer<S extends z.ZodType>(schema: S, value: unknown, path: string): z.infer<S> {
  return parseOrThrow(schema, value, `Supabase answered ${path.split('?')[0]} with an unexpected shape`);
}

/** The reads the import needs, and persona_add(). */
type PersonaStore = {
  workspace(id: string): Promise<Product | null>;
  products(workspaceId: string): Promise<Product[]>;
  personas(workspaceId: string): Promise<Array<{ productId: string; name: string }>>;
  add(workspaceId: string, p: Omit<ReadyRow, 'row' | 'productName'>): Promise<void>;
};

/** Supabase's REST API as the service role: the reads the import needs, and persona_add(). */
export function restStore({ url, key, fetch = globalThis.fetch }: { url: string; key: string; fetch?: typeof globalThis.fetch }): PersonaStore {
  const base = `${url.replace(/\/+$/, '')}/rest/v1`;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  async function call(path: string, init: RequestInit = {}): Promise<unknown> {
    const res = await fetch(`${base}/${path}`, { ...init, headers });
    if (!res.ok) {
      const raw: unknown = await res.json().catch(() => ({}));
      const parsed = RefusalSchema.safeParse(raw);
      const body = parsed.success ? parsed.data : {};
      // A hint is text; one that is not reads as none, where `String()` wrote out `[object Object]`.
      const hint = body.hint ? plainText(body.hint) : '';
      const said = [body.code, body.message, hint && `(${hint})`].filter(Boolean).join(' ');
      throw new Error(`Supabase refused (${res.status})${said ? `: ${said}` : ''}`);
    }
    return res.json();
  }
  const q = encodeURIComponent;
  return {
    async workspace(id) {
      const path = `workspaces?select=id,name&id=eq.${q(id)}`;
      const [found] = answer(NamedRowsSchema, await call(path), path);
      return found ?? null;
    },
    async products(workspaceId) {
      const path = `products?select=id,name&workspace_id=eq.${q(workspaceId)}&order=ordinal`;
      return answer(NamedRowsSchema, await call(path), path);
    },
    async personas(workspaceId) {
      const path = `personas?select=product_id,name&workspace_id=eq.${q(workspaceId)}`;
      const rows = answer(PersonaRowsSchema, await call(path), path);
      return rows.map((r) => ({ productId: r.product_id, name: r.name }));
    },
    async add(workspaceId, p) {
      await call('rpc/persona_add', {
        method: 'POST',
        body: JSON.stringify({
          p_workspace: workspaceId, p_product: p.productId, p_name: p.name, p_stance: p.stance,
          p_trade: p.trade, p_avatar: p.avatar, p_who: p.who, p_usage: p.usage,
        }),
      });
    },
  };
}

const describeRow = (p: ReadyRow): string => `row ${p.row}  ${p.name} · ${p.trade} · ${p.stance} → ${p.productName}`;

/** A refused run: the lines it prints on stderr before it exits 1. */
class Refused extends Error {
  lines: string[];

  constructor(lines: string[]) {
    super(lines.join('\n'));
    this.lines = lines;
  }
}

function refuse(...lines: string[]): never {
  throw new Refused(lines);
}

const connectTo = (pair: SupabaseEnv): PersonaStore => restStore(pair);
const readText = (file: string): string => readFileSync(file, 'utf8');

/** The run's workspace id, file and --write, or a refusal with the usage. */
function argsOf(argv: string[]): { workspaceId: string; file: string; write: boolean } {
  const args = argv.filter((a) => a !== '--write');
  const [workspaceId, file] = args;
  if (args.length !== 2 || workspaceId === undefined || file === undefined || args.some((a) => a.startsWith('--'))) refuse(USAGE);
  if (!UUID.test(workspaceId)) refuse(`personas-import: "${workspaceId}" is not a workspace id (a uuid)\n${USAGE}`);
  return { workspaceId, file, write: argv.includes('--write') };
}

function rowsOf(read: (file: string) => string, file: string): unknown {
  try {
    return JSON.parse(read(file));
  } catch (error) {
    return refuse(`personas-import: ${file} is not a JSON file: ${messageOf(error)}`);
  }
}

/** The Supabase pair the store needs, or a refusal naming every variable that is unset or wrong. */
function supabaseOf(env: EnvSource): SupabaseEnv {
  try {
    return requireGroup(readEnv(env).supabase, SUPABASE, 'personas-import writes the personas (locally, `npx supabase status` prints both)');
  } catch (error) {
    if (!(error instanceof EnvError)) throw error;
    return refuse(`personas-import: ${error.message}`);
  }
}

/** The workspace with its products and the personas already there; null when no workspace has the id. */
type FoundWorkspace = { workspace: Product; products: Product[]; existing: Array<{ productId: string; name: string }> };

async function fetchWorkspace(store: PersonaStore, workspaceId: string): Promise<FoundWorkspace | null> {
  try {
    const workspace = await store.workspace(workspaceId);
    if (!workspace) return null;
    return { workspace, products: await store.products(workspaceId), existing: await store.personas(workspaceId) };
  } catch (error) {
    return refuse(`personas-import: ${messageOf(error)}`);
  }
}

async function readWorkspace(store: PersonaStore, workspaceId: string): Promise<FoundWorkspace> {
  const found = await fetchWorkspace(store, workspaceId);
  if (!found) refuse(`personas-import: no workspace has the id ${workspaceId}; nothing written`);
  return found;
}

/** The checked rows not on their product yet; refuses the file on any invalid row. */
function rowsToAdd(rows: unknown, products: Product[], existing: FoundWorkspace['existing'], out: (line: string) => void): ReadyRow[] {
  const checked = checkRows(rows, products);
  const count = checked.errors.length;
  if (count) refuse(...checked.errors, `personas-import: the file is refused, ${plural(count, 'row')} above; nothing written`);
  const there = new Set(existing.map((p) => personaKey(p.productId, p.name)));
  const toAdd = checked.rows.filter((p) => !there.has(personaKey(p.productId, p.name)));
  for (const p of checked.rows) if (!toAdd.includes(p)) out(`${describeRow(p)}  — already there, left as it is`);
  return toAdd;
}

/** Adds each row in turn; stops at the first refused one, saying how many were added before it. */
async function addAll(store: PersonaStore, workspaceId: string, toAdd: ReadyRow[], out: (line: string) => void): Promise<number> {
  let added = 0;
  for (const p of toAdd) {
    try {
      await store.add(workspaceId, p);
    } catch (error) {
      refuse(
        `row ${p.row} (${p.name}): ${messageOf(error)}`,
        `personas-import: stopped; added ${added} before it. Fix the cause and rerun: personas already there are skipped.`,
      );
    }
    added += 1;
    out(`${describeRow(p)}  — added`);
  }
  return added;
}

type ImportInput = {
  argv: string[];
  env: EnvSource;
  connect?: (pair: SupabaseEnv) => PersonaStore;
  read?: (file: string) => string;
  out?: (line: string) => void;
  err?: (line: string) => void;
};

async function runImport({ argv, env, connect, read, out }: Required<Omit<ImportInput, 'err'>>): Promise<number> {
  const { workspaceId, file, write } = argsOf(argv);
  const rows = rowsOf(read, file);
  const store = connect(supabaseOf(env));
  const { workspace, products, existing } = await readWorkspace(store, workspaceId);
  out(`workspace: ${workspace.name} (${workspaceId})`);
  if (!products.length) refuse(`personas-import: ${workspace.name} has no product yet (Settings › Business); nothing written`);
  const toAdd = rowsToAdd(rows, products, existing, out);
  if (!write) {
    for (const p of toAdd) out(describeRow(p));
    out(`would add ${plural(toAdd.length, 'persona')} to ${workspace.name}. Dry run: nothing written; add --write to add them.`);
    return 0;
  }
  const added = await addAll(store, workspaceId, toAdd, out);
  out(`added ${plural(added, 'persona')} to ${workspace.name}`);
  return 0;
}

/** One run of the import; returns the exit code. `connect` gives the store from the environment. */
export async function importPersonas({ argv, env, connect = connectTo, read = readText, out = console.log, err = console.error }: ImportInput): Promise<number> {
  try {
    return await runImport({ argv, env, connect, read, out });
  } catch (error) {
    if (!(error instanceof Refused)) throw error;
    for (const line of error.lines) err(line);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await importPersonas({ argv: process.argv.slice(2), env: processEnv() }));
}
