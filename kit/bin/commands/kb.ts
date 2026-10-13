// `omni kb init | show <form> [--json] | status [--json] | graph [--json] | laws […]` — the playbook: one form
// per question an agent asks while delivering. `init` lays down every missing form, blank, and prints
// what it wrote; it never changes a file that exists. `show` prints one form resolved section by
// section (a pointer, then the repository's section, then the kit default), each section labelled
// with where it came from; `show decisions` then lists the decision records, read live. `status`
// prints the map: each form's state and source, each register folder's laws and proposals, every
// open question, every stale evidence entry, and — in a plan repository — each imported copy
// (PRD 522). `graph` prints the knowledge registers as one graph
// (PRD #149): its summary, or with `--json` the whole document. `laws` (PRD 1726) discloses only what
// a change touches: every locked law, one plain line each, then with `--paths`, `--slice` or `--area`
// the rules that govern those files, that slice's territory or that domain folder; `show briefing`
// ends with the thesis's laws section, and `status` counts the rules with no `Governs:` line. `owners`
// (PRD 1726) writes the CODEOWNERS block that makes `laws.owners` the owners of the thesis, the
// registers and each locked law's test, and changes no line outside its markers. None of them
// fails on what a form holds: a dead pointer or a kit default naming an unset config key is a
// warning, and `omni check kb` grades.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formShowText } from '../../lib/budgets/index.ts';
import { ownerHandle } from '../../lib/codeowners.ts';
import { writeOwnersBlock } from '../../lib/codeowners-laws.ts';
import { parsePlanSlices } from '../../lib/inbox/territory.ts';
import { briefingLaws } from '../../lib/knowledge/briefing-laws.ts';
import { copiesStatus } from '../../lib/knowledge/copies.ts';
import { disclose, lawLine, ruleLine, type DiscloseFor, type Disclosure } from '../../lib/knowledge/disclose.ts';
import { readKnowledge } from '../../lib/knowledge/registers.ts';
import { readThesis } from '../../lib/knowledge/thesis.ts';
import { messageOf } from '../../lib/narrow.ts';
import { countsOf, readGraph } from '../../lib/knowledge/graph.ts';
import { DECISIONS_FORM, FORM_IDS } from '../../lib/playbook/forms.ts';
import { readDecisions } from '../../lib/playbook/decisions.ts';
import { resolveForm } from '../../lib/playbook/resolve.ts';
import { playbookStatus } from '../../lib/playbook/status.ts';
import { formTemplate } from '../../lib/playbook/templates.ts';
import { writeForms } from '../../lib/playbook/write-forms.ts';
import { parseArgs, prdArg, println, sliceArg, usageError, type Flags } from '../args.ts';
import type { Command, CommandIo, Exec } from '../io.ts';
import type { Context } from '../../lib/context.ts';
import type { Graph, GraphCounts, GraphEntry } from '../../lib/knowledge/graph.ts';
import type { ResolvedForm } from '../../lib/playbook/resolve.ts';
import { synchronous } from '../synchronous.ts';

/** The one flag every `omni kb` verb reads. */
type KbFlags = { json?: true };

/** The map `omni kb status` prints. */
export type StatusMap = ReturnType<typeof playbookStatus> & { targets: ReturnType<typeof copiesStatus>; ungoverned: number };

const LAWS_USAGE = 'usage: omni kb laws [--paths <file>[,<file>…] [<file>…] | --slice <prd> <slice> | --area <domain>] [--json]';
const USAGE = `usage: omni kb init | omni kb show <form> [--json] | omni kb status [--json] | omni kb graph [--json] | omni kb laws […] | omni kb owners [--json]`;

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
    throw usageError(`usage: omni kb show <form> [--json] — the forms: ${FORM_IDS.join(', ')}`);
  }
  const resolved = resolveForm(id, { ctx, template: formTemplate(id) });
  for (const problem of resolved.problems) println(stderr, `warning: ${problem}`);
  println(stdout, flags.json ? JSON.stringify(showJson(ctx, id, resolved), null, 2) : showText(ctx, id, resolved));
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

/** What `kb show <form>` prints, as the context measure counts it (PRD 1679). */
function showText(ctx: Context, id: string, resolved: ResolvedForm): string {
  const records = id === DECISIONS_FORM ? readDecisions({ ctx }) : null;
  const laws = id === BRIEFING ? briefingLaws(ctx).lines : null;
  return formShowText(resolved, records, laws);
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
  for (const { form, kind, state, source, questions, stale } of forms) {
    const counts: string[] = [];
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

function graph(positional: string[], flags: KbFlags, { ctx, stdout }: CommandIo): number {
  if (positional.length > 0) throw usageError('usage: omni kb graph [--json]');
  const built = readGraph({ ctx });
  println(stdout, flags.json ? JSON.stringify(built, null, 2) : graphText(built));
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

/** The disclosure as text: one plain line per law, then one headline per rule asked for. */
function lawsText(disclosure: Disclosure, what: DiscloseFor, owners: readonly string[]): string {
  const lines = disclosure.laws.map((law) => lawLine(law, owners));
  if (lines.length === 0) lines.push('No law is locked yet.');
  if (what === null) return lines.join('\n');
  lines.push(...disclosure.rules.map(ruleLine));
  if (disclosure.rules.length === 0) {
    lines.push('area' in what ? `No rule in ${what.area} yet.` : 'No rule says it governs these files.');
  }
  if (!('area' in what) && disclosure.ungoverned > 0) {
    lines.push(`${disclosure.ungoverned} rule(s) say no "Governs:", so none of them is shown here (omni kb status counts them).`);
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
  const disclosure = disclose(knowledge.entries, readThesis(ctx), what);
  println(stdout, flags.json ? JSON.stringify(disclosure, null, 2) : lawsText(disclosure, what, ctx.config.laws.owners));
  return 0;
}

/**
 * `omni kb owners`: writes the CODEOWNERS block for the thesis, the registers and each locked law's
 * test, owned by `laws.owners`; refused while `laws.owners` is empty, since a line with no owner
 * leaves its file unowned.
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
  const who = listed.map(ownerHandle).join(', ');
  const line = written.wrote
    ? `kb owners — wrote ${written.file}: ${written.paths} path(s) owned by ${who}; no line outside its markers changed.`
    : `kb owners — ${written.file} is up to date: ${written.paths} path(s) owned by ${who}.`;
  println(stdout, flags.json ? JSON.stringify({ ...written, owners: listed }, null, 2) : line);
  return 0;
}

export const kb: Command = {
  run: synchronous((args: string[], io: CommandIo): number => {
    if (args[0] === 'laws') return laws(args.slice(1), io);
    const { positional, flags } = parseArgs('kb', args, { booleans: ['json'] });
    const [sub, ...rest] = positional;
    if (sub === 'init') return init(rest, flags, io);
    if (sub === 'show') return show(rest, flags, io);
    if (sub === 'status') return status(rest, flags, io);
    if (sub === 'graph') return graph(rest, flags, io);
    if (sub === 'owners') return owners(rest, flags, io);
    throw usageError(USAGE);
  }),
};
