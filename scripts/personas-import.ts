#!/usr/bin/env node
// @ts-nocheck
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
import { PERSONA_TRADES, randomAvatar, validPersonaAvatar } from '../packages/design/src/index.ts';

const STANCES = ['excited', 'neutral', 'skeptical'];
const KEYS = ['product', 'name', 'stance', 'trade', 'who', 'usage', 'avatar'];
const TRADES = new Set(PERSONA_TRADES.map((t) => t.id));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USAGE = 'usage: node scripts/personas-import.ts <workspace-id> <file.json> [--write]';

const trimmed = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : null);
const fold = (s) => s.trim().toLowerCase();
const isRecord = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const messageOf = (error) => (error instanceof Error ? error.message : String(error));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const personaKey = (productId, name) => `${productId}\n${name}`;

const nameError = (v) =>
  v === null || v.length < 1 || v.length > 40 || /[\r\n\t]/.test(v) ? 'name: 1 to 40 characters, on one line' : null;
const textError = (field) => (v) => (v === null || v.length > 400 ? `${field}: a text of 400 characters at most` : null);

/** Each field's rule, the same as public.persona_fields(): the field's error, or null. */
const FIELD_RULES = {
  name: nameError,
  stance: (v) => (STANCES.includes(v) ? null : 'stance: excited, neutral or skeptical'),
  trade: (v) => (typeof v === 'string' && TRADES.has(v) ? null : `trade: one of ${[...TRADES].join(', ')}`),
  who: textError('who'),
  usage: textError('usage'),
  avatar: (v) => (validPersonaAvatar(v) ? null : 'avatar: {v 1, skin 0–5, hair 0–5, hairColor 0–3, outfit 0–3, accessory 0–3}'),
};

/** The first error of a persona's fields, or undefined. */
const personaError = (persona) => Object.keys(persona).map((f) => FIELD_RULES[f](persona[f])).find(Boolean);

/** How an error names a row: `row <n>`, and its name when it has one. */
function rowLabel(raw, n) {
  const shown = typeof raw.name === 'string' ? raw.name.replace(/\s+/g, ' ').trim() : '';
  return `row ${n}${shown ? ` (${shown})` : ''}`;
}

/** The error of a row's unknown fields, or null. */
function unknownFieldsError(raw) {
  const unknown = Object.keys(raw).filter((k) => !KEYS.includes(k));
  return unknown.length ? `${unknown.join(', ')}: unknown field (a persona has ${KEYS.join(', ')})` : null;
}

/** The row's product among `products` ({product}), or why it names none ({error}). */
function productOf(raw, products) {
  if (raw.product == null && products.length === 1) return { product: products[0] };
  const names = products.map((p) => p.name).join(', ');
  if (typeof raw.product !== 'string') return { error: `product: name the product it belongs to (${names})` };
  const matches = products.filter((p) => fold(p.name) === fold(raw.product));
  return matches.length === 1
    ? { product: matches[0] }
    : { error: `product: "${raw.product}" is not one product of this workspace (${names})` };
}

/** The persona a row describes, trimmed, with an avatar picked from its product and name when it has none. */
function personaOf(raw, product) {
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
function checkRow(raw, n, products) {
  if (!isRecord(raw)) return { error: `row ${n}: a persona is an object with ${KEYS.join(', ')}` };
  const label = rowLabel(raw, n);
  const unknown = unknownFieldsError(raw);
  if (unknown) return { error: `${label}: ${unknown}` };
  const { product, error } = productOf(raw, products);
  if (error) return { error: `${label}: ${error}` };
  const persona = personaOf(raw, product);
  const refused = personaError(persona);
  return refused ? { error: `${label}: ${refused}` } : { label, product, persona };
}

/** The error of a row whose name is already on its product at an earlier row (`seen`), or null. */
function duplicateError({ label, product, persona }, seen) {
  const at = seen.get(personaKey(product.id, persona.name));
  return at === undefined ? null : `${label}: name: "${persona.name}" is on ${product.name} already, at row ${at}`;
}

/**
 * Checks every row of `rows` against the workspace's `products` ({id, name}). Returns the rows ready to
 * add ({row, productId, productName, name, stance, trade, avatar, who, usage}) and one error line per
 * refused row, `row <n> (<name>): <field>: …`. Any error refuses the whole file.
 */
export function checkRows(rows, products) {
  if (!Array.isArray(rows)) return { rows: [], errors: ['the file must hold a JSON array of personas'] };
  const ready = [];
  const errors = [];
  const seen = new Map();
  rows.forEach((raw, i) => {
    const n = i + 1;
    const checked = checkRow(raw, n, products);
    const error = checked.error ?? duplicateError(checked, seen);
    if (error) {
      errors.push(error);
      return;
    }
    const { product, persona } = checked;
    seen.set(personaKey(product.id, persona.name), n);
    ready.push({ row: n, productId: product.id, productName: product.name, ...persona });
  });
  return { rows: ready, errors };
}

/** Supabase's REST API as the service role: the reads the import needs, and persona_add(). */
export function restStore({ url, key, fetch = globalThis.fetch }) {
  const base = `${url.replace(/\/+$/, '')}/rest/v1`;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  async function call(path, init = {}) {
    const res = await fetch(`${base}/${path}`, { ...init, headers });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const said = [body.code, body.message, body.hint && `(${body.hint})`].filter(Boolean).join(' ');
      throw new Error(`Supabase refused (${res.status})${said ? `: ${said}` : ''}`);
    }
    return res.json();
  }
  const q = encodeURIComponent;
  return {
    async workspace(id) {
      const [found] = await call(`workspaces?select=id,name&id=eq.${q(id)}`);
      return found ?? null;
    },
    async products(workspaceId) {
      return call(`products?select=id,name&workspace_id=eq.${q(workspaceId)}&order=ordinal`);
    },
    async personas(workspaceId) {
      const rows = await call(`personas?select=product_id,name&workspace_id=eq.${q(workspaceId)}`);
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

const describeRow = (p) => `row ${p.row}  ${p.name} · ${p.trade} · ${p.stance} → ${p.productName}`;

/** A refused run: the lines it prints on stderr before it exits 1. */
class Refused extends Error {
  constructor(lines) {
    super(lines.join('\n'));
    this.lines = lines;
  }
}

function refuse(...lines) {
  throw new Refused(lines);
}

const connectFromEnv = (e) => restStore({ url: e.SUPABASE_URL || e.NEXT_PUBLIC_SUPABASE_URL, key: e.SUPABASE_SERVICE_ROLE_KEY });
const readText = (file) => readFileSync(file, 'utf8');

/** The run's workspace id, file and --write, or a refusal with the usage. */
function argsOf(argv) {
  const args = argv.filter((a) => a !== '--write');
  if (args.length !== 2 || args.some((a) => a.startsWith('--'))) refuse(USAGE);
  const [workspaceId, file] = args;
  if (!UUID.test(workspaceId)) refuse(`personas-import: "${workspaceId}" is not a workspace id (a uuid)\n${USAGE}`);
  return { workspaceId, file, write: argv.includes('--write') };
}

function rowsOf(read, file) {
  try {
    return JSON.parse(read(file));
  } catch (error) {
    return refuse(`personas-import: ${file} is not a JSON file: ${messageOf(error)}`);
  }
}

/** Refuses when a variable the store needs is not set, naming each one. */
function checkEnv(env) {
  const missing = [
    !(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL)?.trim() && 'SUPABASE_URL',
    !env.SUPABASE_SERVICE_ROLE_KEY?.trim() && 'SUPABASE_SERVICE_ROLE_KEY',
  ].filter(Boolean);
  if (missing.length) refuse(...missing.map((name) => `personas-import needs ${name}: set it (locally, \`npx supabase status\` prints it)`));
}

/** The workspace with its products and the personas already there; null when no workspace has the id. */
async function fetchWorkspace(store, workspaceId) {
  try {
    const workspace = await store.workspace(workspaceId);
    if (!workspace) return null;
    return { workspace, products: await store.products(workspaceId), existing: await store.personas(workspaceId) };
  } catch (error) {
    return refuse(`personas-import: ${messageOf(error)}`);
  }
}

async function readWorkspace(store, workspaceId) {
  const found = await fetchWorkspace(store, workspaceId);
  if (!found) refuse(`personas-import: no workspace has the id ${workspaceId}; nothing written`);
  return found;
}

/** The checked rows not on their product yet; refuses the file on any invalid row. */
function rowsToAdd(rows, products, existing, out) {
  const checked = checkRows(rows, products);
  const count = checked.errors.length;
  if (count) refuse(...checked.errors, `personas-import: the file is refused, ${plural(count, 'row')} above; nothing written`);
  const there = new Set(existing.map((p) => personaKey(p.productId, p.name)));
  const toAdd = checked.rows.filter((p) => !there.has(personaKey(p.productId, p.name)));
  for (const p of checked.rows) if (!toAdd.includes(p)) out(`${describeRow(p)}  — already there, left as it is`);
  return toAdd;
}

/** Adds each row in turn; stops at the first refused one, saying how many were added before it. */
async function addAll(store, workspaceId, toAdd, out) {
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

async function runImport({ argv, env, connect, read, out }) {
  const { workspaceId, file, write } = argsOf(argv);
  const rows = rowsOf(read, file);
  checkEnv(env);
  const store = connect(env);
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
export async function importPersonas({ argv, env, connect = connectFromEnv, read = readText, out = console.log, err = console.error }) {
  try {
    return await runImport({ argv, env, connect, read, out });
  } catch (error) {
    if (!(error instanceof Refused)) throw error;
    for (const line of error.lines) err(line);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await importPersonas({ argv: process.argv.slice(2), env: process.env }));
}
