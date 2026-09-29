// `omni kb init | show <form> [--json] | status [--json] | graph [--json]` — the playbook: one form
// per question an agent asks while delivering. `init` lays down every missing form, blank, and prints
// what it wrote; it never changes a file that exists. `show` prints one form resolved section by
// section (a pointer, then the repository's section, then the kit default), each section labelled
// with where it came from; `show decisions` then lists the decision records, read live. `status`
// prints the map: each form's state and source, each register folder's laws and proposals, every
// open question, every stale evidence entry, and — in a plan repository — each imported copy
// (PRD 522). `graph` prints the knowledge registers as one graph
// (PRD #149): its summary, or with `--json` the whole document. None of them
// fails on what a form holds: a dead pointer or a kit default naming an unset config key is a
// warning, and `omni check kb` grades.
import { copiesStatus } from '../../lib/knowledge/copies.mjs';
import { countsOf, readGraph } from '../../lib/knowledge/graph.mjs';
import { DECISIONS_FORM, FORM_IDS } from '../../lib/playbook/forms.mjs';
import { readDecisions } from '../../lib/playbook/decisions.mjs';
import { resolveForm } from '../../lib/playbook/resolve.mjs';
import { playbookStatus } from '../../lib/playbook/status.mjs';
import { formTemplate } from '../../lib/playbook/templates.mjs';
import { writeForms } from '../../lib/playbook/write-forms.mjs';
import { parseArgs, println, usageError } from '../args.mjs';

const USAGE = 'usage: omni kb init | omni kb show <form> [--json] | omni kb status [--json] | omni kb graph [--json]';

function init(positional, flags, { ctx, stdout }) {
  if (positional.length > 0 || flags.json) throw usageError('usage: omni kb init');
  const files = writeForms({ ctx });
  const wrote = files.filter((file) => file.wrote);
  for (const { path } of wrote) println(stdout, `wrote ${path}`);
  println(stdout, `kb init — wrote ${wrote.length} file(s); ${files.length - wrote.length} already there, left as they were.`);
  return 0;
}

/** The decision records as text: one line each, every shared number flagged, the next free one. */
function recordLines({ dir, records, shared, next }) {
  const lines = [`## Records  [read live from ${dir}]`];
  if (records.length === 0) lines.push('No decision records yet.');
  lines.push(...records.map(({ number, file, title }) => `${number}  ${title ?? file}`));
  lines.push(...shared.map(({ number, files }) => `! ${number} is used by ${files.length} records: ${files.join(', ')}`));
  lines.push(`Next free number: ${next}`);
  return lines;
}

/** One resolved form as text: its title, its file and state, then each section under its label. */
function showText(resolved, records) {
  const lines = [`# ${resolved.title}`, `${resolved.file} · ${resolved.state}`];
  for (const section of resolved.sections) {
    lines.push('', section.slot === null ? section.label : `## ${section.heading}  ${section.label}`);
    if (section.text) lines.push(section.text);
    // A hole shows the kit default, then its questions; repository text already holds its own.
    if (section.source === 'hole') lines.push(...section.questions.map((question) => `TODO(human): ${question}`));
  }
  if (records) lines.push('', ...recordLines(records));
  return lines.join('\n');
}

function show(positional, flags, { ctx, stdout, stderr }) {
  const [id] = positional;
  if (positional.length !== 1 || !FORM_IDS.includes(id)) {
    throw usageError(`usage: omni kb show <form> [--json] — the forms: ${FORM_IDS.join(', ')}`);
  }
  const resolved = resolveForm(id, { ctx, template: formTemplate(id) });
  const records = id === DECISIONS_FORM ? readDecisions({ ctx }) : null;
  for (const problem of resolved.problems) println(stderr, `warning: ${problem}`);
  println(stdout, flags.json ? JSON.stringify(records ? { ...resolved, records } : resolved, null, 2) : showText(resolved, records));
  return 0;
}

const SOURCE_LABEL = { repo: 'repo', pointer: 'pointer', kit: 'kit default' };

/** The register folders as text: a line per folder, its laws and its proposed entries (PRD #68). */
function registerLines(registers) {
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
function copyLines(targets) {
  if (targets.length === 0) return [];
  const width = Math.max(...targets.map(({ repo }) => repo.length));
  return [
    `Imported copies: ${targets.length}`,
    ...targets.map(({ repo, folder, forms, registers }) => {
      const states = COPY_STATES.map((state) => [state, forms.filter((form) => form.state === state).length])
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
function statusText({ frontDoor, forms, registers, targets }) {
  const width = Math.max(...forms.map(({ form }) => form.length));
  const lines = [`kb status — ${forms.length} form(s) in ${frontDoor}`];
  for (const { form, kind, state, source, questions, stale } of forms) {
    const counts = [];
    if (questions.length > 0) counts.push(`${questions.length} open question(s)`);
    if (stale.length > 0) counts.push(`${stale.length} stale evidence`);
    const columns = [form.padEnd(width), kind.padEnd(8), state.padEnd(7), SOURCE_LABEL[source].padEnd(11), counts.join(' · ')];
    lines.push(`  ${columns.join('  ').trimEnd()}`);
  }
  const questions = forms.flatMap(({ form, file, questions: open }) => open.map(({ slot, question }) => `  ${form}#${slot} (${file}): ${question}`));
  const stale = forms.flatMap(({ form, file, stale: entries }) =>
    entries.map(({ path, hash, now }) => `  ${form} (${file}): ${path}@${hash} — ${now === null ? 'gone' : `now ${now.slice(0, 7)}`}`),
  );
  lines.push(...registerLines(registers), ...copyLines(targets));
  lines.push(questions.length > 0 ? `Open questions: ${questions.length}` : 'Open questions: none.', ...questions);
  lines.push(stale.length > 0 ? `Stale evidence: ${stale.length}` : 'Stale evidence: none.', ...stale);
  return lines.join('\n');
}

function status(positional, flags, { ctx, stdout, exec }) {
  if (positional.length > 0) throw usageError('usage: omni kb status [--json]');
  const map = { ...playbookStatus({ ctx, exec }), targets: copiesStatus({ ctx, exec }) };
  println(stdout, flags.json ? JSON.stringify(map, null, 2) : statusText(map));
  return 0;
}

/** `n` and its noun, in the singular for one. */
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** A group of entries as two columns: its kinds, then its laws and proposals. */
function columns({ principles, rules, invariants, laws, proposed }) {
  return [
    [count(principles, 'principle', 'principles'), count(rules, 'rule', 'rules'), count(invariants, 'invariant', 'invariants')].join(' · '),
    `${count(laws, 'law', 'laws')} · ${proposed} proposed`,
  ];
}

/** A cross-domain entry's pair, `<a>--<b>`, or its file when the file's name names no pair. */
const pairOf = (entry) => (entry.domains.length === 2 ? entry.domains.join('--') : entry.file);

/**
 * The graph as text: the totals; a line per domain, then per cross-domain pair, each with its kinds
 * and its laws and proposals, the columns lined up; then the unserved principles and the loose
 * entries, every id named.
 */
function graphText({ domains, entries, links, loose, unserved }) {
  const pairs = new Map();
  for (const entry of entries.filter((one) => one.domain === null)) pairs.set(pairOf(entry), [...(pairs.get(pairOf(entry)) ?? []), entry]);
  const rows = [
    ...domains.map(({ name, counts }) => [name, ...columns(counts)]),
    ...[...pairs].map(([name, held]) => [name, ...columns(countsOf(held))]),
  ];
  const nameWidth = Math.max(0, ...rows.map(([name]) => name.length));
  const kindsWidth = Math.max(0, ...rows.map(([, kinds]) => kinds.length));
  const ids = (label, list) => `  ${label}${list.length > 0 ? ` (${list.length}): ${list.join(', ')}` : ': none'}`;
  return [
    `kb graph — ${count(domains.length, 'domain', 'domains')}, ${count(entries.length, 'entry', 'entries')}, ${count(links.length, 'link', 'links')}`,
    ...rows.map(([name, kinds, status]) => `  ${name.padEnd(nameWidth)}    ${kinds.padEnd(kindsWidth)}    ${status}`),
    ids('unserved principles', unserved),
    ids('loose entries', loose),
  ].join('\n');
}

function graph(positional, flags, { ctx, stdout }) {
  if (positional.length > 0) throw usageError('usage: omni kb graph [--json]');
  const built = readGraph({ ctx });
  println(stdout, flags.json ? JSON.stringify(built, null, 2) : graphText(built));
  return 0;
}

export const kb = {
  async run(args, io) {
    const { positional, flags } = parseArgs('kb', args, { booleans: ['json'] });
    const [sub, ...rest] = positional;
    if (sub === 'init') return init(rest, flags, io);
    if (sub === 'show') return show(rest, flags, io);
    if (sub === 'status') return status(rest, flags, io);
    if (sub === 'graph') return graph(rest, flags, io);
    throw usageError(USAGE);
  },
};
