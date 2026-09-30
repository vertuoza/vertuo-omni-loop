// The help table's guard (PRD 315, D4): the help text is written by hand, so this test holds it to
// the CLI's command table and the plugin's skill folders. A command or a skill with no entry of its
// kind fails, and so does an entry naming one that does not exist. Each rule runs on the live table,
// then on a fixture built to break it.
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COMMAND_TABLE } from '../../bin/commands/index.mjs';
import { STAGE_ORDER, STAGE_WORDS } from '../status/format.mjs';
import { ENTRIES, PRINCIPLES, SKILL_GROUPS, STAGES } from './entries.mjs';

const SKILLS_DIR = fileURLToPath(new URL('../../plugin/skills', import.meta.url));
const skillFolders = () => readdirSync(SKILLS_DIR, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
const KINDS = ['command', 'skill'];
const WHO = ['you', 'skills'];
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const oneLine = (value) => isText(value) && !value.includes('\n');
const GROUP_IDS = SKILL_GROUPS.map((group) => group.id);
const DOCS_FIELDS = ['group', 'when', 'example'];
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every way a skill entry fails its docs fields (PRD 580), or a command entry carries one. */
function docsViolations(entry, what) {
  if (entry.kind === 'command') {
    const carried = DOCS_FIELDS.filter((field) => entry[field] !== undefined);
    return carried.length ? [`${what}: a command has no ${carried.join(', ')}`] : [];
  }
  const out = [];
  if (!GROUP_IDS.includes(entry.group)) out.push(`${what}: group "${entry.group}" is not one of SKILL_GROUPS`);
  if (!oneLine(entry.when) || !entry.when.startsWith('Use it when ')) out.push(`${what}: its when is not one line starting "Use it when"`);
  const example = entry.example ?? {};
  const typed = new RegExp(`^/omni:${escape(entry.name)}(\\s|$)`);
  if (!oneLine(example.type) || !typed.test(example.type)) out.push(`${what}: its example type is not one line starting /omni:${entry.name}`);
  if (!oneLine(example.result)) out.push(`${what}: its example result is not one line`);
  return out;
}

/** Every way one entry's own fields fail, whatever the table holds. */
function fieldViolations(entry, what) {
  const out = [];
  if (!WHO.includes(entry.who)) out.push(`${what}: who is "${entry.who}", not you or skills`);
  if (!Array.isArray(entry.usage) || entry.usage.length === 0 || !entry.usage.every(oneLine)) out.push(`${what}: no usage`);
  if (!oneLine(entry.summary)) out.push(`${what}: its summary is not one line`);
  if (!isText(entry.detail)) out.push(`${what}: no detail`);
  return out;
}

/** Every way an entry fails the row rules: a skill for you needs its label, one run by the skills has no row. */
function rowViolations(entry, what) {
  const out = [];
  if (entry.kind === 'skill' && entry.who === 'you' && !oneLine(entry.label)) out.push(`${what}: a skill for you needs its label`);
  if (entry.who === 'skills' && (entry.label !== undefined || entry.also !== undefined)) out.push(`${what}: run by the skills, it has no row`);
  return out;
}

/** Every command or skill with no entry, or with more than one. */
function countViolations(known, seen) {
  const out = [];
  for (const kind of KINDS) {
    for (const name of known[kind]) {
      const count = seen[kind].get(name) ?? 0;
      if (count === 0) out.push(`${kind} ${name}: no entry`);
      if (count > 1) out.push(`${kind} ${name}: ${count} entries`);
    }
  }
  return out;
}

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
    out.push(...fieldViolations(entry, what), ...rowViolations(entry, what), ...docsViolations(entry, what));
  }
  return [...out, ...countViolations(known, seen)];
}

const EXAMPLE = { type: '/omni:s', result: 'does s' };
const entry = (over) => ({ name: 'x', kind: 'command', who: 'you', usage: ['omni x'], summary: 'does x', detail: 'Does x.', ...over });

describe('the help table in this repository', () => {
  it('has one entry per command and per skill, and none for anything else', () => {
    expect(entryViolations(ENTRIES, { commands: Object.keys(COMMAND_TABLE), skills: skillFolders() })).toEqual([]);
  });

  it('holds the 37 commands and the 21 skills', () => {
    expect(Object.keys(COMMAND_TABLE)).toHaveLength(37);
    expect(skillFolders()).toHaveLength(21);
    expect(ENTRIES.filter((e) => e.kind === 'command')).toHaveLength(37);
    expect(ENTRIES.filter((e) => e.kind === 'skill')).toHaveLength(21);
  });

  it('lists /omni:think-big for you, first under Start a change, right before /omni:brainstorm (PRD 686)', () => {
    const skills = ENTRIES.filter((e) => e.kind === 'skill');
    const thinkBig = skills.find((e) => e.name === 'think-big');
    expect(thinkBig).toMatchObject({ who: 'you', usage: ['/omni:think-big <brief or n>'], label: '/omni:think-big', group: 'start' });
    expect(skills.indexOf(thinkBig)).toBe(skills.findIndex((e) => e.name === 'brainstorm') - 1);
    expect(thinkBig.detail).toMatch(/\bvast idea\b/);
    expect(thinkBig.detail).toMatch(/\bconcept PR\b/);
    expect(thinkBig.detail).toMatch(/\/omni:brainstorm --concept <n> <area>/);
    expect(thinkBig.detail).toMatch(/\/omni:visual-fix\b/);
    expect(thinkBig.detail).toMatch(/\bnever merges\b/);
  });

  it("gives /omni:brainstorm's usage --concept <n> <area>, and names /omni:think-big on the idea stage's line (PRD 686)", () => {
    const brainstorm = ENTRIES.find((e) => e.name === 'brainstorm' && e.kind === 'skill');
    expect(brainstorm.usage).toEqual(['/omni:brainstorm', '/omni:brainstorm --concept <n> <area>']);
    expect(brainstorm.label).toBe('/omni:brainstorm');
    const idea = STAGES.find((stage) => stage.name === 'idea');
    expect(idea.line).toMatch(/\/omni:brainstorm\b/);
    expect(idea.line).toMatch(/\/omni:think-big\b/);
  });

  it('says /omni:think-big runs /omni:dossier-open, as /omni:brainstorm does (PRD 686)', () => {
    const dossierOpen = ENTRIES.find((e) => e.name === 'dossier-open' && e.kind === 'skill');
    expect(dossierOpen.detail).toMatch(/\/omni:brainstorm\b.*\/omni:think-big\b/);
  });

  it('lists omni concept for skills, after omni bug, with its usage and what it checks (PRD 686)', () => {
    const commands = ENTRIES.filter((e) => e.kind === 'command');
    const concept = commands.find((e) => e.name === 'concept');
    expect(concept).toMatchObject({ who: 'skills', usage: ['omni concept <n> [--base <ref>]'] });
    expect(commands.indexOf(concept)).toBe(commands.findIndex((e) => e.name === 'bug') + 1);
    expect(concept.detail).toMatch(/\bconcept\.md\b/);
    expect(concept.detail).toMatch(/\bboard-r<k>\.html\b/);
    expect(concept.detail).toMatch(/\bloads nothing from the network\b/);
    expect(concept.detail).toMatch(/\bno file outside\b/);
  });

  it('lists omni bug for skills, with its usage (PRD 556)', () => {
    const bug = ENTRIES.find((e) => e.name === 'bug' && e.kind === 'command');
    expect(bug).toMatchObject({ who: 'skills', usage: ['omni bug <n> [--base <ref>]'] });
    expect(bug.detail).toMatch(/\/omni:bug-fix\b/);
  });

  it('lists /omni:bug-fix for you, after /omni:visual-fix, with its usage and when to use it (PRD 556)', () => {
    const skills = ENTRIES.filter((e) => e.kind === 'skill');
    const bugFix = skills.find((e) => e.name === 'bug-fix');
    expect(bugFix).toMatchObject({ who: 'you', usage: ['/omni:bug-fix <line or n>'], label: '/omni:bug-fix' });
    expect(skills.indexOf(bugFix)).toBe(skills.findIndex((e) => e.name === 'visual-fix') + 1);
    expect(bugFix.detail).toMatch(/\bbug\b/);
    expect(bugFix.detail).toMatch(/\/omni:brainstorm\b/);
    expect(bugFix.detail).toMatch(/never merges/);
  });

  it('lists /omni:visual-fix for you, with its usage and when to use it (PRD 541)', () => {
    const visualFix = ENTRIES.find((e) => e.name === 'visual-fix' && e.kind === 'skill');
    expect(visualFix).toMatchObject({ who: 'you', usage: ['/omni:visual-fix <line or n>'], label: '/omni:visual-fix' });
    expect(visualFix.detail).toMatch(/\bsmall visual change\b/);
    expect(visualFix.detail).toMatch(/\/omni:brainstorm\b/);
  });

  it('has /omni:mega-invade for you, with --sync, after /omni:invade (PRD 522)', () => {
    const skills = ENTRIES.filter((e) => e.kind === 'skill');
    const mega = skills.find((e) => e.name === 'mega-invade');
    expect(mega).toMatchObject({ who: 'you', usage: ['/omni:mega-invade [--sync]'], label: '/omni:mega-invade' });
    expect(skills.indexOf(mega)).toBe(skills.findIndex((e) => e.name === 'invade') + 1);
    expect(mega.detail).toMatch(/\bplan repository\b/);
    expect(mega.detail).toMatch(/\bomni targets\b/);
    expect(mega.detail).toMatch(/--sync/);
  });

  it('has /omni:mega-brainstorm for you, after /omni:brainstorm, naming the plan repository and ultra-yolo (PRD 549)', () => {
    const skills = ENTRIES.filter((e) => e.kind === 'skill');
    const mega = skills.find((e) => e.name === 'mega-brainstorm');
    expect(mega).toMatchObject({ who: 'you', usage: ['/omni:mega-brainstorm'], label: '/omni:mega-brainstorm' });
    expect(skills.indexOf(mega)).toBe(skills.findIndex((e) => e.name === 'brainstorm') + 1);
    expect(mega.detail).toMatch(/\bplan repository\b/);
    expect(mega.detail).toMatch(/\/omni:mega-invade\b/);
    expect(mega.detail).toMatch(/\/omni:ultra-yolo\b/);
    expect(mega.detail).toMatch(/\bnever writes in a target\b/);
  });

  it('has /omni:ultra-yolo, ultra-yolo-fix and ultra-wave for you, each after its twin (PRD 563)', () => {
    const skills = ENTRIES.filter((e) => e.kind === 'skill');
    // The fix's label drops its <n>, as /omni:do-work's does, to fit the overview's label column.
    for (const [name, twin, usage, label] of [
      ['ultra-yolo', 'yolo', '/omni:ultra-yolo <n>', '/omni:ultra-yolo <n>'],
      ['ultra-yolo-fix', 'yolo-fix', '/omni:ultra-yolo-fix <n>', '/omni:ultra-yolo-fix'],
      ['ultra-wave', 'wave', '/omni:ultra-wave <n>', '/omni:ultra-wave <n>'],
    ]) {
      const ultra = skills.find((e) => e.name === name);
      expect(ultra, name).toMatchObject({ who: 'you', usage: [usage], label });
      expect(skills.indexOf(ultra), name).toBe(skills.findIndex((e) => e.name === twin) + 1);
      expect(ultra.detail, name).toMatch(/\bplan repository\b/);
      expect(ultra.detail, name).toMatch(/\bnever merges into any default branch\b/);
    }
  });

  it('groups the skills by what you want to do, in the spec\'s order, with its titles (PRD 580)', () => {
    expect(SKILL_GROUPS).toEqual([
      { id: 'start', title: 'Start a change' },
      { id: 'build', title: 'Build it' },
      { id: 'setup', title: 'Set up a repository' },
      { id: 'multi-repo', title: 'Several repositories' },
      { id: 'everyday', title: 'Every day' },
      { id: 'run-by-skills', title: 'Run by other skills' },
    ]);
    expect(Object.isFrozen(SKILL_GROUPS)).toBe(true);
    const byGroup = Object.fromEntries(GROUP_IDS.map((id) => [id, ENTRIES.filter((e) => e.kind === 'skill' && e.group === id).map((e) => e.name).sort()]));
    expect(byGroup).toEqual({
      start: ['brainstorm', 'bug-fix', 'think-big', 'visual-fix'],
      build: ['do-work', 'plan', 'pr', 'wave', 'yolo', 'yolo-fix'],
      setup: ['invade'],
      'multi-repo': ['mega-brainstorm', 'mega-invade', 'ultra-wave', 'ultra-yolo', 'ultra-yolo-fix'],
      everyday: ['ask', 'help', 'status'],
      'run-by-skills': ['dossier-open', 'dossier-push'],
    });
  });

  it('names the seven stages of the loop in order, in the kit\'s stage words, each with one line, and three principles', () => {
    expect(STAGES.map((stage) => stage.name)).toEqual(['idea', 'PRD', 'inbox', 'building', 'outbox', 'shipped', 'retro']);
    expect(STAGES.map((stage) => stage.name)).toEqual(STAGE_ORDER.map((stage) => STAGE_WORDS[stage]));
    for (const stage of STAGES) expect(oneLine(stage.line), stage.name).toBe(true);
    expect(PRINCIPLES).toHaveLength(3);
  });

  it('shows omni item new --out and omni item relay (PRD 563)', () => {
    const item = ENTRIES.find((e) => e.name === 'item' && e.kind === 'command');
    expect(item.usage.join(' ')).toMatch(/--out <dir>/);
    expect(item.usage).toContain('omni item relay <dir> --prd <n>');
    expect(item.detail).toMatch(/\bnever adopts\b/);
    expect(item.detail).toMatch(/\brelay moves\b/);
  });

  it('lists every verb of omni dossier, link included (PRD 413)', () => {
    const dossier = ENTRIES.find((e) => e.name === 'dossier' && e.kind === 'command');
    expect(dossier.usage).toEqual(['omni dossier open "<title>"', 'omni dossier push <n> [--kind visual|bug]', 'omni dossier link <n> [--kind visual|bug]', 'omni dossier status']);
    expect(dossier.detail).toMatch(/\blink prints PRD n's page\b/);
  });

  it('names --kind on dossier push, /omni:dossier-push and both fix skills (PRD 627)', () => {
    const find = (name, kind) => ENTRIES.find((e) => e.name === name && e.kind === kind);
    expect(find('dossier', 'command').detail).toMatch(/--kind visual or --kind bug\b.*\bissue n's fix\b/);
    expect(find('dossier-push', 'skill').usage).toEqual(['/omni:dossier-push <n> [--kind visual|bug]']);
    expect(find('dossier-push', 'skill').detail).toMatch(/\/omni:visual-fix\b.*\/omni:bug-fix\b.*--kind/);
    expect(find('visual-fix', 'skill').detail).toMatch(/\/omni:dossier-push <n> --kind visual\b/);
    expect(find('visual-fix', 'skill').detail).toMatch(/\bevery round of variations\b/);
    expect(find('bug-fix', 'skill').detail).toMatch(/\/omni:dossier-push <n> --kind bug\b/);
  });

  it('says omni visual checks the rounds of variations (PRD 627)', () => {
    const visual = ENTRIES.find((e) => e.name === 'visual' && e.kind === 'command');
    expect(visual.detail).toMatch(/\bvariations-r<k>\.html\b/);
    expect(visual.detail).toMatch(/\bno other file\b/);
  });

  it('is frozen, down to each entry and its usage', () => {
    expect(Object.isFrozen(ENTRIES)).toBe(true);
    for (const e of ENTRIES) {
      expect(Object.isFrozen(e), e.name).toBe(true);
      expect(Object.isFrozen(e.usage), e.name).toBe(true);
    }
  });
});

const skill = (over) => entry({ kind: 'skill', usage: ['/omni:s'], label: '/omni:s', group: 'build', when: 'Use it when s.', example: EXAMPLE, ...over });

describe('the help table guard catches what it is for', () => {
  const live = { commands: ['x', 'y'], skills: ['s'] };
  const good = [entry({ name: 'x' }), entry({ name: 'y', who: 'skills' }), skill({ name: 's' })];

  it('passes a table that matches', () => {
    expect(entryViolations(good, live)).toEqual([]);
  });

  it('flags a command and a skill with no entry of their kind', () => {
    const table = [entry({ name: 'x' }), entry({ name: 's', usage: ['omni s'] })];
    expect(entryViolations(table, live)).toEqual(['command s: no such command', 'command y: no entry', 'skill s: no entry']);
  });

  it('flags an entry naming a command or a skill that does not exist, and one named twice', () => {
    const table = [...good, entry({ name: 'teleport' }), skill({ name: 'gone', example: { type: '/omni:gone', result: 'r' } }), entry({ name: 'x' })];
    expect(entryViolations(table, live)).toEqual(['command teleport: no such command', 'skill gone: no such skill', 'command x: 2 entries']);
  });

  it('flags an entry without a usage, a one-line summary or a detail, and one of no kind', () => {
    const table = [
      entry({ name: 'x', usage: [] }),
      entry({ name: 'y', summary: 'two\nlines', detail: ' ', who: 'nobody' }),
      skill({ name: 's', label: undefined }),
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

  it('flags a skill entry missing its group, its when line or its example (PRD 580)', () => {
    for (const [field, message] of [
      ['group', 'skill s: group "undefined" is not one of SKILL_GROUPS'],
      ['when', 'skill s: its when is not one line starting "Use it when"'],
      ['example', 'skill s: its example type is not one line starting /omni:s'],
    ]) {
      const table = [good[0], good[1], skill({ name: 's', [field]: undefined })];
      expect(entryViolations(table, live), field).toContain(message);
    }
  });

  it('flags a group outside SKILL_GROUPS, a when not starting "Use it when" and a when on two lines', () => {
    expect(entryViolations([good[0], good[1], skill({ name: 's', group: 'misc' })], live)).toEqual(['skill s: group "misc" is not one of SKILL_GROUPS']);
    const message = 'skill s: its when is not one line starting "Use it when"';
    expect(entryViolations([good[0], good[1], skill({ name: 's', when: 'When you need s.' })], live)).toEqual([message]);
    expect(entryViolations([good[0], good[1], skill({ name: 's', when: 'Use it when\nyou need s.' })], live)).toEqual([message]);
  });

  it('flags an example typed as another skill, and a result not on one line', () => {
    const typedAs = (type) => entryViolations([good[0], good[1], skill({ name: 's', example: { type, result: 'r' } })], live);
    expect(typedAs('/omni:yolo 7')).toEqual(['skill s: its example type is not one line starting /omni:s']);
    expect(typedAs('/omni:s-fix 7')).toEqual(['skill s: its example type is not one line starting /omni:s']);
    expect(typedAs('/omni:s 7')).toEqual([]);
    expect(entryViolations([good[0], good[1], skill({ name: 's', example: { type: '/omni:s', result: 'two\nlines' } })], live)).toEqual([
      'skill s: its example result is not one line',
    ]);
  });

  it('flags a command entry carrying a group, a when line or an example', () => {
    const table = [entry({ name: 'x', group: 'build', when: 'Use it when x.', example: EXAMPLE }), good[1], good[2]];
    expect(entryViolations(table, live)).toEqual(['command x: a command has no group, when, example']);
  });
});
