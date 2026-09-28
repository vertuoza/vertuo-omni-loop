// `omni help` as text (PRD 315): the overview of the loop and every command, and one entry. Pure:
// it reads the help table and the config it is given, fills the repository's words in, and lays the
// lines out. Plain text, no colour, no line wider than 80 columns.
import { ENTRIES, PRINCIPLES, STAGES } from './entries.mjs';

const WIDTH = 78; // prose wraps here, and who runs a command ends here
const INDENT = '  ';
const LABEL = 24; // the overview's label column
const STAGE = 9; // the loop's name column
const WHO = Object.freeze({ you: 'for you', skills: 'run by the skills' });
const CLOSING = 'omni help <command> tells more about any of them.';

/** The repository's words the help table leaves in braces. */
function wordsOf(config) {
  const delivery = config.paths.delivery;
  return {
    delivery,
    inbox: `${delivery}/inbox/`,
    shipped: `${delivery}/shipped/`,
    remote: config.repo.remote,
    defaultBranch: config.repo.defaultBranch,
  };
}

const filler = (words) => (text) => text.replace(/\{(\w+)\}/g, (whole, key) => (Object.hasOwn(words, key) ? words[key] : whole));

/** `text` as lines of at most `width` columns, `indent` included; a word longer than that stands alone. */
function wrap(text, { width = WIDTH, indent = '' } = {}) {
  const lines = [];
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

const row = (label, text) => `${INDENT}${label.padEnd(Math.max(LABEL, label.length + 2))}${text}`;

/** The one screen `omni help` prints: the loop, its principles, then every command by who runs it. */
export function renderOverview(config, { entries = ENTRIES } = {}) {
  const fill = filler(wordsOf(config));
  const under = ' '.repeat(INDENT.length + STAGE);
  const lines = ["omni: the Omni Loop's command line", '', 'THE LOOP', `${INDENT}${STAGES.map((stage) => stage.name).join(' ──▶ ')}`, ''];
  for (const stage of STAGES) {
    const [first, ...more] = wrap(fill(stage.line), { width: WIDTH - under.length });
    lines.push(`${INDENT}${stage.name.padEnd(STAGE)}${first}`, ...more.map((line) => under + line));
    if (stage.folder) lines.push(under + fill(stage.folder));
  }
  lines.push('', ...wrap(PRINCIPLES.map(fill).join(' '), { indent: INDENT }), '');

  lines.push('IN CLAUDE (type these)');
  for (const entry of entries.filter((e) => e.kind === 'skill' && e.who === 'you')) lines.push(row(fill(entry.label), fill(entry.summary)));

  lines.push('', 'IN THE TERMINAL');
  const yours = entries.filter((e) => e.kind === 'command' && e.who === 'you');
  for (const entry of yours.filter((e) => e.label)) {
    lines.push(row(fill(entry.label), fill(entry.summary)));
    for (const [label, text] of entry.also ?? []) lines.push(row(fill(label), fill(text)));
  }
  const unlabelled = yours.filter((e) => !e.label).map((e) => e.name);
  if (unlabelled.length) lines.push(`${INDENT}omni ${unlabelled.join(' · ')}`);

  const commands = entries.filter((e) => e.kind === 'command' && e.who === 'skills').map((e) => e.name);
  const skills = entries.filter((e) => e.kind === 'skill' && e.who === 'skills').map((e) => `/omni:${e.name}`);
  if (commands.length || skills.length) {
    const named = [commands.join(', '), skills.join(', ')].filter(Boolean).join('; and ');
    lines.push('', ...wrap(`Run by the skills: ${named}.`, { indent: INDENT }));
  }
  lines.push('', CLOSING);
  return lines.join('\n');
}

/** One entry: its usage with who runs it, then its sentences. */
function entryText(entry, fill) {
  const [first, ...more] = entry.usage.map(fill);
  const who = WHO[entry.who];
  const head = first.length + 2 + who.length <= WIDTH
    ? [`${first.padEnd(WIDTH - who.length)}${who}`, ...more]
    : [first, ...more, who.padStart(WIDTH)];
  const paragraphs = entry.detail.split(/\n\s*\n/).map((paragraph) => wrap(fill(paragraph)));
  return [...head, '', ...paragraphs.flatMap((lines, index) => (index ? ['', ...lines] : lines))].join('\n');
}

/**
 * What `omni help <name>` prints: a command (`board`) or a skill (`yolo`) by its name, the command's
 * entry first when the name is both; a slash command (`/omni:yolo`) is the skill's alone. `null` for
 * a name the table does not know.
 */
export function renderEntry(name, config, { entries = ENTRIES } = {}) {
  const slash = /^\/omni:(.+)$/.exec(name);
  const found = slash
    ? entries.filter((e) => e.kind === 'skill' && e.name === slash[1])
    : ['command', 'skill'].flatMap((kind) => entries.filter((e) => e.kind === kind && e.name === name));
  if (found.length === 0) return null;
  const fill = filler(wordsOf(config));
  return found.map((entry) => entryText(entry, fill)).join('\n\n');
}
