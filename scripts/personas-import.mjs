#!/usr/bin/env node
// node scripts/personas-import.mjs <workspace-id> <file.json> [--write] — imports a workspace's
// personas once, from a file kept outside the repository (PRD 799, spec: .omni-loop/delivery/inbox/
// 0799-business-personas/spec.md). Needs SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and
// SUPABASE_SERVICE_ROLE_KEY: `node --env-file=apps/galaxy/.env.local scripts/personas-import.mjs …`.
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
import { PERSONA_TRADES, randomAvatar, validPersonaAvatar } from '../packages/design/src/index.mjs';

const STANCES = ['excited', 'neutral', 'skeptical'];
const KEYS = ['product', 'name', 'stance', 'trade', 'who', 'usage', 'avatar'];
const TRADES = new Set(PERSONA_TRADES.map((t) => t.id));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USAGE = 'usage: node scripts/personas-import.mjs <workspace-id> <file.json> [--write]';

const trimmed = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : null);
const fold = (s) => s.trim().toLowerCase();

/** The one error of a row's field, or null: the same rules as public.persona_fields(). */
function fieldError(field, value) {
  switch (field) {
    case 'name':
      return value === null || value.length < 1 || value.length > 40 || /[\r\n\t]/.test(value)
        ? 'name: 1 to 40 characters, on one line' : null;
    case 'stance':
      return STANCES.includes(value) ? null : 'stance: excited, neutral or skeptical';
    case 'trade':
      return typeof value === 'string' && TRADES.has(value) ? null : `trade: one of ${[...TRADES].join(', ')}`;
    case 'who':
    case 'usage':
      return value === null || value.length > 400 ? `${field}: a text of 400 characters at most` : null;
    case 'avatar':
      return validPersonaAvatar(value) ? null : 'avatar: {v 1, skin 0–5, hair 0–5, hairColor 0–3, outfit 0–3, accessory 0–3}';
  }
  return null;
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
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push(`row ${n}: a persona is an object with ${KEYS.join(', ')}`);
      return;
    }
    const shown = typeof raw.name === 'string' ? raw.name.replace(/\s+/g, ' ').trim() : '';
    const label = `row ${n}${shown ? ` (${shown})` : ''}`;
    const unknown = Object.keys(raw).filter((k) => !KEYS.includes(k));
    if (unknown.length) {
      errors.push(`${label}: ${unknown.join(', ')}: unknown field (a persona has ${KEYS.join(', ')})`);
      return;
    }
    let product;
    if (raw.product == null && products.length === 1) product = products[0];
    else if (typeof raw.product !== 'string') {
      errors.push(`${label}: product: name the product it belongs to (${products.map((p) => p.name).join(', ')})`);
      return;
    } else {
      const matches = products.filter((p) => fold(p.name) === fold(raw.product));
      if (matches.length !== 1) {
        errors.push(`${label}: product: "${raw.product}" is not one product of this workspace (${products.map((p) => p.name).join(', ')})`);
        return;
      }
      product = matches[0];
    }
    const persona = {
      name: trimmed(raw.name),
      stance: raw.stance,
      trade: typeof raw.trade === 'string' ? raw.trade.trim() : raw.trade,
      avatar: raw.avatar === undefined ? randomAvatar(`${product.id}/${trimmed(raw.name)}`) : raw.avatar,
      who: trimmed(raw.who),
      usage: trimmed(raw.usage),
    };
    const refused = Object.keys(persona).map((f) => fieldError(f, persona[f])).find(Boolean);
    if (refused) {
      errors.push(`${label}: ${refused}`);
      return;
    }
    const key = `${product.id}\n${persona.name}`;
    if (seen.has(key)) {
      errors.push(`${label}: name: "${persona.name}" is on ${product.name} already, at row ${seen.get(key)}`);
      return;
    }
    seen.set(key, n);
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

/** One run of the import; returns the exit code. `connect` gives the store from the environment. */
export async function importPersonas({
  argv, env, connect = (e) => restStore({ url: e.SUPABASE_URL || e.NEXT_PUBLIC_SUPABASE_URL, key: e.SUPABASE_SERVICE_ROLE_KEY }),
  read = (file) => readFileSync(file, 'utf8'), out = console.log, err = console.error,
}) {
  const write = argv.includes('--write');
  const args = argv.filter((a) => a !== '--write');
  if (args.length !== 2 || args.some((a) => a.startsWith('--'))) {
    err(USAGE);
    return 1;
  }
  const [workspaceId, file] = args;
  if (!UUID.test(workspaceId)) {
    err(`personas-import: "${workspaceId}" is not a workspace id (a uuid)\n${USAGE}`);
    return 1;
  }
  let rows;
  try {
    rows = JSON.parse(read(file));
  } catch (error) {
    err(`personas-import: ${file} is not a JSON file: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  const missing = [
    !(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL)?.trim() && 'SUPABASE_URL',
    !env.SUPABASE_SERVICE_ROLE_KEY?.trim() && 'SUPABASE_SERVICE_ROLE_KEY',
  ].filter(Boolean);
  if (missing.length) {
    for (const name of missing) err(`personas-import needs ${name}: set it (locally, \`npx supabase status\` prints it)`);
    return 1;
  }

  const store = connect(env);
  let workspace, products, existing;
  try {
    workspace = await store.workspace(workspaceId);
    if (!workspace) {
      err(`personas-import: no workspace has the id ${workspaceId}; nothing written`);
      return 1;
    }
    products = await store.products(workspaceId);
    existing = await store.personas(workspaceId);
  } catch (error) {
    err(`personas-import: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  out(`workspace: ${workspace.name} (${workspaceId})`);
  if (!products.length) {
    err(`personas-import: ${workspace.name} has no product yet (Settings › Business); nothing written`);
    return 1;
  }

  const checked = checkRows(rows, products);
  if (checked.errors.length) {
    for (const line of checked.errors) err(line);
    err(`personas-import: the file is refused, ${checked.errors.length} row${checked.errors.length === 1 ? '' : 's'} above; nothing written`);
    return 1;
  }
  const there = new Set(existing.map((p) => `${p.productId}\n${p.name}`));
  const toAdd = checked.rows.filter((p) => !there.has(`${p.productId}\n${p.name}`));
  for (const p of checked.rows) if (!toAdd.includes(p)) out(`${describeRow(p)}  — already there, left as it is`);

  if (!write) {
    for (const p of toAdd) out(describeRow(p));
    out(`would add ${toAdd.length} persona${toAdd.length === 1 ? '' : 's'} to ${workspace.name}. Dry run: nothing written; add --write to add them.`);
    return 0;
  }
  let added = 0;
  for (const p of toAdd) {
    try {
      await store.add(workspaceId, p);
    } catch (error) {
      err(`row ${p.row} (${p.name}): ${error instanceof Error ? error.message : String(error)}`);
      err(`personas-import: stopped; added ${added} before it. Fix the cause and rerun: personas already there are skipped.`);
      return 1;
    }
    added += 1;
    out(`${describeRow(p)}  — added`);
  }
  out(`added ${added} persona${added === 1 ? '' : 's'} to ${workspace.name}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await importPersonas({ argv: process.argv.slice(2), env: process.env }));
}
