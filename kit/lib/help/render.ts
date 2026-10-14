// `omni help` as text (PRD 315): the overview of the loop and every command, and one entry. Pure:
// it reads the help table and the config it is given, fills the repository's words in, and lays the
// lines out. Plain text, no colour, no line wider than 80 columns. A skill shows in the form of each
// agent the config lists (PRD 1890).
import { AGENTS } from '../config.ts';
import type { Agent } from '../types.ts';
import { ENTRIES, PRINCIPLES, STAGES } from './entries.ts';
import type { HelpEntry } from './entries.ts';

/**
 * The config keys the help fills in: the delivery folder, the remote and the default branch, and the
 * agents whose forms it shows (Claude's alone when there is no `agents`).
 */
export type HelpConfig = {
  readonly paths: { readonly delivery: string };
  readonly repo: { readonly remote: string; readonly defaultBranch: string };
  readonly agents?: readonly Agent[];
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

/**
 * How each agent runs a skill (PRD 1890): Claude through its plugin, the others through the
 * `.agents/skills/omni-<name>/` copies; Gemini CLI activates a skill by its description, so it is
 * asked for one. A change of an agent's convention is an edit of this table.
 */
const AGENT_FORMS: Readonly<Record<Agent, (name: string, args: string) => string>> = Object.freeze({
  claude: (name, args) => `/omni:${name}${args && ` ${args}`}`,
  codex: (name, args) => `$omni-${name}${args && ` ${args}`}`,
  cursor: (name, args) => `/omni-${name}${args && ` ${args}`}`,
  gemini: (name, args) => `ask for omni-${name}${args && `, ${args}`}`,
});
/** Claude loops a skill run under `/loop`; another agent runs one tick of it, then again. */
const LOOP = '/loop ';
const TICK_LINE = 'run it again after the wait it names';
const SKILL_FORM = /^(\/loop )?\/omni:([\w-]+)(?: (.*))?$/;

/** The agents the config lists, in the kit's order, so Claude's form comes first. */
const agentsOf = (config: HelpConfig): Agent[] => AGENTS.filter((agent) => (config.agents ?? ['claude']).includes(agent));

/** A skill's Claude form (`/omni:yolo <n>`, `/loop /omni:drive`) in each agent's, once each. */
function agentForms(claudeForm: string, agents: readonly Agent[]): string[] {
  const match = SKILL_FORM.exec(claudeForm);
  if (!match) return [claudeForm];
  const [, loop = '', name = '', args = ''] = match;
  return [...new Set(agents.map((agent) => `${agent === 'claude' ? loop : ''}${AGENT_FORMS[agent](name, args)}`))];
}

/** Whether a skill runs under `/loop` in Claude: one of its usages says so. */
const looped = (entry: HelpEntry): boolean => entry.usage.some((usage) => usage.startsWith(LOOP));

/** Whether a listed agent runs the skill a tick at a time: it loops in Claude, and an agent but Claude is listed. */
const ticks = (entry: HelpEntry, agents: readonly Agent[]): boolean => looped(entry) && agents.some((agent) => agent !== 'claude');

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

/**
 * A skill's rows under Run these: one per listed agent's form, its summary beside the first, and,
 * for a skill another agent runs a tick at a time, the line to run it again beside its first tick.
 * A row with no text ends at its label; a label too wide for its text goes on a line of its own.
 */
function skillRows(entry: HelpEntry, agents: readonly Agent[], fill: Fill): string[] {
  const claudeLabel = `${looped(entry) ? LOOP : ''}${fill(entry.label ?? '')}`;
  const rows: [string, string][] = agentForms(claudeLabel, agents).map((label, index) => [label, index ? '' : fill(entry.summary)]);
  if (ticks(entry, agents)) {
    const tick = rows.findIndex(([label]) => !label.startsWith(LOOP));
    const free = rows.findIndex(([, text], index) => index >= tick && !text);
    if (free < 0) rows.splice(tick + 1, 0, ['', TICK_LINE]);
    else rows[free] = [rows[free]?.[0] ?? '', TICK_LINE];
  }
  return rows.flatMap(([label, text]) => {
    if (!text) return [`${HELP_INDENT}${label}`];
    if (label.length + 2 > LABEL_COLUMN && HELP_INDENT.length + label.length + 2 + text.length > HELP_WIDTH + 2) {
      return [`${HELP_INDENT}${label}`, overviewRow('', text)];
    }
    return [overviewRow(label, text)];
  });
}

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

  lines.push('Run these');
  // A skill for you always has its label: the help table's own test refuses one without.
  const agents = agentsOf(config);
  for (const entry of entries.filter((e) => e.kind === 'skill' && e.who === 'you')) lines.push(...skillRows(entry, agents, fill));

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

/** An entry's usage: a command's as written; a skill's in each listed agent's form, with its tick line. */
function usageLines(entry: HelpEntry, agents: readonly Agent[], fill: Fill): string[] {
  const usage = entry.usage.map(fill);
  if (entry.kind !== 'skill') return usage;
  const forms = [...new Set(agents.flatMap((agent) => usage.flatMap((line) => agentForms(line, [agent]))))];
  return ticks(entry, agents) ? [...forms, `Outside Claude, each runs one tick: ${TICK_LINE}.`] : forms;
}

/** One entry: its usage with who runs it, then its sentences, then a skill's When and Example. */
function entryLines(entry: HelpEntry, agents: readonly Agent[], fill: Fill): string[] {
  const [first = '', ...more] = usageLines(entry, agents, fill);
  const who = WHO_RUNS[entry.who];
  const head = first.length + 2 + who.length <= HELP_WIDTH
    ? [`${first.padEnd(HELP_WIDTH - who.length)}${who}`, ...more]
    : [first, ...more, who.padStart(HELP_WIDTH)];
  const paragraphs = entry.detail.split(/\n\s*\n/).map((paragraph) => wrapWords(fill(paragraph)));
  return [...head, '', ...paragraphs.flatMap((lines, index) => (index ? ['', ...lines] : lines)), ...docsLines(entry, fill)];
}

/**
 * What `omni help <name>` prints: a command (`board`) or a skill (`yolo`) by its name, the command's
 * entry first when the name is both; a slash command (`/omni:yolo`), or another agent's form of one
 * (`$omni-yolo`, `/omni-yolo`), is the skill's alone. `null` for
 * a name the table does not know.
 */
export function renderEntry(name: string, config: HelpConfig, { entries = ENTRIES }: { entries?: readonly HelpEntry[] } = {}): string | null {
  const slash = /^(?:\/omni:|\/omni-|\$omni-)(.+)$/.exec(name);
  const found = slash
    ? entries.filter((e) => e.kind === 'skill' && e.name === slash[1])
    : ['command', 'skill'].flatMap((kind) => entries.filter((e) => e.kind === kind && e.name === name));
  if (found.length === 0) return null;
  const fill = fillerFor(repositoryWords(config));
  const agents = agentsOf(config);
  return found.map((entry) => entryLines(entry, agents, fill).join('\n')).join('\n\n');
}
