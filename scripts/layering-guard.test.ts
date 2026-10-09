// The layering guard (PRD 1318, s1; ADR-0095): in the galaxy app, a request goes client → controller →
// service → repository → database, and a file's suffix says its role. Every TypeScript file git tracks
// under `apps/galaxy` is read from its syntax tree, and five rules refuse, naming the file, the line
// and the rule:
//
//   1. `database-call`: a `.from(` or `.rpc(` call (a storage bucket's `.storage.from(` among them)
//      outside a `*.repository.ts`;
//   2. `repository-import`: a repository importing another repository or a service;
//   3. `service-import`: a service importing `@supabase/*` or a database module;
//   4. `controller-import`: a controller (a `*.controller.ts`, a server page `app/**/page.tsx` or a
//      route `app/**/route.ts`) importing a repository, `@supabase/*` or a database module;
//   5. `client-import`: a browser file (`'use client'`, or a `*.client.ts`) importing a controller, a
//      service, a repository, `@supabase/*` or a database module, the sign-in module excepted.
//
// Unlike the import guard (ADR-0058), this one starts from a baseline: `layering/baseline.json` lists
// today's breaches, one line per file and rule, so an old file never blocks a feature. The check fails
// on a breach the baseline does not list, and on a baseline line whose breach is gone, so the list
// only shrinks. The rules are proven on an inline fixture tree first, as the import guard proves
// its own, then the baseline's two rules, then the guard runs on every file git tracks.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const BASELINE = 'layering/baseline.json';

/** One fixture file's text, a line per argument. */
const src = (...lines: string[]): string => `${lines.join('\n')}\n`;

/** The fixture tree: a small galaxy app, each file at the path it stands for. */
const fixtures: readonly File[] = [
  {
    path: 'apps/galaxy/app/api/orders/[id]/route.ts',
    text: src(
      "export { GET } from '../../../../src/orders/orders.controller';",
    ),
  },
  {
    path: 'apps/galaxy/app/api/orders/route.ts',
    text: src(
      "import { userDb } from '../../../src/data/db';",
      '',
      'export const GET = async () => Response.json((await userDb()).auth);',
    ),
  },
  {
    path: 'apps/galaxy/app/orders/[id]/page.tsx',
    text: src(
      "import { orderService } from '../../../src/orders/orders.service';",
      '',
      'export default async function OrderPage() {',
      '  const orders = await orderService(undefined as never).list();',
      '  return <p>{orders.length}</p>;',
      '}',
    ),
  },
  {
    path: 'apps/galaxy/app/orders/page.tsx',
    text: src(
      "import { createServerClient } from '@supabase/ssr';",
      '',
      'export default function OrdersPage() {',
      '  return <p>{typeof createServerClient}</p>;',
      '}',
    ),
  },
  {
    path: 'apps/galaxy/src/data/db.ts',
    text: src(
      "import 'server-only';",
      "import { createClient } from '@supabase/supabase-js';",
      '',
      '// The database module: it builds the client, and only repositories import it.',
      "export const userDb = async () => createClient('https://db.example', 'key');",
      'export type Db = Awaited<ReturnType<typeof userDb>>;',
    ),
  },
  {
    path: 'apps/galaxy/src/data/sign-in.client.ts',
    text: src(
      "import { createBrowserClient } from '@supabase/ssr';",
      '',
      '// The sign-in module: the one browser module that builds a Supabase client, for authentication only.',
      'export const signOutHere = async ({ url, key }: { url: string; key: string }) => {',
      '  await createBrowserClient(url, key).auth.signOut();',
      '};',
    ),
  },
  {
    path: 'apps/galaxy/src/orders/OrdersList.tsx',
    text: src(
      "'use client';",
      "import { createBrowserClient } from '@supabase/ssr';",
      "import { useEffect, useState } from 'react';",
      '',
      'export function OrdersList({ url, key }: { url: string; key: string }) {',
      '  const [rows, setRows] = useState<{ id: string }[]>([]);',
      '  useEffect(() => {',
      '    const supabase = createBrowserClient(url, key);',
      "    void supabase.from('orders').select('id').then(({ data }) => setRows(data ?? []));",
      '  }, [url, key]);',
      '  return <ul>{rows.map((row) => <li key={row.id}>{row.id}</li>)}</ul>;',
      '}',
    ),
  },
  {
    path: 'apps/galaxy/src/orders/OrdersPanel.tsx',
    text: src(
      "'use client';",
      "import { listOrders } from './orders.repository';",
      "import { orderService } from './orders.service';",
      "import { GET } from './orders.controller';",
      '',
      'export const OrdersPanel = () => <p>{[listOrders, orderService, GET].length}</p>;',
    ),
  },
  {
    path: 'apps/galaxy/src/orders/OrdersView.tsx',
    text: src(
      "'use client';",
      "import { use } from 'react';",
      "import { fetchOrders } from './orders.client';",
      "import type { Order } from './orders.contract';",
      '',
      'export const OrdersView = ({ orders }: { orders: Promise<Order[]> }) => <p>{use(orders).length || fetchOrders.name}</p>;',
    ),
  },
  {
    path: 'apps/galaxy/src/orders/arrays.ts',
    text: src(
      '// `.from(` on a built-in is not a database call.',
      'export const ids = (rows: Iterable<string>) => Array.from(rows);',
      "export const bytes = (text: string) => Buffer.from(text, 'utf8');",
      'export const seen = (rows: string[]) => Array.from(new Set(rows));',
    ),
  },
  {
    path: 'apps/galaxy/src/orders/orders.client.ts',
    text: src(
      "import { OrdersSchema } from './orders.contract';",
      '',
      "export const fetchOrders = async () => OrdersSchema.parse(await (await fetch('/api/orders')).json());",
    ),
  },
  {
    path: 'apps/galaxy/src/orders/orders.contract.ts',
    text: src(
      "import { z } from 'zod';",
      '',
      'export const OrderSchema = z.object({ id: z.string(), total: z.number() });',
      'export const OrdersSchema = z.array(OrderSchema);',
      'export type Order = z.infer<typeof OrderSchema>;',
    ),
  },
  {
    path: 'apps/galaxy/src/orders/orders.controller.ts',
    text: src(
      "import { OrdersSchema } from './orders.contract';",
      "import { orderService } from './orders.service';",
      '',
      'export async function GET() {',
      '  return Response.json(OrdersSchema.parse(await orderService(undefined as never).list()));',
      '}',
    ),
  },
  {
    path: 'apps/galaxy/src/orders/orders.repository.ts',
    text: src(
      "import type { Db } from '../data/db';",
      '',
      "export const listOrders = async (db: Db) => (await db.from('orders').select('id, total')).data ?? [];",
      "export const recordRefund = async (db: Db, id: string) => db.rpc('record_refund', { id });",
      'export const ordersRepository = (db: Db) => ({ list: () => listOrders(db) });',
      'export type OrdersRepository = ReturnType<typeof ordersRepository>;',
    ),
  },
  {
    path: 'apps/galaxy/src/orders/orders.service.ts',
    text: src(
      "import type { Order } from './orders.contract';",
      "import type { OrdersRepository } from './orders.repository';",
      '',
      'export const orderService = (orders: OrdersRepository) => ({',
      '  list: () => orders.list(),',
      '  total: (rows: Order[]) => rows.reduce((sum, order) => sum + order.total, 0),',
      '});',
    ),
  },
  {
    path: 'apps/galaxy/src/orders/pricing.service.ts',
    text: src(
      "import type { SupabaseClient } from '@supabase/supabase-js';",
      "import { userDb } from '../data/db';",
      '',
      'export const pricing = async (db?: SupabaseClient) => db ?? (await userDb());',
    ),
  },
  {
    path: 'apps/galaxy/src/orders/refunds.client.ts',
    text: src(
      "import { userDb } from '../data/db';",
      '',
      'export const refunds = async () => (await userDb()).auth.getUser();',
    ),
  },
  {
    path: 'apps/galaxy/src/orders/refunds.controller.ts',
    text: src(
      "import { listOrders } from './orders.repository';",
      '',
      'export const GET = async () => Response.json(await listOrders(undefined as never));',
    ),
  },
  {
    path: 'apps/galaxy/src/orders/totals.repository.ts',
    text: src(
      "import type { Db } from '../data/db';",
      "import { listOrders } from './orders.repository';",
      "import { orderService } from './orders.service';",
      '',
      'export const totals = async (db: Db) => orderService(db).total(await listOrders(db));',
    ),
  },
  {
    path: 'apps/galaxy/src/orders/uploads.ts',
    text: src(
      "import type { Db } from '../data/db';",
      '',
      '// Not a repository, yet it reaches the database: two calls a repository should make.',
      '',
      'export async function upload(db: Db, file: Blob) {',
      "  await db.storage.from('order-files').upload('receipt', file);",
      "  return db.rpc('order_total');",
      '}',
    ),
  },
];

/** The fixture tree's findings for one file, as `line rule`. */
const foundIn = (path: string): string[] =>
  findViolations(fixtures)
    .filter((v) => v.path === path)
    .map((v) => `${v.line} ${v.rule}`);

describe('the layering guard, on fixtures: the five rules', () => {
  it('reads the whole fixture tree', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(15);
  });

  it('refuses a database call outside a repository, naming the file, the line and the rule', () => {
    expect(findViolations(fixtures).filter((v) => v.path === 'apps/galaxy/src/orders/OrdersList.tsx' && v.rule === 'database-call')).toEqual([
      { path: 'apps/galaxy/src/orders/OrdersList.tsx', line: 9, rule: 'database-call', text: "    void supabase.from('orders').select('id').then(({ data }) => setRows(data ?? []));" },
    ]);
    expect(foundIn('apps/galaxy/src/orders/uploads.ts')).toEqual(['6 database-call', '7 database-call']);
  });

  it('refuses a repository importing another repository or a service', () => {
    expect(foundIn('apps/galaxy/src/orders/totals.repository.ts')).toEqual(['2 repository-import', '3 repository-import']);
  });

  it('refuses a service importing @supabase/* or a database module', () => {
    expect(foundIn('apps/galaxy/src/orders/pricing.service.ts')).toEqual(['1 service-import', '2 service-import']);
  });

  it('refuses a controller, a route and a server page importing a repository, @supabase/* or a database module', () => {
    expect(foundIn('apps/galaxy/src/orders/refunds.controller.ts')).toEqual(['1 controller-import']);
    expect(foundIn('apps/galaxy/app/api/orders/route.ts')).toEqual(['1 controller-import']);
    expect(foundIn('apps/galaxy/app/orders/page.tsx')).toEqual(['1 controller-import']);
  });

  it('refuses a browser file importing a controller, a service, a repository, @supabase/* or a database module', () => {
    expect(foundIn('apps/galaxy/src/orders/OrdersList.tsx')).toEqual(['2 client-import', '9 database-call']);
    expect(foundIn('apps/galaxy/src/orders/OrdersPanel.tsx')).toEqual(['2 client-import', '3 client-import', '4 client-import']);
    expect(foundIn('apps/galaxy/src/orders/refunds.client.ts')).toEqual(['1 client-import']);
  });

  it('reads every way of naming a module: a dynamic import, a type import and an import-require', () => {
    const text = "'use client';\nexport const load = () => import('../data/db.ts');\nexport type Options = import('@supabase/ssr').CookieOptions;\nimport client = require('@supabase/supabase-js');\n";
    expect(found('apps/galaxy/src/a/A.tsx', text)).toEqual(['2 client-import', '3 client-import', '4 client-import']);
  });

  it('accepts each allowed shape: a repository calling .from, a controller importing a service, a client importing a contract, the sign-in module calling auth', () => {
    for (const path of [
      'apps/galaxy/src/orders/orders.repository.ts',
      'apps/galaxy/src/orders/orders.service.ts',
      'apps/galaxy/src/orders/orders.controller.ts',
      'apps/galaxy/src/orders/orders.client.ts',
      'apps/galaxy/src/orders/orders.contract.ts',
      'apps/galaxy/src/orders/OrdersView.tsx',
      'apps/galaxy/app/api/orders/[id]/route.ts',
      'apps/galaxy/app/orders/[id]/page.tsx',
      'apps/galaxy/src/data/db.ts',
      'apps/galaxy/src/data/sign-in.client.ts',
      'apps/galaxy/src/orders/arrays.ts',
    ]) {
      expect([path, foundIn(path)]).toEqual([path, []]);
    }
  });

  it('reads no test, no fake and nothing outside the galaxy app', () => {
    expect(found('apps/galaxy/src/orders/orders.test.ts', "export const rows = (db: Db) => db.from('orders').select();\n")).toEqual([]);
    expect(found('apps/galaxy/src/orders/orders.fake.ts', "export const rows = (db: Db) => db.from('orders').select();\n")).toEqual([]);
    expect(found('apps/omni-app/src/orders.ts', "export const rows = (db: Db) => db.from('orders').select();\n")).toEqual([]);
    expect(found('apps/galaxy/src/orders/orders.md', "db.from('orders')\n")).toEqual([]);
  });

  it('reads a storage port that is not a bucket as no call', () => {
    expect(found('apps/galaxy/src/home/choice.ts', 'export const saved = (ports: Ports) => readChoice(ports.storage);\n')).toEqual([]);
  });

  it('reads no comment and no string as a call', () => {
    expect(found('apps/galaxy/src/a.ts', "// db.from('orders') lives in the repository\nexport const said = \"db.rpc('x')\";\n")).toEqual([]);
  });
});

describe('the layering guard, on fixtures: the baseline', () => {
  const findings = findViolations(fixtures);
  const listed = lines(findings);

  it('passes when the baseline lists every breach', () => {
    expect(compare(findings, listed)).toEqual({ unlisted: [], stale: [] });
  });

  it('fails on a breach the baseline does not list', () => {
    const baseline = listed.filter((line) => line !== 'apps/galaxy/src/orders/uploads.ts database-call');
    expect(compare(findings, baseline)).toEqual({ unlisted: ['apps/galaxy/src/orders/uploads.ts database-call'], stale: [] });
  });

  it('fails on a baseline line whose breach is gone', () => {
    expect(compare(findings, [...listed, 'apps/galaxy/src/orders/orders.service.ts service-import'])).toEqual({
      unlisted: [],
      stale: ['apps/galaxy/src/orders/orders.service.ts service-import'],
    });
  });

  it('holds one line per file and rule, however many times the file breaks it', () => {
    expect(listed.filter((line) => line.startsWith('apps/galaxy/src/orders/OrdersPanel.tsx'))).toEqual(['apps/galaxy/src/orders/OrdersPanel.tsx client-import']);
  });
});

describe('the layering guard, on the galaxy app', () => {
  const paths = execFileSync('git', ['ls-files', '-z', 'apps/galaxy'], { cwd: repoRoot, encoding: 'utf8' }).split('\0').filter(Boolean);
  const files = paths.filter(isChecked).map((path) => ({ path, text: readFileSync(join(repoRoot, path), 'utf8') }));
  const findings = findViolations(files);
  const baseline = BaselineSchema.parse(JSON.parse(readFileSync(join(repoRoot, BASELINE), 'utf8')));

  it('reads every source file of the app', () => {
    expect(files.length).toBeGreaterThan(500);
  });

  it(`finds no breach ${BASELINE} does not list, and no line there whose breach is gone`, () => {
    const { unlisted, stale } = compare(findings, baseline.breaches);
    const where = (line: string): string[] =>
      findings.filter((v) => `${v.path} ${v.rule}` === line).map((v) => `${v.path}:${v.line} ${v.rule}: ${v.text.trim()}`);
    expect({ unlisted: unlisted.flatMap(where), stale }).toEqual({ unlisted: [], stale: [] });
  });

  it('keeps the baseline sorted, one line per file and rule', () => {
    expect(baseline.breaches).toEqual([...new Set(baseline.breaches)].sort());
  });

  it('names a sign-in module and database modules that exist', () => {
    const tracked = new Set(paths);
    expect([SIGN_IN, ...DATABASE_MODULES].filter((path) => !tracked.has(path))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------

type File = { path: string; text: string };
type Rule = 'database-call' | 'repository-import' | 'service-import' | 'controller-import' | 'client-import';
type Violation = { path: string; line: number; rule: Rule; text: string };

/** `layering/baseline.json`: today's breaches, `<path> <rule>`, sorted. */
const BaselineSchema = z.strictObject({ breaches: z.array(z.string().regex(/^apps\/galaxy\/\S+ (?:database|repository|service|controller|client)-(?:call|import)$/)) });

/** The one browser module that may build a Supabase client: signing in and out is not data. */
const SIGN_IN = 'apps/galaxy/src/data/sign-in.client.ts';

/** The modules that build the database client: `db.ts`, and the cookie builder it wraps until every
 * caller moves to it. */
const DATABASE_MODULES: readonly string[] = ['apps/galaxy/src/data/db.ts', 'apps/galaxy/src/data/supabase-server.ts'];

const found = (path: string, text: string): string[] => findViolations([{ path, text }]).map((v) => `${v.line} ${v.rule}`);

const TYPESCRIPT = /\.(?:[cm]?ts|tsx)$/;
/** A test, a fake (`*.fake.ts`, which stands for the database in tests), or a file in a `test/`
 * folder that serves tests only. */
const TEST = [/\.(?:test|spec|fake)\.[cm]?tsx?$/, /(?:^|\/)test\//];

/** Whether the guard reads a file: a galaxy TypeScript file that is not a test. */
function isChecked(path: string): boolean {
  return path.startsWith('apps/galaxy/') && TYPESCRIPT.test(path) && !TEST.some((p) => p.test(path));
}

const isRepository = (path: string): boolean => /\.repository\.tsx?$/.test(path);
const isService = (path: string): boolean => /\.service\.tsx?$/.test(path);
const isController = (path: string): boolean => /\.controller\.tsx?$/.test(path);
const isRoute = (path: string): boolean => /^apps\/galaxy\/app\/(?:.*\/)?route\.tsx?$/.test(path);
const isPage = (path: string): boolean => /^apps\/galaxy\/app\/(?:.*\/)?page\.tsx?$/.test(path);
const isClientFile = (path: string): boolean => /\.client\.tsx?$/.test(path);

/** One import: where it points (a repository path, or the bare specifier) and its line. */
type Import = { specifier: string; target: string | undefined; line: number };

function findViolations(files: readonly File[]): Violation[] {
  const known = new Set(files.map((f) => f.path));
  return files.filter((file) => isChecked(file.path)).flatMap((file) => fileViolations(file, known));
}

function fileViolations(file: File, known: ReadonlySet<string>): Violation[] {
  const kind = file.path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true, kind);
  const lines = file.text.split('\n');
  const lineOf = (node: ts.Node): number => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const imports: Import[] = [];
  const calls: number[] = [];
  const visit = (node: ts.Node): void => {
    const literal = moduleLiteral(node);
    if (literal !== undefined) imports.push({ specifier: literal.text, target: resolve(file.path, literal.text, known), line: lineOf(literal) });
    if (isDatabaseCall(node)) calls.push(lineOf(node.name));
    ts.forEachChild(node, visit);
  };
  visit(source);
  const useClient = directives(source).has('use client');
  const role = roleOf(file.path, useClient);
  const out: Violation[] = [];
  const flag = (line: number, rule: Rule): void => {
    out.push({ path: file.path, line, rule, text: lines[line - 1] ?? '' });
  };
  if (!isRepository(file.path)) for (const line of new Set(calls)) flag(line, 'database-call');
  for (const imp of imports) {
    const rule = role === undefined ? undefined : IMPORT_RULES[role](imp);
    if (rule !== undefined) flag(imp.line, rule);
  }
  return out.sort((a, b) => a.line - b.line);
}

type Role = 'repository' | 'service' | 'controller' | 'client';

function roleOf(path: string, useClient: boolean): Role | undefined {
  if (isRepository(path)) return 'repository';
  if (isService(path)) return 'service';
  if (path === SIGN_IN) return undefined;
  if (useClient || isClientFile(path)) return 'client';
  if (isController(path) || isRoute(path) || isPage(path)) return 'controller';
  return undefined;
}

const reachesSupabase = (imp: Import): boolean => imp.specifier.startsWith('@supabase/');
const reachesDatabase = (imp: Import): boolean => imp.target !== undefined && DATABASE_MODULES.includes(imp.target);
const reaches = (test: (path: string) => boolean) => (imp: Import): boolean => imp.target !== undefined && test(imp.target);

/** What each role may not import, as the rule it breaks. */
const IMPORT_RULES: Record<Role, (imp: Import) => Rule | undefined> = {
  repository: (imp) => (reaches(isRepository)(imp) || reaches(isService)(imp) ? 'repository-import' : undefined),
  service: (imp) => (reachesSupabase(imp) || reachesDatabase(imp) ? 'service-import' : undefined),
  controller: (imp) => (reaches(isRepository)(imp) || reachesSupabase(imp) || reachesDatabase(imp) ? 'controller-import' : undefined),
  client: (imp) =>
    reaches(isController)(imp) || reaches(isService)(imp) || reaches(isRepository)(imp) || reachesSupabase(imp) || reachesDatabase(imp) ? 'client-import' : undefined,
};

/** Each way a node names a module: a static import or re-export, `import x = require()`, a dynamic
 * `import()` or a type's `import()`. A type-only import counts: it couples the layers all the same. */
const MODULE_READS: readonly ((node: ts.Node) => ts.Node | undefined)[] = [
  (node) => (ts.isImportDeclaration(node) ? node.moduleSpecifier : undefined),
  (node) => (ts.isExportDeclaration(node) ? node.moduleSpecifier : undefined),
  (node) => (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) ? node.moduleReference.expression : undefined),
  (node) => (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : undefined),
  (node) => (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined),
];

/** The string a node names a module with, if it names one. */
function moduleLiteral(node: ts.Node): ts.StringLiteralLike | undefined {
  const literal = MODULE_READS.map((read) => read(node)).find((found) => found !== undefined);
  return literal !== undefined && ts.isStringLiteralLike(literal) ? literal : undefined;
}

/** Receivers whose `.from(` is not a database's: the built-ins' static constructors. */
const NOT_A_CLIENT = /^[A-Z]/;

/** `x.from(…)` or `x.rpc(…)`, on anything but a capitalised built-in (`Array.from`). A storage call is
 * `x.storage.from(…)`: `.storage` alone is a value (a browser storage port has one too). */
function isDatabaseCall(node: ts.Node): node is ts.PropertyAccessExpression {
  if (!ts.isPropertyAccessExpression(node)) return false;
  const name = node.name.text;
  const receiver = node.expression;
  if (ts.isIdentifier(receiver) && NOT_A_CLIENT.test(receiver.text)) return false;
  return (name === 'from' || name === 'rpc') && ts.isCallExpression(node.parent) && node.parent.expression === node;
}

function directives(source: ts.SourceFile): Set<string> {
  const out = new Set<string>();
  for (const statement of source.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
    out.add(statement.expression.text);
  }
  return out;
}

/** The repository path a relative specifier names, extension or index added as the bundler would. */
function resolve(from: string, specifier: string, known: ReadonlySet<string>): string | undefined {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) return undefined;
  const path = posix.normalize(posix.join(posix.dirname(from), specifier));
  const candidates = [path, `${path}.ts`, `${path}.tsx`, `${path}/index.ts`, `${path}/index.tsx`, path.replace(/\.js$/, '.ts')];
  return candidates.find((candidate) => known.has(candidate)) ?? path;
}

/** The baseline's lines for these findings: one per file and rule, sorted. */
function lines(findings: readonly Violation[]): string[] {
  return [...new Set(findings.map((v) => `${v.path} ${v.rule}`))].sort();
}

/** The breaches the baseline does not list, and the lines it holds whose breach is gone. */
function compare(findings: readonly Violation[], baseline: readonly string[]): { unlisted: string[]; stale: string[] } {
  const now = lines(findings);
  const listed = new Set(baseline);
  const present = new Set(now);
  return { unlisted: now.filter((line) => !listed.has(line)), stale: baseline.filter((line) => !present.has(line)) };
}
