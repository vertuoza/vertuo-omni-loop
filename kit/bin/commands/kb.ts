// `omni kb index` (PRD 2299) prints the capped block of the product's knowledge a session starts with.
// `omni kb legal | glossary` (PRD 1795) print the product's Legal entries or glossary terms from the Omni page, or
// the local copy when it is unreachable. `omni kb init | show <form> [--json] [--all] | status [--json] | graph [--json] | laws […]` — the playbook: one form
// per question an agent asks while delivering. `init` lays down every missing form, blank, and prints
// what it wrote; it never changes a file that exists. `show` prints one form resolved section by
// section (a pointer, then the repository's section, then the kit default), each section labelled
// with where it came from; `show decisions` then lists the latest 20 decision records, read live, and
// `--all` every one (PRD 1951). `status`
// prints the map: each form's state and source, each register folder's laws and proposals, every
// open question, every stale evidence entry, and — in a plan repository — each imported copy
// (PRD 522). `graph` prints the knowledge registers as one graph
// (PRD #149): its summary, or with `--json` the whole document; `graph <id>` (PRD 1797) prints only
// that entry's neighbourhood, or with `--json` the versioned neighbourhood document; `graph push` (PRD 1798)
// sends the whole repository's graph to the Omni page. `laws` (PRD 1726) discloses only what
// a change touches: every locked law, one plain line each, then with `--area` that domain folder's
// rules; with `--paths` or `--slice` (PRD 2346) what applies to those files or that slice's territory,
// by `Governs:`, domain or layer, then what is global, the Legal entries included, then the count of the
// locked laws of other areas (`../../lib/knowledge/disclose-lookup.ts`); `show briefing`
// ends with the thesis's laws section, and `status` counts the rules with no `Governs:` line. `owners`
// (PRD 1726) writes the CODEOWNERS block that makes `laws.owners` the owners of the thesis, the
// registers and each locked law's test, and changes no line outside its markers. None of them
// fails on what a form holds: a dead pointer or a kit default naming an unset config key is a
// warning, and `omni check kb` grades.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { credentialsHost, signedInClient } from '../../lib/ask/credentials.ts';
import { formShowText } from '../../lib/budgets/index.ts';
import { lawCodeowners, ownerHandle } from '../../lib/codeowners.ts';
import { designScreensDir, type LawOwner } from '../../lib/config.ts';
import { readScreens } from '../../lib/design/screens.ts';
import { writeOwnersBlock } from '../../lib/codeowners-laws.ts';
import { parsePlanSlices } from '../../lib/inbox/territory.ts';
import { briefingLaws } from '../../lib/knowledge/briefing-laws.ts';
import { pushKnowledgeGraph } from '../../lib/knowledge/graph-push.ts';
import { readProductGraph } from '../../lib/knowledge/product-graph-text.ts';
import { LEVELS } from '../../lib/knowledge-tree/levels.ts';
import { copiesStatus } from '../../lib/knowledge/copies.ts';
import { disclose, lawLine, ruleLine, type DiscloseFor, type Disclosure } from '../../lib/knowledge/disclose.ts';
import { knowledgeMap, lookup, lookupLine, type Lookup } from '../../lib/knowledge/disclose-lookup.ts';
import { packGet } from '../../lib/knowledge/packs/get.ts';
import type { PackOrder } from '../../lib/knowledge/packs/get.ts';
import { ID_SHAPE, readKnowledge } from '../../lib/knowledge/registers.ts';
import { readThesis } from '../../lib/knowledge/thesis.ts';
import { mainCheckout } from '../../lib/dossier/local.ts';
import { messageOf } from '../../lib/narrow.ts';
import { INDEX_BUDGET_MS, readIndex, withDeadline } from '../../lib/product/index.ts';
import type { IndexBody, IndexIo } from '../../lib/product/index.ts';
import { glossaryLines, legalLines, productKnowledge, readCachedKnowledge, unreachableLine } from '../../lib/product/knowledge.ts';
import { ghReader } from '../../lib/plan-repo/targets.ts';
import { productTargetList } from '../../lib/product/targets.ts';
import { githubEnv } from '../github.ts';
import { countsOf, readGraph } from '../../lib/knowledge/graph.ts';
import { buildNeighbourhood, neighbourhoodBody, productFromCache, productLine, startFromFiles } from '../../lib/knowledge/neighbourhood.ts';
import { DECISIONS_FORM, FORM_IDS } from '../../lib/playbook/forms.ts';
import { readDecisions } from '../../lib/playbook/decisions.ts';
import { resolveForm } from '../../lib/playbook/resolve.ts';
import { playbookStatus } from '../../lib/playbook/status.ts';
import { formTemplate } from '../../lib/playbook/templates.ts';
import { writeForms } from '../../lib/playbook/write-forms.ts';
import { parseArgs, prdArg, println, sliceArg, usageError, type Flags } from '../args.ts';
import type { CommandIo, Exec, FreeCommand, FreeIo } from '../io.ts';
import { loadContext } from '../../lib/context.ts';
import type { Context } from '../../lib/context.ts';
import type { Graph, GraphCounts, GraphEntry } from '../../lib/knowledge/graph.ts';
import type { ResolvedForm } from '../../lib/playbook/resolve.ts';
import { synchronous } from '../synchronous.ts';
import { knowledgeWrite } from '../kb-write.ts';

/** The one flag every `omni kb` verb reads. */
type KbFlags = { json?: true; all?: true };

/** The map `omni kb status` prints. */
export type StatusMap = ReturnType<typeof playbookStatus> & { targets: ReturnType<typeof copiesStatus>; ungoverned: number };

const LAWS_USAGE = 'usage: omni kb laws [--paths <file>[,<file>…] [<file>…] | --slice <prd> <slice> | --area <domain>] [--json]';
const SHOW_USAGE = 'usage: omni kb show <form> [--json] [--all]';
const PACK_USAGE = 'usage: omni kb pack get <repo> [--read-at <commit>]';
const GRAPH_USAGE = 'usage: omni kb graph [<id> | --paths <file>[,<file>…] [<file>…]] [--depth <1-3>] [--json]';
const GRAPH_PRODUCT_USAGE = 'usage: omni kb graph --product <key> <id> [--depth <1-3>] [--json]';
const GRAPH_PUSH_USAGE = 'usage: omni kb graph push';
const USAGE = `usage: omni kb init | omni kb show <form> [--json] [--all] | omni kb status [--json] | omni kb graph [<id> | --paths <file>…] [--depth <1-3>] [--json] | omni kb graph --product <key> <id> [--depth <1-3>] [--json] | omni kb graph push | omni kb laws […] | omni kb owners [--json] | omni kb pack get <repo> [--read-at <commit>] | omni kb legal [add|edit …] | omni kb glossary [add|edit …] | omni kb index [--json]`;

function init(positional: string[], flags: KbFlags, { ctx, stdout }: CommandIo): number {
  if (positional.length > 0 || flags.json) throw usageError('usage: omni kb init');
  const files = writeForms({ ctx });
  const wrote = files.filter((file) => file.wrote);
  for (const { path } of wrote) println(stdout, `wrote ${path}`);
  println(stdout, `kb init — wrote ${wrote.length} file(s); ${files.length - wrote.length} already there, left as they were.`);
  return 0;
}

const BRIEFING = 'briefing';

function show(positional: string[], flags: KbFlags, { ctx, stdout, stderr }: CommandIo): number {
  const [id = ''] = positional;
  if (positional.length !== 1 || !FORM_IDS.includes(id)) {
    throw usageError(`${SHOW_USAGE} — the forms: ${FORM_IDS.join(', ')}`);
  }
  if (flags.all && id !== DECISIONS_FORM) throw usageError(`omni kb show: --all lists every decision record, so it goes with the ${DECISIONS_FORM} form only. ${SHOW_USAGE}`);
  const resolved = resolveForm(id, { ctx, template: formTemplate(id) });
  for (const problem of resolved.problems) println(stderr, `warning: ${problem}`);
  println(stdout, flags.json ? JSON.stringify(showJson(ctx, id, resolved), null, 2) : showText(ctx, id, resolved, flags.all === true));
  return 0;
}

/** What `kb show <form> --json` prints: the resolved form, the decisions form's records, the briefing's laws. */
function showJson(ctx: Context, id: string, resolved: ResolvedForm): object {
  const extra = {
    ...(id === DECISIONS_FORM ? { records: readDecisions({ ctx }) } : {}),
    ...(id === BRIEFING ? { laws: briefingLaws(ctx) } : {}),
  };
  return { ...resolved, ...extra };
}

/** What `kb show <form>` prints, as the context measure counts it (PRD 1679); `all` lists every record (PRD 1951). */
function showText(ctx: Context, id: string, resolved: ResolvedForm, all: boolean): string {
  const records = id === DECISIONS_FORM ? readDecisions({ ctx }) : null;
  const laws = id === BRIEFING ? briefingLaws(ctx).lines : null;
  return formShowText(resolved, records, laws, { all });
}

const SOURCE_LABEL: Record<string, string> = { repo: 'repo', pointer: 'pointer', kit: 'kit default' };

/** The register folders as text: a line per folder, its laws and its proposed entries (PRD #68). */
function registerLines(registers: StatusMap['registers']): string[] {
  if (registers.length === 0) return ['Registers: none.'];
  const width = Math.max(...registers.map(({ folder }) => folder.length));
  return [
    `Registers: ${registers.length} folder(s)`,
    ...registers.map(({ folder, laws, proposals }) => `  ${folder.padEnd(width)}  ${laws} law(s) · ${proposals} proposal(s)`),
  ];
}

/** The form states a copy's line counts, in this order, each only when some form is in it. */
const COPY_STATES = ['filled', 'pointer', 'blank', 'missing', 'invalid'];

/** The imported copies as text (PRD 522): a line per copy, its forms by state and its register folders. */
function copyLines(targets: StatusMap['targets']): string[] {
  if (targets.length === 0) return [];
  const width = Math.max(...targets.map(({ repo }) => repo.length));
  return [
    `Imported copies: ${targets.length}`,
    ...targets.map(({ repo, folder, forms, registers }) => {
      const states = COPY_STATES.map((state): [string, number] => [state, forms.filter((form) => form.state === state).length])
        .filter(([, count]) => count > 0)
        .map(([state, count]) => `${count} ${state}`);
      return `  ${repo.padEnd(width)}  ${[folder, ...states, `${registers.length} register folder(s)`].join(' · ')}`;
    }),
  ];
}

/**
 * The map as text: a line per form, then each register folder's laws and proposals, then each
 * imported copy, then every open question, then every stale evidence entry.
 */
function statusText({ frontDoor, forms, registers, targets, ungoverned }: StatusMap): string {
  const width = Math.max(...forms.map(({ form }) => form.length));
  const lines = [`kb status — ${forms.length} form(s) in ${frontDoor}`];
  // A column per level only when a level above the repository answers something (PRD 2416, s2).
  const tree = forms.some(({ levels }) => levels['plan repo'] !== undefined || levels['omni settings'] !== undefined);
  for (const { form, kind, state, source, levels, questions, stale } of forms) {
    const counts: string[] = [];
    if (tree) counts.push(LEVELS.flatMap((level) => (levels[level] === undefined ? [] : [`${levels[level]} ${level}`])).join(', '));
    if (questions.length > 0) counts.push(`${questions.length} open question(s)`);
    if (stale.length > 0) counts.push(`${stale.length} stale evidence`);
    const columns = [form.padEnd(width), kind.padEnd(8), state.padEnd(7), String(SOURCE_LABEL[source]).padEnd(11), counts.join(' · ')];
    lines.push(`  ${columns.join('  ').trimEnd()}`);
  }
  const questions = forms.flatMap(({ form, file, questions: open }) => open.map(({ slot, question }) => `  ${form}#${slot} (${file}): ${question}`));
  const stale = forms.flatMap(({ form, file, stale: entries }) =>
    entries.map(({ path, hash, now }) => `  ${form} (${file}): ${path}@${hash} — ${now === null ? 'gone' : `now ${now.slice(0, 7)}`}`),
  );
  lines.push(...registerLines(registers));
  if (ungoverned > 0) lines.push(`Rules with no Governs: ${ungoverned} — omni kb laws --paths never shows them: give each a "Governs:" line.`);
  lines.push(...copyLines(targets));
  lines.push(questions.length > 0 ? `Open questions: ${questions.length}` : 'Open questions: none.', ...questions);
  lines.push(stale.length > 0 ? `Stale evidence: ${stale.length}` : 'Stale evidence: none.', ...stale);
  return lines.join('\n');
}

function status(positional: string[], flags: KbFlags, { ctx, stdout, exec }: CommandIo): number {
  if (positional.length > 0) throw usageError('usage: omni kb status [--json]');
  const map: StatusMap = {
    ...playbookStatus({ ctx, exec }),
    targets: copiesStatus({ ctx, exec }),
    ungoverned: disclose(readKnowledge({ ctx }).entries, null, null).ungoverned,
  };
  println(stdout, flags.json ? JSON.stringify(map, null, 2) : statusText(map));
  return 0;
}

/** `n` and its noun, in the singular for one. */
const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** A group of entries as two columns: its kinds, then its laws and proposals. */
function columns({ principles, rules, invariants, laws, proposed }: GraphCounts): [string, string] {
  return [
    [count(principles, 'principle', 'principles'), count(rules, 'rule', 'rules'), count(invariants, 'invariant', 'invariants')].join(' · '),
    `${count(laws, 'law', 'laws')} · ${proposed} proposed`,
  ];
}

/** A cross-domain entry's pair, `<a>--<b>`, or its file when the file's name names no pair. */
const pairOf = (entry: GraphEntry): string => (entry.domains.length === 2 ? entry.domains.join('--') : entry.file);

/**
 * The graph as text: the totals; a line per domain, then per cross-domain pair, each with its kinds
 * and its laws and proposals, the columns lined up; then the unserved principles and the loose
 * entries, every id named.
 */
function graphText({ domains, entries, links, loose, unserved }: Graph): string {
  const pairs = new Map<string, GraphEntry[]>();
  for (const entry of entries.filter((one) => one.domain === null)) pairs.set(pairOf(entry), [...(pairs.get(pairOf(entry)) ?? []), entry]);
  const rows: [string, string, string][] = [
    ...domains.map(({ name, counts }): [string, string, string] => [name, ...columns(counts)]),
    ...[...pairs].map(([name, held]): [string, string, string] => [name, ...columns(countsOf(held))]),
  ];
  const nameWidth = Math.max(0, ...rows.map(([name]) => name.length));
  const kindsWidth = Math.max(0, ...rows.map(([, kinds]) => kinds.length));
  const ids = (label: string, list: readonly string[]) => `  ${label}${list.length > 0 ? ` (${list.length}): ${list.join(', ')}` : ': none'}`;
  return [
    `kb graph — ${count(domains.length, 'domain', 'domains')}, ${count(entries.length, 'entry', 'entries')}, ${count(links.length, 'link', 'links')}`,
    ...rows.map(([name, kinds, status]) => `  ${name.padEnd(nameWidth)}    ${kinds.padEnd(kindsWidth)}    ${status}`),
    ids('unserved principles', unserved),
    ids('loose entries', loose),
  ].join('\n');
}

/** The flags of `omni kb graph`. */
type GraphFlags = Flags<'paths' | 'depth', 'json'>;

function graph(args: string[], io: CommandIo): number {
  const { ctx, stdout } = io;
  const { positional, flags } = parseArgs('kb graph', args, { values: ['paths', 'depth'], booleans: ['json'] });
  if (!/^[123]$/.test(flags.depth ?? '1')) throw usageError(GRAPH_USAGE);
  const depth = Number(flags.depth ?? '1');
  if (flags.paths !== undefined) return neighbourhoodOf({ files: pathsStart(flags, positional) }, depth, flags, io);
  if (positional.length > 1) throw usageError(GRAPH_USAGE);
  const [start] = positional;
  if (start !== undefined) return neighbourhoodOf({ ids: [start] }, depth, flags, io);
  if (flags.depth !== undefined) throw usageError(GRAPH_USAGE);
  const built = readGraph({ ctx });
  println(stdout, flags.json ? JSON.stringify(built, null, 2) : graphText(built));
  return 0;
}

/** The files `--paths` starts from, read as `omni kb laws --paths` reads them; none, or an id beside them, is a usage error. */
function pathsStart(flags: GraphFlags, positional: readonly string[]): string[] {
  const files = [...(flags.paths ?? '').split(','), ...positional].map((path) => path.trim()).filter(Boolean);
  if (files.length === 0 || files.some((file) => ID_SHAPE.test(file))) throw usageError(GRAPH_USAGE);
  return files;
}

/**
 * `omni kb graph <id>` and `omni kb graph --paths <file>…` (PRD 1797): the neighbourhood of one entry,
 * or of every entry governing the files, as text or with `--json` the versioned document. Read from
 * the repository's files only: nothing here calls the network.
 */
function neighbourhoodOf(from: { ids: string[] } | { files: string[] }, depth: number, flags: GraphFlags, { ctx, stdout, stderr }: CommandIo): number {
  const { entries } = readKnowledge({ ctx });
  const cache = readCachedKnowledge(ctx.root);
  const { product, unreadable } = productFromCache(cache, ctx.config.ask.url);
  const screensDir = designScreensDir(ctx.config);
  const sources = {
    entries,
    records: readDecisions({ ctx }).records,
    repo: ctx.config.repo.slug,
    product,
    screens: readScreens(join(ctx.root, screensDir)).screens,
    screensDir,
    legal: cache.state === 'cached' ? cache.legal : [],
    glossary: cache.state === 'cached' ? cache.glossary : [],
  };
  const { start: ids, places } = 'files' in from ? startFromFiles(sources, knowledgeMap(ctx.config), from.files) : { start: from.ids, places: [] };
  const walked = { ...sources, places };
  const built = buildNeighbourhood(walked, { start: ids, depth });
  if ('ids' in from && built.start.length === 0) {
    println(stderr, `kb graph: no entry "${from.ids.join(' ')}" in the knowledge folder.`);
    return 1;
  }
  if (flags.json) {
    println(stdout, JSON.stringify(built, null, 2));
    return 0;
  }
  if (ids.length === 0) {
    println(stdout, ['kb graph — no entry governs those files.', productLine(product, unreadable)].join('\n'));
    return 0;
  }
  const blocks = built.start.flatMap((id) => neighbourhoodBody(buildNeighbourhood(walked, { start: [id], depth }), entries));
  println(stdout, [...blocks, productLine(product, unreadable)].join('\n'));
  return 0;
}

/** The tracked files under a slice's territory, and each territory entry itself: the paths its rules are read for. */
function territoryPaths(ctx: Context, exec: Exec, territory: readonly string[]): string[] {
  const prefixes = territory.map((entry) => entry.replace(/\*+$/, ''));
  let tracked: string[] = [];
  try {
    tracked = exec('git', ['ls-files'], { cwd: ctx.root, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    tracked = []; // not a git checkout: the territory entries alone
  }
  return [...new Set([...territory, ...tracked.filter((path) => prefixes.some((prefix) => path.startsWith(prefix)))])];
}

/** PRD `prd`'s slice `slice`'s territory, read from its plan. */
function sliceTerritory(ctx: Context, prdText: string, sliceText: string): string[] {
  const prd = prdArg('kb laws', '--slice', prdText);
  const slice = sliceArg('kb laws', 'the slice', sliceText);
  const planPath = ctx.layout.planPath(prd);
  const plan = planPath === null || !existsSync(join(ctx.root, planPath)) ? null : readFileSync(join(ctx.root, planPath), 'utf8');
  if (plan === null) {
    throw usageError(`omni kb laws: PRD ${prd} has no plan${planPath === null ? ' — no inbox or shipped folder holds it' : ` at ${planPath}`}.`);
  }
  const row = parsePlanSlices(plan).find(({ id }) => id === slice);
  if (row === undefined) throw usageError(`omni kb laws: the plan of PRD ${prd} has no slice ${slice}.`);
  return row.territory;
}

/** The flags of `omni kb laws`. */
type LawsFlags = Flags<'paths' | 'slice' | 'area', 'json'>;

/** What the rules are disclosed for: `--paths`, `--slice`, `--area`, or nothing (the laws alone). */
function lawsFor(io: CommandIo, flags: LawsFlags, positional: readonly string[], domains: readonly string[]): DiscloseFor {
  if (flags.paths !== undefined) {
    return { paths: [...flags.paths.split(','), ...positional].map((path) => path.trim()).filter(Boolean) };
  }
  if (flags.slice !== undefined) {
    const [slice] = positional;
    if (positional.length !== 1 || slice === undefined) throw usageError(`omni kb laws: --slice takes a PRD and a slice, such as --slice 7 s2. ${LAWS_USAGE}`);
    return { paths: territoryPaths(io.ctx, io.exec, sliceTerritory(io.ctx, flags.slice, slice)) };
  }
  if (positional.length > 0) throw usageError(LAWS_USAGE);
  if (flags.area === undefined) return null;
  if (!domains.includes(flags.area)) throw usageError(`omni kb laws: no domain folder ${flags.area} — the folders: ${domains.join(', ')}.`);
  return { area: flags.area };
}

/** The disclosure as text, with no files asked for: one plain line per law, then a domain folder's rules for `--area`. */
function lawsText(disclosure: Disclosure, what: { area: string } | null, owners: readonly LawOwner[]): string {
  const lines = disclosure.laws.map((law) => lawLine(law, owners));
  if (lines.length === 0) lines.push('No law is locked yet.');
  if (what === null) return lines.join('\n');
  lines.push(...disclosure.rules.map(ruleLine));
  if (disclosure.rules.length === 0) lines.push(`No rule in ${what.area} yet.`);
  return lines.join('\n');
}

/**
 * The lookup as text (PRD 2346): what applies to the files, each line saying why, then what is global,
 * the Legal entries last; then the locked laws of other areas, counted. A repository that maps nothing
 * hides no law, and says how many rules name no files, as before its map.
 */
function lookupText(found: Lookup, ungoverned: number, owners: readonly LawOwner[]): string {
  const lines = ['Applies here', ...found.applies.map((entry) => lookupLine(entry, owners))];
  if (found.applies.length === 0) lines.push('Nothing applies to these files in particular.');
  lines.push('Global', ...found.global.map((entry) => lookupLine(entry, owners)));
  if (found.global.length === 0) lines.push('Nothing is global.');
  if (found.hidden.laws > 0) {
    lines.push(`${found.hidden.laws} locked ${found.hidden.laws === 1 ? 'law' : 'laws'} of other areas: not shown (omni kb laws prints them all).`);
  }
  if (!found.mapped && ungoverned > 0) {
    lines.push(`${ungoverned} rule(s) say no "Governs:", so none of them is shown here (omni kb status counts them).`);
  }
  return lines.join('\n');
}

function laws(args: string[], io: CommandIo): number {
  const { ctx, stdout } = io;
  const { positional, flags } = parseArgs('kb laws', args, { values: ['paths', 'slice', 'area'], booleans: ['json'] });
  const chosen = [flags.paths, flags.slice, flags.area].filter((flag) => flag !== undefined).length;
  if (chosen > 1) throw usageError(`omni kb laws: give one of --paths, --slice and --area. ${LAWS_USAGE}`);
  const knowledge = readKnowledge({ ctx });
  const what = lawsFor(io, flags, positional, ['product', ...knowledge.domains.map(({ name }) => name)]);
  const thesis = readThesis(ctx);
  const disclosure = disclose(knowledge.entries, thesis, what);
  const owners = ctx.config.laws.owners;
  if (what === null || 'area' in what) {
    println(stdout, flags.json ? JSON.stringify(disclosure, null, 2) : lawsText(disclosure, what, owners));
    return 0;
  }
  const cache = readCachedKnowledge(ctx.root);
  const sources = { entries: knowledge.entries, records: readDecisions({ ctx }).records, legal: cache.state === 'cached' ? cache.legal : [], thesis };
  const found = lookup(sources, knowledgeMap(ctx.config), what.paths);
  println(stdout, flags.json ? JSON.stringify({ ...disclosure, ...found }, null, 2) : lookupText(found, disclosure.ungoverned, owners));
  return 0;
}

/**
 * `omni kb owners`: writes the CODEOWNERS block for the thesis, the registers and each locked law's
 * test, owned by `laws.owners` and each owner's delegate (PRD 1794), never by `laws.leadership`;
 * refused while `laws.owners` is empty, since a line with no owner leaves its file unowned.
 */
function owners(positional: string[], flags: KbFlags, { ctx, stdout, stderr }: CommandIo): number {
  if (positional.length > 0) throw usageError('usage: omni kb owners [--json]');
  const listed = ctx.config.laws.owners;
  if (listed.length === 0) {
    throw usageError('omni kb owners: laws.owners is empty — name who owns the laws (logins or teams) in .omni-loop/config.yml first.');
  }
  let written: ReturnType<typeof writeOwnersBlock>;
  try {
    written = writeOwnersBlock(ctx);
  } catch (error) {
    println(stderr, `omni kb owners: ${messageOf(error)}`);
    return 1;
  }
  const who = lawCodeowners(listed).map(ownerHandle).join(', ');
  const line = written.wrote
    ? `kb owners — wrote ${written.file}: ${written.paths} path(s) owned by ${who}; no line outside its markers changed.`
    : `kb owners — ${written.file} is up to date: ${written.paths} path(s) owned by ${who}.`;
  println(stdout, flags.json ? JSON.stringify({ ...written, owners: listed }, null, 2) : line);
  return 0;
}

/** What a test hands `omni kb pack get | legal | glossary` beyond the command's own io: the sign-in, the app and the clock. */
type PackOptions = {
  tokens?: TokenStore | undefined;
  home?: string | undefined;
  fetch?: Fetch | undefined;
  callMs?: number | undefined;
  now?: (() => Date) | undefined;
  order?: ((repo: string, packSha: string, readAt: string) => PackOrder) | undefined;
};

/** `repo` as `owner/name`: as given, a plan target's short name, or a repository of this repository's owner. */
function packSlug(ctx: Context, repo: string): string {
  if (repo.includes('/')) return repo;
  const target = (ctx.config.plan?.targets ?? []).find(({ repo: slug }) => slug.split('/')[1] === repo);
  if (target !== undefined) return target.repo;
  const owner = ctx.config.repo.slug?.split('/')[0];
  if (owner === undefined) throw usageError(`omni kb pack get: ${repo} is not owner/name and this repository has no slug to take the owner from. ${PACK_USAGE}`);
  return `${owner}/${repo}`;
}

/** The commit the link to `slug` was read at: `--read-at`, else the product's link, else the plan's target. */
async function packReadAt(ctx: Context, slug: string, flag: string | undefined, io: CommandIo & PackOptions): Promise<string | null> {
  if (flag !== undefined) return flag;
  const plan = ctx.config.plan;
  if (plan === undefined) return null;
  const targets = plan.product === undefined
    ? plan.targets
    : await productTargetList({ ctx, product: plan.product, repo: ctx.config.repo.slug }, { cwd: ctx.root, ...io }, io.stderr);
  return typeof targets === 'string' ? null : (targets.find(({ repo }) => repo === slug)?.readAt ?? null);
}

/** The arguments of `omni kb pack get`: the repository and the `--read-at` commit, validated. */
function packArgs(args: string[]): { repo: string; readAtFlag: string | undefined } {
  const { positional, flags } = parseArgs('kb pack', args, { values: ['read-at'] });
  const [verb, repo, ...extra] = positional;
  if (verb !== 'get' || repo === undefined || extra.length > 0) throw usageError(PACK_USAGE);
  const readAtFlag = flags['read-at'];
  if (readAtFlag !== undefined && !/^[0-9a-f]{40}$/.test(readAtFlag)) throw usageError(`omni kb pack get: --read-at takes a full commit sha. ${PACK_USAGE}`);
  return { repo, readAtFlag };
}

/** Whether the pack at `packSha` is behind `readAt` of `slug`, as GitHub compares them (`unknown` when it cannot). */
function packOrder(reader: ReturnType<typeof ghReader>, slug: string, packSha: string, readAt: string): PackOrder {
  try {
    // compare(base = read_at, head = pack): the pack is behind when GitHub says the head is.
    const status = reader.compare(slug, readAt, packSha)?.status;
    if (status === undefined) return 'unknown';
    return status === 'behind' ? 'behind' : 'ok';
  } catch {
    return 'unknown';
  }
}

/** `omni kb pack get <repo>` (PRD 2011, s12): see `../../lib/knowledge/packs/get.ts`. */
async function pack(args: string[], io: CommandIo & PackOptions): Promise<number> {
  const { ctx, stdout, stderr, exec } = io;
  const { repo, readAtFlag } = packArgs(args);
  const slug = packSlug(ctx, repo);
  const askUrl = ctx.config.ask.url;
  if (!askUrl) throw usageError('omni kb pack get: ask.url is not set — packs are served by the Omni page.');
  const client = signedInClient({ askUrl, tokens: io.tokens, home: io.home, fetch: io.fetch ?? globalThis.fetch, callMs: io.callMs });
  const reader = ghReader({ exec, env: githubEnv(ctx, { exec, env: io.env }) });
  const result = await packGet({
    root: mainCheckout(ctx.root, exec) ?? ctx.root,
    repo: slug,
    readAt: await packReadAt(ctx, slug, readAtFlag, io),
    now: io.now ?? (() => new Date()),
    fetchPack: async () => {
      if (client === null) throw new Error(`no sign-in for ${credentialsHost(askUrl)} (omni signin)`);
      return client.readKnowledgePack({ repo: slug });
    },
    order: (packSha, at) => (io.order ? io.order(slug, packSha, at) : packOrder(reader, slug, packSha, at)),
  });
  for (const line of result.out) println(stdout, line);
  for (const line of result.err) println(stderr, line);
  return result.code;
}

/** The repository's slug and a client signed in to its Omni page, or the one line saying why there is none. */
function reachOf(ctx: Context, options: PackOptions): { repo: string; client: NonNullable<ReturnType<typeof signedInClient>> } | string {
  const askUrl = ctx.config.ask.url;
  const repo = ctx.config.repo.slug;
  if (!askUrl) return 'no product knowledge: ask.url is not set, so there is no Omni page to read';
  if (!repo) return 'no product knowledge: no repository slug — set repo.slug in the config';
  const client = signedInClient({ askUrl, tokens: options.tokens, home: options.home, fetch: options.fetch ?? globalThis.fetch, callMs: options.callMs });
  return client === null ? `no product knowledge: no sign-in for ${credentialsHost(askUrl)} (omni signin)` : { repo, client };
}

/**
 * `omni kb legal | glossary` (PRD 1795): the product's active Legal entries, or its glossary terms,
 * one line each, read through the business read with the computer's sign-in and kept in
 * `.omni-loop/local/product-knowledge.json`. The page unreachable: the copy under
 * `last read <date>: the Omni page is unreachable`, or exit 1 with no copy. A refusal prints the
 * server's reason and exits 1, whatever the copy.
 */
async function productVerb(verb: 'legal' | 'glossary', positional: string[], { ctx, stdout, exec }: CommandIo, options: PackOptions, cwd: string): Promise<number> {
  if (positional.length > 0) throw usageError(`usage: omni kb ${verb}`);
  const refuse = (line: string): number => {
    println(stdout, line);
    return 1;
  };
  const reach = reachOf(ctx, options);
  if (typeof reach === 'string') return refuse(reach);
  const { repo, client } = reach;
  try {
    const read = await productKnowledge({
      repo,
      root: mainCheckout(cwd, exec) ?? ctx.root,
      now: options.now ?? (() => new Date()),
      fetchBusiness: () => client.readBusiness(repo),
    });
    if (read.from === 'copy') println(stdout, unreachableLine(read.readAt));
    for (const line of verb === 'legal' ? legalLines(read.legal) : glossaryLines(read.glossary)) println(stdout, line);
    return 0;
  } catch (error) {
    return refuse(messageOf(error));
  }
}

/** `omni kb legal | glossary`: the read, or with `add` or `edit` (PRD 2268) the write of `../kb-write.ts`. */
function productCommand(verb: 'legal' | 'glossary', args: string[], io: CommandIo & PackOptions, options: PackOptions & { cwd: string }): Promise<number> {
  if (args[0] === 'add' || args[0] === 'edit') return knowledgeWrite(verb, args, io, options);
  return productVerb(verb, args, io, options, options.cwd);
}

/**
 * `omni kb index [--json]` (PRD 2299): the capped block of the product's knowledge a session starts with
 * (see `../../lib/product/index.ts`). It never holds up a session: one budget for the whole read, and
 * every outcome exits 0. Exit 2 is only for a usage error.
 */
async function index(args: string[], io: FreeIo & PackOptions & { budgetMs?: number }): Promise<number> {
  const { positional, flags } = parseArgs('kb index', args, { booleans: ['json'] });
  if (positional.length > 0) throw usageError('usage: omni kb index [--json]');
  const { cwd, exec, stdout, fetch = globalThis.fetch, now = () => new Date(), budgetMs = INDEX_BUDGET_MS } = io;
  let result: [IndexBody, string[]];
  try {
    result = await readIndex(indexIo(cwd, exec, { ...io, fetch, now, budgetMs }));
  } catch (error) {
    const why = error instanceof Error && error.name === 'ConfigError' ? error.message.split('\n')[0] : 'the read failed';
    result = [
      { state: error instanceof Error && error.name === 'ConfigError' ? 'no-kit' : 'unreachable', product: null, words: [], legal: [], personas: [], syncedAt: null, cut: { words: 0, legal: 0, personas: 0 } },
      [`no product knowledge: ${why} — agents carry on`],
    ];
  }
  if (flags.json === true) println(stdout, JSON.stringify(result[0]));
  else for (const line of result[1]) println(stdout, line);
  return 0;
}

/** What `readIndex` is handed for this checkout; throws a `ConfigError` when the kit is not set up. */
function indexIo(cwd: string, exec: Exec, options: PackOptions & { fetch: Fetch; now: () => Date; budgetMs: number }): IndexIo {
  const ctx = loadContext(cwd, { exec });
  const repo = ctx.config.repo.slug;
  const askUrl = ctx.config.ask.url;
  const { fetch, now, budgetMs } = options;
  const client = (signal: AbortSignal) => (askUrl ? signedInClient({ askUrl, tokens: options.tokens, home: options.home, fetch: withDeadline(fetch, signal), callMs: budgetMs }) : null);
  const base = { repo, root: mainCheckout(cwd, exec) ?? ctx.root, now, budgetMs };
  if (!askUrl) return { ...base, reach: { state: 'no-sign-in', why: 'no Omni page is set here (ask.url)' } };
  if (!repo) return { ...base, reach: { state: 'refused', why: 'no repository slug (repo.slug)' } };
  if (client(new AbortController().signal) === null) return { ...base, reach: { state: 'no-sign-in', why: 'no sign-in (omni signin)' } };
  return {
    ...base,
    reach: {
      fetchBusiness: (signal) => {
        const signed = client(signal);
        return signed === null ? Promise.reject(new Error('no sign-in')) : signed.readBusiness(repo);
      },
    },
  };
}

/** `omni kb graph push` (PRD 1798, s2): see `../../lib/knowledge/graph-push.ts`. */
async function graphPush(args: string[], io: CommandIo & PackOptions): Promise<number> {
  const { ctx, stdout, exec } = io;
  if (args.length > 0) throw usageError(GRAPH_PUSH_USAGE);
  const askUrl = ctx.config.ask.url;
  const client = pageClient(askUrl, io);
  let result: Awaited<ReturnType<typeof pushKnowledgeGraph>>;
  try {
    result = await pushKnowledgeGraph({
      ctx,
      client,
      now: io.now ?? (() => new Date()),
      git: (gitArgs) => exec('git', [...gitArgs], { cwd: ctx.root, encoding: 'utf8' }),
    });
  } catch (error) {
    result = { ok: false, lines: [`kb graph push: ${messageOf(error)}`] };
  }
  for (const line of result.lines) println(stdout, line);
  return result.ok ? 0 : 1;
}

/** `omni kb graph --product <key> <id> [--depth <n>] [--json]` (PRD 1798, s5): see `../../lib/knowledge/product-graph-text.ts`. */
async function graphProduct(args: string[], io: CommandIo & PackOptions): Promise<number> {
  const { ctx, stdout, stderr } = io;
  const askUrl = ctx.config.ask.url;
  const result = await readProductGraph({ askUrl, client: pageClient(askUrl, io), ...productGraphArgs(args) });
  for (const line of result.lines) println(result.ok ? stdout : stderr, line);
  return result.ok ? 0 : 1;
}

/** The product key, node id, depth (`null`: the server's default) and `--json` of `omni kb graph --product`; anything else is a usage error. */
function productGraphArgs(args: string[]): { key: string; id: string; depth: number | null; json: boolean } {
  const { positional, flags } = parseArgs('kb graph', args, { values: ['product', 'depth'], booleans: ['json'] });
  const [id] = positional;
  if (positional.length !== 1 || id === undefined || flags.product === undefined) throw usageError(GRAPH_PRODUCT_USAGE);
  if (flags.depth !== undefined && !/^[123]$/.test(flags.depth)) throw usageError(GRAPH_PRODUCT_USAGE);
  return { key: flags.product, id, depth: flags.depth === undefined ? null : Number(flags.depth), json: flags.json === true };
}

/** The signed-in client of the Omni page at `askUrl`; `null` with no `ask.url`. */
function pageClient(askUrl: string | null, io: PackOptions) {
  return askUrl ? signedInClient({ askUrl, tokens: io.tokens, home: io.home, fetch: io.fetch ?? globalThis.fetch, callMs: io.callMs }) : null;
}

const basic = synchronous((args: string[], io: CommandIo): number => {
  if (args[0] === 'laws') return laws(args.slice(1), io);
  if (args[0] === 'graph') return graph(args.slice(1), io);
  const { positional, flags } = parseArgs('kb', args, { booleans: ['json', 'all'] });
  const [sub, ...rest] = positional;
  if (flags.all && sub !== 'show') throw usageError(`omni kb: --all goes with omni kb show ${DECISIONS_FORM} only. ${USAGE}`);
  if (sub === 'init') return init(rest, flags, io);
  if (sub === 'show') return show(rest, flags, io);
  if (sub === 'status') return status(rest, flags, io);
  if (sub === 'owners') return owners(rest, flags, io);
  throw usageError(USAGE);
});

export const kb: FreeCommand = {
  withoutContext: true,
  run: (args: string[], io: FreeIo & PackOptions): Promise<number> => {
    const [sub, ...rest] = args;
    if (sub === 'index') return index(rest, io);
    const full = { ...io, ctx: loadContext(io.cwd, { exec: io.exec }) };
    if (sub === 'pack') return pack(rest, full);
    if (sub === 'graph' && rest[0] === 'push') return graphPush(rest.slice(1), full);
    if (sub === 'graph' && rest.includes('--product')) return graphProduct(rest, full);
    if (sub === 'legal' || sub === 'glossary') return productCommand(sub, rest, { ...full, vars: io.vars }, io);
    return basic(args, full);
  },
};
