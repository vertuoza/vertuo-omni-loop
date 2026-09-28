// The help table's guard (PRD 315, D4): the help text is written by hand, so this test holds it to
// the CLI's command table and the plugin's skill folders. A command or a skill with no entry of its
// kind fails, and so does an entry naming one that does not exist. Each rule runs on the live table,
// then on a fixture built to break it.
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COMMAND_TABLE } from '../../bin/commands/index.mjs';
import { ENTRIES, PRINCIPLES, STAGES } from './entries.mjs';

const SKILLS_DIR = fileURLToPath(new URL('../../plugin/skills', import.meta.url));
const skillFolders = () => readdirSync(SKILLS_DIR, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
const KINDS = ['command', 'skill'];
const WHO = ['you', 'skills'];
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const oneLine = (value) => isText(value) && !value.includes('\n');

/** Every way `entries` fails the command table and the skill folders, as one line each. */
function entryViolations(entries, { commands, skills }) {
  const out = [];
  const known = { command: new Set(commands), skill: new Set(skills) };
  const seen = { command: new Map(), skill: new Map() };
  for (const entry of entries) {
    const what = `${entry.kind} ${entry.name}`;
    if (!KINDS.includes(entry.kind)) {
      out.push(`${entry.name}: kind "${entry.kind}" is neither command nor skill`);
      continue;
    }
    seen[entry.kind].set(entry.name, (seen[entry.kind].get(entry.name) ?? 0) + 1);
    if (!known[entry.kind].has(entry.name)) out.push(`${what}: no such ${entry.kind}`);
    if (!WHO.includes(entry.who)) out.push(`${what}: who is "${entry.who}", not you or skills`);
    if (!Array.isArray(entry.usage) || entry.usage.length === 0 || !entry.usage.every(oneLine)) out.push(`${what}: no usage`);
    if (!oneLine(entry.summary)) out.push(`${what}: its summary is not one line`);
    if (!isText(entry.detail)) out.push(`${what}: no detail`);
    if (entry.kind === 'skill' && entry.who === 'you' && !oneLine(entry.label)) out.push(`${what}: a skill for you needs its label`);
    if (entry.who === 'skills' && (entry.label !== undefined || entry.also !== undefined)) out.push(`${what}: run by the skills, it has no row`);
  }
  for (const kind of KINDS) {
    for (const name of known[kind]) {
      const count = seen[kind].get(name) ?? 0;
      if (count === 0) out.push(`${kind} ${name}: no entry`);
      if (count > 1) out.push(`${kind} ${name}: ${count} entries`);
    }
  }
  return out;
}

const entry = (over) => ({ name: 'x', kind: 'command', who: 'you', usage: ['omni x'], summary: 'does x', detail: 'Does x.', ...over });

describe('the help table in this repository', () => {
  it('has one entry per command and per skill, and none for anything else', () => {
    expect(entryViolations(ENTRIES, { commands: Object.keys(COMMAND_TABLE), skills: skillFolders() })).toEqual([]);
  });

  it('holds the 29 commands and the 13 skills', () => {
    expect(Object.keys(COMMAND_TABLE)).toHaveLength(29);
    expect(skillFolders()).toHaveLength(13);
    expect(ENTRIES.filter((e) => e.kind === 'command')).toHaveLength(29);
    expect(ENTRIES.filter((e) => e.kind === 'skill')).toHaveLength(13);
  });

  it('names the six stages of the loop in order, each with one line, and three principles', () => {
    expect(STAGES.map((stage) => stage.name)).toEqual(['idea', 'PRD', 'inbox', 'outbox', 'shipped', 'retro']);
    for (const stage of STAGES) expect(oneLine(stage.line), stage.name).toBe(true);
    expect(PRINCIPLES).toHaveLength(3);
  });

  it('lists every verb of omni dossier, link included (PRD 413)', () => {
    const dossier = ENTRIES.find((e) => e.name === 'dossier' && e.kind === 'command');
    expect(dossier.usage).toEqual(['omni dossier open "<title>"', 'omni dossier push <n>', 'omni dossier link <n>', 'omni dossier status']);
    expect(dossier.detail).toMatch(/\blink prints PRD n's page\b/);
  });

  it('is frozen, down to each entry and its usage', () => {
    expect(Object.isFrozen(ENTRIES)).toBe(true);
    for (const e of ENTRIES) {
      expect(Object.isFrozen(e), e.name).toBe(true);
      expect(Object.isFrozen(e.usage), e.name).toBe(true);
    }
  });
});

describe('the help table guard catches what it is for', () => {
  const live = { commands: ['x', 'y'], skills: ['s'] };
  const good = [entry({ name: 'x' }), entry({ name: 'y', who: 'skills' }), entry({ name: 's', kind: 'skill', usage: ['/omni:s'], label: '/omni:s' })];

  it('passes a table that matches', () => {
    expect(entryViolations(good, live)).toEqual([]);
  });

  it('flags a command and a skill with no entry of their kind', () => {
    const table = [entry({ name: 'x' }), entry({ name: 's', usage: ['omni s'] })];
    expect(entryViolations(table, live)).toEqual(['command s: no such command', 'command y: no entry', 'skill s: no entry']);
  });

  it('flags an entry naming a command or a skill that does not exist, and one named twice', () => {
    const table = [...good, entry({ name: 'teleport' }), entry({ name: 'gone', kind: 'skill', label: '/omni:gone' }), entry({ name: 'x' })];
    expect(entryViolations(table, live)).toEqual(['command teleport: no such command', 'skill gone: no such skill', 'command x: 2 entries']);
  });

  it('flags an entry without a usage, a one-line summary or a detail, and one of no kind', () => {
    const table = [
      entry({ name: 'x', usage: [] }),
      entry({ name: 'y', summary: 'two\nlines', detail: ' ', who: 'nobody' }),
      entry({ name: 's', kind: 'skill', usage: ['/omni:s'] }),
      entry({ name: 'z', kind: 'tool' }),
    ];
    expect(entryViolations(table, live)).toEqual([
      'command x: no usage',
      'command y: who is "nobody", not you or skills',
      'command y: its summary is not one line',
      'command y: no detail',
      'skill s: a skill for you needs its label',
      'z: kind "tool" is neither command nor skill',
    ]);
  });

  it('flags an entry run by the skills that carries a row of the overview', () => {
    const table = [good[0], entry({ name: 'y', who: 'skills', label: 'omni y' }), good[2]];
    expect(entryViolations(table, live)).toEqual(['command y: run by the skills, it has no row']);
  });
});
