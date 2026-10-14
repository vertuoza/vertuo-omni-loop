import { describe, expect, it } from 'vitest';
import { ConfigSchema } from '../config.ts';
import { deepMerge } from '../../test/fixture.ts';
import { ENTRIES, STAGES } from './entries.ts';
import type { HelpEntry } from './entries.ts';
import { renderEntry, renderOverview } from './render.ts';
import { assertDefined } from '../../test/assert.ts';

const configWith = (over = {}) => ConfigSchema.parse(deepMerge({ kit: 1 }, over));
const DEFAULTS = configWith();
const widest = (text: string) => Math.max(...text.split('\n').map((line) => Array.from(line).length));

/** `renderEntry` for a name the table knows: its text, never null. */
function entryText(...args: Parameters<typeof renderEntry>): string {
  const text = renderEntry(...args);
  if (text === null) throw new Error(`no help entry for ${args[0]}`);
  return text;
}

/** The lines of `text` from the one equal to `from` up to, not including, the first equal to `to`. */
function section(text: string, from: string, to: string) {
  const lines = text.split('\n');
  const start = lines.indexOf(from);
  const end = lines.indexOf(to, start + 1);
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n');
}

describe('renderOverview', () => {
  const text = renderOverview(DEFAULTS);

  it('lays out the loop, its principles, then Claude, the terminal and what the skills run, in that order', () => {
    const marks = [
      "omni: the Omni Loop's command line",
      'THE LOOP',
      '  idea ──▶ PRD ──▶ inbox ──▶ building ──▶ outbox ──▶ shipped ──▶ retro',
      ...STAGES.map((stage) => `  ${stage.name.padEnd(10)}${stage.line.split('{')[0]}`),
      'The folder is the status.',
      'Run these',
      'IN THE TERMINAL',
      'Run by the skills:',
      'omni help <command> tells more about any of them.',
    ];
    const at = marks.map((mark) => text.indexOf(mark));
    expect(at.every((index) => index >= 0), JSON.stringify(marks.filter((_, i) => (at[i] ?? -1) < 0))).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(text.split('\n').at(-1)).toBe('omni help <command> tells more about any of them.');
  });

  it('shows every command and skill once, in the section of who runs it', () => {
    const claude = section(text, 'Run these', 'IN THE TERMINAL');
    const terminal = section(text, 'IN THE TERMINAL', 'omni help <command> tells more about any of them.');
    const skillsLine = terminal.slice(terminal.indexOf('Run by the skills:')).replace(/\s+/g, ' ');
    const rows = terminal.slice(0, terminal.indexOf('Run by the skills:'));
    const compact = rows.split('\n').find((line) => line.includes(' · ')) ?? '';
    const word = (name: string) => new RegExp(`(?<![\\w/:-])${name}(?![\\w-])`);
    for (const entry of ENTRIES) {
      const what = `${entry.kind} ${entry.name}`;
      if (entry.who === 'skills') {
        expect(skillsLine, what).toMatch(entry.kind === 'skill' ? new RegExp(`/omni:${entry.name}(?![\\w-])`) : word(entry.name));
      } else if (entry.kind === 'skill') {
        const loop = entry.usage.some((usage) => usage.startsWith('/loop '));
        expect(`\n${claude}`, what).toContain(`\n  ${loop ? '/loop ' : ''}${entry.label ?? ''}  `);
      } else if (entry.label) {
        expect(`\n${rows}`, what).toContain(`\n  ${entry.label}  `);
        expect(compact, what).not.toMatch(word(entry.name));
      } else {
        expect(compact, what).toMatch(word(entry.name));
      }
    }
  });

  it('shows the configured delivery folders and default branch', () => {
    const custom = renderOverview(configWith({ paths: { delivery: 'work/delivery' }, repo: { defaultBranch: 'trunk' } }));
    expect(custom).toContain('work/delivery/inbox/');
    expect(custom).toContain('work/delivery/shipped/');
    expect(custom).toContain('Only a person merges into trunk.');
    expect(custom).not.toContain('.omni-loop/delivery');
    expect(text).toContain('.omni-loop/delivery/inbox/');
  });

  it('fills every placeholder and keeps every line within 80 columns', () => {
    expect(text).not.toMatch(/\{\w+\}/);
    expect(widest(text)).toBeLessThanOrEqual(80);
  });
});

/** The table as it stood before PRD 580: no skill entry carries a group, a when line or an example. */
const withoutDocs: HelpEntry[] = ENTRIES.map((entry) => {
  const rest = { ...entry };
  delete rest.group;
  delete rest.when;
  delete rest.example;
  return rest;
});

describe('renderOverview, beside the docs fields (PRD 580)', () => {
  it('prints the same overview whether or not the skill entries carry them', () => {
    expect(renderOverview(DEFAULTS)).toBe(renderOverview(DEFAULTS, { entries: withoutDocs }));
  });
});

describe('renderEntry', () => {
  it('ends a skill with a blank line, its When line and its Example with the result, within 80 columns (PRD 580)', () => {
    const yolo = ENTRIES.find((e) => e.kind === 'skill' && e.name === 'yolo');
    assertDefined(yolo, 'yolo');
    const text = entryText('yolo', DEFAULTS);
    const before = entryText('yolo', DEFAULTS, { entries: withoutDocs });
    expect(text.startsWith(`${before}\n\n`)).toBe(true);
    const tail = text.slice(before.length + 2).split('\n');
    expect(tail[0]).toMatch(/^When {5}Use it when /);
    const example = tail.findIndex((line) => line.startsWith('Example  '));
    expect(example).toBeGreaterThan(0);
    expect(tail.slice(0, example).map((line) => line.slice(9)).join(' ')).toBe(yolo.when);
    assertDefined(yolo.example, 'yolo.example');
    expect(tail[example]).toBe(`Example  ${yolo.example.type}`);
    expect(tail.slice(example + 1).join(' ').replace(/\s+/g, ' ').trim()).toBe(`→ ${yolo.example.result}`);
    const result = tail[example + 1];
    assertDefined(result, 'the line after the example');
    expect(result.startsWith('         → ')).toBe(true);
    expect(widest(text)).toBeLessThanOrEqual(80);
  });

  it('prints a command as it did before, with no When or Example (PRD 580)', () => {
    const board = entryText('board', DEFAULTS);
    expect(board).toBe(entryText('board', DEFAULTS, { entries: withoutDocs }));
    expect(board).not.toMatch(/^(When|Example) /m);
  });

  it('wraps a long when line under its label and fills the repository words in the example', () => {
    const entries: HelpEntry[] = [{
      name: 's', kind: 'skill', who: 'you', usage: ['/omni:s'], label: '/omni:s', summary: 's', detail: 'Does s.',
      group: 'build', when: `Use it when ${'word '.repeat(20).trim()}.`, example: { type: '/omni:s 7', result: 'a PR into {defaultBranch}' },
    }];
    const lines = entryText('s', DEFAULTS, { entries }).split('\n');
    expect(lines.slice(3)).toEqual([
      '',
      `When     Use it when ${'word '.repeat(11).trim()}`,
      `         ${'word '.repeat(9).trim()}.`,
      'Example  /omni:s 7',
      '         → a PR into main',
    ]);
  });

  it('prints the usage, who runs it, then the sentences, all within 80 columns', () => {
    const text = entryText('board', DEFAULTS);
    const [first, blank, ...rest] = text.split('\n');
    expect(first).toMatch(/^omni board <prd> \[--json\] \[--repo <owner\/name>\] +for you$/);
    expect(blank).toBe('');
    expect(rest.join(' ')).toMatch(/slices/);
  });

  it('takes a skill by its name or its slash command, and says who runs it', () => {
    expect(entryText('yolo', DEFAULTS)).toBe(entryText('/omni:yolo', DEFAULTS));
    expect(entryText('yolo', DEFAULTS).split('\n')[0]).toMatch(/^\/omni:yolo <n> +for you$/);
    expect(entryText('dossier-push', DEFAULTS).split('\n')[0]).toMatch(/ run by the skills$/);
  });

  it('prints the command, then the skill, for a name that is both; the slash command alone for the skill', () => {
    const both = entryText('plan', DEFAULTS);
    expect(both.indexOf('omni plan check <prd>')).toBe(0);
    expect(both.indexOf('\n\n/omni:plan')).toBeGreaterThan(0);
    expect(entryText('/omni:plan', DEFAULTS).startsWith('/omni:plan')).toBe(true);
  });

  it('returns null for a name it does not know', () => {
    expect(renderEntry('teleport', DEFAULTS)).toBeNull();
    expect(renderEntry('/omni:teleport', DEFAULTS)).toBeNull();
    expect(renderEntry('/omni:board', DEFAULTS)).toBeNull();
    expect(renderEntry('toString', DEFAULTS)).toBeNull();
  });

  it('prints /omni:mega-invade by its name or its slash command (PRD 522)', () => {
    expect(entryText('mega-invade', DEFAULTS)).toBe(entryText('/omni:mega-invade', DEFAULTS));
    expect(entryText('/omni:mega-invade', DEFAULTS).split('\n')[0]).toMatch(/^\/omni:mega-invade \[--sync\] +for you$/);
  });

  it('prints /omni:think-big by its name or its slash command, and both usages of /omni:brainstorm (PRD 686)', () => {
    expect(entryText('think-big', DEFAULTS)).toBe(entryText('/omni:think-big', DEFAULTS));
    expect(entryText('/omni:think-big', DEFAULTS).split('\n')[0]).toMatch(/^\/omni:think-big <brief or n> +for you$/);
    expect(entryText('/omni:brainstorm', DEFAULTS).split('\n').slice(0, 2)).toEqual([
      expect.stringMatching(/^\/omni:brainstorm +for you$/),
      '/omni:brainstorm --concept <n> <area>',
    ]);
  });

  it('prints /omni:mega-brainstorm by its name or its slash command (PRD 549)', () => {
    expect(entryText('mega-brainstorm', DEFAULTS)).toBe(entryText('/omni:mega-brainstorm', DEFAULTS));
    expect(entryText('/omni:mega-brainstorm', DEFAULTS).split('\n')[0]).toMatch(/^\/omni:mega-brainstorm +for you$/);
  });

  it('prints /omni:ultra-yolo, ultra-wave and ultra-yolo-fix by their names or their slash commands (PRD 563)', () => {
    for (const name of ['ultra-yolo', 'ultra-wave', 'ultra-yolo-fix']) {
      expect(entryText(name, DEFAULTS), name).toBe(entryText(`/omni:${name}`, DEFAULTS));
      expect(entryText(`/omni:${name}`, DEFAULTS).split('\n')[0], name).toMatch(new RegExp(`^/omni:${name} <n> +for you$`));
    }
  });

  it('fills placeholders and keeps every line of every entry within 80 columns', () => {
    const custom = configWith({ paths: { delivery: 'work/delivery' } });
    for (const { kind, name } of ENTRIES) {
      const asked = kind === 'skill' ? `/omni:${name}` : name;
      for (const config of [DEFAULTS, custom]) {
        const text = entryText(asked, config);
        expect(text, asked).not.toMatch(/\{\w+\}/);
        expect(widest(text), asked).toBeLessThanOrEqual(80);
      }
    }
    expect(entryText('ship', custom)).toContain('work/delivery/shipped/');
  });

  it('puts who runs it on a line of its own when the usage leaves no room beside it', () => {
    const long = `omni x ${'[--flag <value>] '.repeat(4).trim()}`;
    const entries: HelpEntry[] = [{ name: 'x', kind: 'command', who: 'skills', usage: [long, '  [--more]'], summary: 'x', detail: 'Does x in {delivery}.' }];
    expect(entryText('x', DEFAULTS, { entries }).split('\n')).toEqual([
      long,
      '  [--more]',
      `${' '.repeat(78 - 'run by the skills'.length)}run by the skills`,
      '',
      'Does x in .omni-loop/delivery.',
    ]);
  });

  it('wraps the sentences at 78 columns, a blank line between paragraphs', () => {
    const detail = `${'word '.repeat(20).trim()}\n\nsecond paragraph`;
    const entries: HelpEntry[] = [{ name: 'x', kind: 'command', who: 'you', usage: ['omni x'], summary: 'x', detail }];
    const [, , ...body] = entryText('x', DEFAULTS, { entries }).split('\n');
    expect(body).toEqual(['word '.repeat(15).trim(), 'word '.repeat(5).trim(), '', 'second paragraph']);
  });
});

describe('each agent its own form (PRD 1890)', () => {
  const ALL = configWith({ agents: ['claude', 'codex', 'cursor', 'gemini'] });
  const run = (text: string) => section(text, 'Run these', 'IN THE TERMINAL');

  it('shows the Claude form alone under Run these when agents is [claude], as before', () => {
    const rows = run(renderOverview(DEFAULTS));
    expect(rows).toContain('\n  /omni:yolo <n>  ');
    expect(rows).not.toMatch(/\$omni-|\/omni-|ask for omni-/);
    expect(rows).toContain('  /loop /omni:drive [<n>…]  ');
    expect(rows).not.toContain('run it again after the wait it names');
  });

  it('shows each listed agent its form of every skill, one line each, under Run these', () => {
    const rows = run(renderOverview(ALL)).split('\n');
    const yolo = rows.findIndex((line) => line.startsWith('  /omni:yolo <n>  '));
    expect(yolo).toBeGreaterThanOrEqual(0);
    expect(rows.slice(yolo + 1, yolo + 4).map((line) => line.trimEnd())).toEqual(['  $omni-yolo <n>', '  /omni-yolo <n>', '  ask for omni-yolo, <n>']);
    expect(rows).toContain('  ask for omni-brainstorm');
    for (const entry of ENTRIES.filter((e) => e.kind === 'skill' && e.who === 'you')) {
      expect(rows.some((line) => line.startsWith(`  $omni-${entry.name}`)), entry.name).toBe(true);
    }
  });

  it('lists only the agents the config names, Claude left out when it is', () => {
    const rows = run(renderOverview(configWith({ agents: ['cursor'] })));
    expect(rows).toMatch(/\n {2}\/omni-yolo <n> +build a whole PRD/);
    expect(rows).not.toMatch(/\/omni:|\$omni-|ask for omni-/);
  });

  it('gives drive /loop for Claude and its tick for the others, run again after the wait it names', () => {
    const rows = run(renderOverview(ALL)).split('\n');
    const drive = rows.findIndex((line) => line.startsWith('  /loop /omni:drive [<n>…]  '));
    expect(drive).toBeGreaterThanOrEqual(0);
    expect(rows[drive + 1]).toMatch(/^ {2}\$omni-drive \[<n>…\] +run it again after the wait it names$/);
    expect(rows[drive + 2]?.trimEnd()).toBe('  /omni-drive [<n>…]');
    const codexOnly = run(renderOverview(configWith({ agents: ['codex'] }))).split('\n');
    const tick = codexOnly.findIndex((line) => line.startsWith('  $omni-drive [<n>…]  '));
    expect(codexOnly[tick + 1]).toMatch(/^ +run it again after the wait it names$/);
  });

  it('keeps every line of the overview and of every entry within 80 columns, whatever the agents', () => {
    for (const agents of [['claude', 'codex', 'cursor', 'gemini'], ['gemini'], ['codex', 'cursor']]) {
      const config = configWith({ agents });
      const text = renderOverview(config);
      expect(widest(text), agents.join()).toBeLessThanOrEqual(80);
      expect(text.split('\n').filter((line) => line !== line.trimEnd()), agents.join()).toEqual([]);
      for (const entry of ENTRIES.filter((e) => e.kind === 'skill')) {
        expect(widest(entryText(entry.name, config)), `${agents.join()} ${entry.name}`).toBeLessThanOrEqual(80);
      }
    }
  });

  it("prints a skill's usage in each listed agent's form, and drive's tick line", () => {
    const yolo = entryText('yolo', ALL).split('\n');
    expect(yolo[0]).toMatch(/^\/omni:yolo <n> +for you$/);
    expect(yolo.slice(1, 4)).toEqual(['$omni-yolo <n>', '/omni-yolo <n>', 'ask for omni-yolo, <n>']);
    const drive = entryText('drive', ALL);
    expect(drive).toMatch(/^\/loop \/omni:drive \[<n>…\] +for you\n\/loop \/omni:drive --roadmap <n>\n\$omni-drive \[<n>…\]\n\$omni-drive --roadmap <n>\n/);
    expect(drive).toContain('\nask for omni-drive, --roadmap <n>\n');
    expect(drive).toContain('run it again after the wait it names');
    expect(entryText('drive', DEFAULTS)).not.toContain('run it again after the wait it names');
    expect(entryText('board', ALL)).toBe(entryText('board', DEFAULTS));
  });

  it("takes a skill by any agent's form of its name", () => {
    for (const asked of ['$omni-yolo', '/omni-yolo']) expect(entryText(asked, ALL), asked).toBe(entryText('yolo', ALL));
    expect(renderEntry('$omni-board', ALL)).toBeNull();
  });

  it("says the status line and the HUD are Claude Code's alone", () => {
    expect(entryText('statusline', DEFAULTS).replace(/\s+/g, ' ')).toMatch(/The status line and the HUD are Claude Code's alone/);
  });
});
