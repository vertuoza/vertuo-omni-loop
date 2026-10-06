// `omni help` as text (PRD 315): the overview of the loop and every command, and one entry. Pure:
// it reads the help table and the config it is given, fills the repository's words in, and lays the
// lines out. Plain text, no colour, no line wider than 80 columns.
import { ENTRIES, PRINCIPLES, STAGES } from './entries.ts';
import type { HelpEntry } from './entries.ts';

/** The config keys the help fills in: the delivery folder, the remote and the default branch. */
export type HelpConfig = {
  readonly paths: { readonly delivery: string };
  readonly repo: { readonly remote: string; readonly defaultBranch: string };
};

/** What `fillerFor` returns: `text` with the repository's words put in their braces. */
type Fill = (text: string) => string;

/** Whether an entry has a row label: one of the overview's rows rather than a name on its closing line. */
const hasLabel = (entry: HelpEntry): entry is HelpEntry & { readonly label: string } => Boolean(entry.label);

const HELP_WIDTH = 78; // prose wraps here, and who runs a command ends here
const HELP_INDENT = '  ';
const LABEL_COLUMN = 24; // the overview's label column
const STAGE_COLUMN = 10; // the loop's name column: its widest, building, and two spaces
const WHO_RUNS = Object.freeze({ you: 'for you', skills: 'run by the skills' });
const HELP_CLOSING = 'omni help <command> tells more about any of them.';
const DOCS_LABEL_COLUMN = 9; // `When` and `Example`, then their text (PRD 580)

/** The repository's words the help table leaves in braces. */
function repositoryWords(config: HelpConfig): Record<string, string> {
  const delivery = config.paths.delivery;
  return {
    delivery,
    inbox: `${delivery}/inbox/`,
    shipped: `${delivery}/shipped/`,
    remote: config.repo.remote,
    defaultBranch: config.repo.defaultBranch,
  };
}

const fillerFor = (words: Record<string, string>): Fill => (text) =>
  text.replace(/\{(\w+)\}/g, (whole, key: string) => (Object.hasOwn(words, key) ? (words[key] ?? whole) : whole));

/** `text` as lines of at most `width` columns, `indent` included; a word longer than that stands alone. */
function wrapWords(text: string, { width = HELP_WIDTH, indent = '' }: { width?: number; indent?: string } = {}): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && indent.length + next.length > width) {
      lines.push(indent + line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(indent + line);
  return lines;
}

const overviewRow = (label: string, text: string): string => `${HELP_INDENT}${label.padEnd(Math.max(LABEL_COLUMN, label.length + 2))}${text}`;

/** The one screen `omni help` prints: the loop, its principles, then every command by who runs it. */
export function renderOverview(config: HelpConfig, { entries = ENTRIES }: { entries?: readonly HelpEntry[] } = {}): string {
  const fill = fillerFor(repositoryWords(config));
  const under = ' '.repeat(HELP_INDENT.length + STAGE_COLUMN);
  const lines = [
    "omni: the Omni Loop's command line",
    '',
    'THE LOOP',
    `${HELP_INDENT}${STAGES.map((stage) => stage.name).join(' ──▶ ')}`,
    '',
  ];
  for (const stage of STAGES) {
    const [first, ...more] = wrapWords(fill(stage.line), { width: HELP_WIDTH - under.length });
    lines.push(`${HELP_INDENT}${stage.name.padEnd(STAGE_COLUMN)}${first}`, ...more.map((line) => under + line));
    if (stage.folder) lines.push(under + fill(stage.folder));
  }
  lines.push('', ...wrapWords(PRINCIPLES.map(fill).join(' '), { indent: HELP_INDENT }), '');

  lines.push('IN CLAUDE (type these)');
  // A skill for you always has its label: the help table's own test refuses one without.
  for (const entry of entries.filter((e) => e.kind === 'skill' && e.who === 'you')) {
    lines.push(overviewRow(fill(entry.label ?? ''), fill(entry.summary)));
  }

  lines.push('', 'IN THE TERMINAL');
  const yours = entries.filter((e) => e.kind === 'command' && e.who === 'you');
  for (const entry of yours.filter(hasLabel)) {
    lines.push(overviewRow(fill(entry.label), fill(entry.summary)));
    for (const [label, text] of entry.also ?? []) lines.push(overviewRow(fill(label), fill(text)));
  }
  const unlabelled = yours.filter((e) => !e.label).map((e) => e.name);
  if (unlabelled.length) lines.push(`${HELP_INDENT}omni ${unlabelled.join(' · ')}`);

  const commands = entries.filter((e) => e.kind === 'command' && e.who === 'skills').map((e) => e.name);
  const skills = entries.filter((e) => e.kind === 'skill' && e.who === 'skills').map((e) => `/omni:${e.name}`);
  if (commands.length || skills.length) {
    const named = [commands.join(', '), skills.join(', ')].filter(Boolean).join('; and ');
    lines.push('', ...wrapWords(`Run by the skills: ${named}.`, { indent: HELP_INDENT }));
  }
  lines.push('', HELP_CLOSING);
  return lines.join('\n');
}

/** `text` wrapped under `label`, its continuation lines aligned with the text. */
function labelled(label: string, text: string): string[] {
  const under = ' '.repeat(DOCS_LABEL_COLUMN);
  const [first = '', ...more] = wrapWords(text, { width: HELP_WIDTH - DOCS_LABEL_COLUMN });
  return [label.padEnd(DOCS_LABEL_COLUMN) + first, ...more.map((line) => under + line)];
}

/** A skill's When line and its Example, with what you get back under it (PRD 580); none for a command. */
function docsLines(entry: HelpEntry, fill: Fill): string[] {
  if (!entry.when || !entry.example) return [];
  const under = ' '.repeat(DOCS_LABEL_COLUMN);
  const result = wrapWords(fill(entry.example.result), { width: HELP_WIDTH - DOCS_LABEL_COLUMN - 2 });
  return [
    '',
    ...labelled('When', fill(entry.when)),
    ...labelled('Example', fill(entry.example.type)),
    ...result.map((line, index) => `${under}${index ? '  ' : '→ '}${line}`),
  ];
}

/** One entry: its usage with who runs it, then its sentences, then a skill's When and Example. */
function entryLines(entry: HelpEntry, fill: Fill): string[] {
  const [first = '', ...more] = entry.usage.map(fill);
  const who = WHO_RUNS[entry.who];
  const head = first.length + 2 + who.length <= HELP_WIDTH
    ? [`${first.padEnd(HELP_WIDTH - who.length)}${who}`, ...more]
    : [first, ...more, who.padStart(HELP_WIDTH)];
  const paragraphs = entry.detail.split(/\n\s*\n/).map((paragraph) => wrapWords(fill(paragraph)));
  return [...head, '', ...paragraphs.flatMap((lines, index) => (index ? ['', ...lines] : lines)), ...docsLines(entry, fill)];
}

/**
 * What `omni help <name>` prints: a command (`board`) or a skill (`yolo`) by its name, the command's
 * entry first when the name is both; a slash command (`/omni:yolo`) is the skill's alone. `null` for
 * a name the table does not know.
 */
export function renderEntry(name: string, config: HelpConfig, { entries = ENTRIES }: { entries?: readonly HelpEntry[] } = {}): string | null {
  const slash = /^\/omni:(.+)$/.exec(name);
  const found = slash
    ? entries.filter((e) => e.kind === 'skill' && e.name === slash[1])
    : ['command', 'skill'].flatMap((kind) => entries.filter((e) => e.kind === kind && e.name === name));
  if (found.length === 0) return null;
  const fill = fillerFor(repositoryWords(config));
  return found.map((entry) => entryLines(entry, fill).join('\n')).join('\n\n');
}
