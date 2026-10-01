import { describe, expect, it } from 'vitest';
import { ConfigSchema } from '../config.mjs';
import { deepMerge } from '../../test/fixture.mjs';
import { ENTRIES, STAGES } from './entries.mjs';
import { renderEntry, renderOverview } from './render.mjs';

const configWith = (over = {}) => ConfigSchema.parse(deepMerge({ kit: 1 }, over));
const DEFAULTS = configWith();
const widest = (text) => Math.max(...text.split('\n').map((line) => [...line].length));

/** The lines of `text` from the one equal to `from` up to, not including, the first equal to `to`. */
function section(text, from, to) {
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
      'IN CLAUDE (type these)',
      'IN THE TERMINAL',
      'Run by the skills:',
      'omni help <command> tells more about any of them.',
    ];
    const at = marks.map((mark) => text.indexOf(mark));
    expect(at.every((index) => index >= 0), JSON.stringify(marks.filter((_, i) => at[i] < 0))).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(text.split('\n').at(-1)).toBe('omni help <command> tells more about any of them.');
  });

  it('shows every command and skill once, in the section of who runs it', () => {
    const claude = section(text, 'IN CLAUDE (type these)', 'IN THE TERMINAL');
    const terminal = section(text, 'IN THE TERMINAL', 'omni help <command> tells more about any of them.');
    const skillsLine = terminal.slice(terminal.indexOf('Run by the skills:')).replace(/\s+/g, ' ');
    const rows = terminal.slice(0, terminal.indexOf('Run by the skills:'));
    const compact = rows.split('\n').find((line) => line.includes(' · ')) ?? '';
    const word = (name) => new RegExp(`(?<![\\w/:-])${name}(?![\\w-])`);
    for (const entry of ENTRIES) {
      const what = `${entry.kind} ${entry.name}`;
      if (entry.who === 'skills') {
        expect(skillsLine, what).toMatch(entry.kind === 'skill' ? new RegExp(`/omni:${entry.name}(?![\\w-])`) : word(entry.name));
      } else if (entry.kind === 'skill') {
        expect(`\n${claude}`, what).toContain(`\n  ${entry.label}  `);
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
const withoutDocs = ENTRIES.map(({ group, when, example, ...rest }) => rest);

describe('renderOverview, beside the docs fields (PRD 580)', () => {
  it('prints the same overview whether or not the skill entries carry them', () => {
    expect(renderOverview(DEFAULTS)).toBe(renderOverview(DEFAULTS, { entries: withoutDocs }));
  });
});

describe('renderEntry', () => {
  it('ends a skill with a blank line, its When line and its Example with the result, within 80 columns (PRD 580)', () => {
    const yolo = ENTRIES.find((e) => e.kind === 'skill' && e.name === 'yolo');
    const text = renderEntry('yolo', DEFAULTS);
    const before = renderEntry('yolo', DEFAULTS, { entries: withoutDocs });
    expect(text.startsWith(`${before}\n\n`)).toBe(true);
    const tail = text.slice(before.length + 2).split('\n');
    expect(tail[0]).toMatch(/^When {5}Use it when /);
    const example = tail.findIndex((line) => line.startsWith('Example  '));
    expect(example).toBeGreaterThan(0);
    expect(tail.slice(0, example).map((line) => line.slice(9)).join(' ')).toBe(yolo.when);
    expect(tail[example]).toBe(`Example  ${yolo.example.type}`);
    expect(tail.slice(example + 1).join(' ').replace(/\s+/g, ' ').trim()).toBe(`→ ${yolo.example.result}`);
    expect(tail[example + 1].startsWith('         → ')).toBe(true);
    expect(widest(text)).toBeLessThanOrEqual(80);
  });

  it('prints a command as it did before, with no When or Example (PRD 580)', () => {
    const board = renderEntry('board', DEFAULTS);
    expect(board).toBe(renderEntry('board', DEFAULTS, { entries: withoutDocs }));
    expect(board).not.toMatch(/^(When|Example) /m);
  });

  it('wraps a long when line under its label and fills the repository words in the example', () => {
    const entries = [{
      name: 's', kind: 'skill', who: 'you', usage: ['/omni:s'], label: '/omni:s', summary: 's', detail: 'Does s.',
      group: 'build', when: `Use it when ${'word '.repeat(20).trim()}.`, example: { type: '/omni:s 7', result: 'a PR into {defaultBranch}' },
    }];
    const lines = renderEntry('s', DEFAULTS, { entries }).split('\n');
    expect(lines.slice(3)).toEqual([
      '',
      `When     Use it when ${'word '.repeat(11).trim()}`,
      `         ${'word '.repeat(9).trim()}.`,
      'Example  /omni:s 7',
      '         → a PR into main',
    ]);
  });

  it('prints the usage, who runs it, then the sentences, all within 80 columns', () => {
    const text = renderEntry('board', DEFAULTS);
    const [first, blank, ...rest] = text.split('\n');
    expect(first).toMatch(/^omni board <prd> \[--json\] \[--repo <owner\/name>\] +for you$/);
    expect(blank).toBe('');
    expect(rest.join(' ')).toMatch(/slices/);
  });

  it('takes a skill by its name or its slash command, and says who runs it', () => {
    expect(renderEntry('yolo', DEFAULTS)).toBe(renderEntry('/omni:yolo', DEFAULTS));
    expect(renderEntry('yolo', DEFAULTS).split('\n')[0]).toMatch(/^\/omni:yolo <n> +for you$/);
    expect(renderEntry('dossier-push', DEFAULTS).split('\n')[0]).toMatch(/ run by the skills$/);
  });

  it('prints the command, then the skill, for a name that is both; the slash command alone for the skill', () => {
    const both = renderEntry('plan', DEFAULTS);
    expect(both.indexOf('omni plan check <prd>')).toBe(0);
    expect(both.indexOf('\n\n/omni:plan')).toBeGreaterThan(0);
    expect(renderEntry('/omni:plan', DEFAULTS).startsWith('/omni:plan')).toBe(true);
  });

  it('returns null for a name it does not know', () => {
    expect(renderEntry('teleport', DEFAULTS)).toBeNull();
    expect(renderEntry('/omni:teleport', DEFAULTS)).toBeNull();
    expect(renderEntry('/omni:board', DEFAULTS)).toBeNull();
    expect(renderEntry('toString', DEFAULTS)).toBeNull();
  });

  it('prints /omni:mega-invade by its name or its slash command (PRD 522)', () => {
    expect(renderEntry('mega-invade', DEFAULTS)).toBe(renderEntry('/omni:mega-invade', DEFAULTS));
    expect(renderEntry('/omni:mega-invade', DEFAULTS).split('\n')[0]).toMatch(/^\/omni:mega-invade \[--sync\] +for you$/);
  });

  it('prints /omni:think-big by its name or its slash command, and both usages of /omni:brainstorm (PRD 686)', () => {
    expect(renderEntry('think-big', DEFAULTS)).toBe(renderEntry('/omni:think-big', DEFAULTS));
    expect(renderEntry('/omni:think-big', DEFAULTS).split('\n')[0]).toMatch(/^\/omni:think-big <brief or n> +for you$/);
    expect(renderEntry('/omni:brainstorm', DEFAULTS).split('\n').slice(0, 2)).toEqual([
      expect.stringMatching(/^\/omni:brainstorm +for you$/),
      '/omni:brainstorm --concept <n> <area>',
    ]);
  });

  it('prints /omni:mega-brainstorm by its name or its slash command (PRD 549)', () => {
    expect(renderEntry('mega-brainstorm', DEFAULTS)).toBe(renderEntry('/omni:mega-brainstorm', DEFAULTS));
    expect(renderEntry('/omni:mega-brainstorm', DEFAULTS).split('\n')[0]).toMatch(/^\/omni:mega-brainstorm +for you$/);
  });

  it('prints /omni:ultra-yolo, ultra-wave and ultra-yolo-fix by their names or their slash commands (PRD 563)', () => {
    for (const name of ['ultra-yolo', 'ultra-wave', 'ultra-yolo-fix']) {
      expect(renderEntry(name, DEFAULTS), name).toBe(renderEntry(`/omni:${name}`, DEFAULTS));
      expect(renderEntry(`/omni:${name}`, DEFAULTS).split('\n')[0], name).toMatch(new RegExp(`^/omni:${name} <n> +for you$`));
    }
  });

  it('fills placeholders and keeps every line of every entry within 80 columns', () => {
    const custom = configWith({ paths: { delivery: 'work/delivery' } });
    for (const { kind, name } of ENTRIES) {
      const asked = kind === 'skill' ? `/omni:${name}` : name;
      for (const config of [DEFAULTS, custom]) {
        const text = renderEntry(asked, config);
        expect(text, asked).not.toMatch(/\{\w+\}/);
        expect(widest(text), asked).toBeLessThanOrEqual(80);
      }
    }
    expect(renderEntry('ship', custom)).toContain('work/delivery/shipped/');
  });

  it('puts who runs it on a line of its own when the usage leaves no room beside it', () => {
    const long = `omni x ${'[--flag <value>] '.repeat(4).trim()}`;
    const entries = [{ name: 'x', kind: 'command', who: 'skills', usage: [long, '  [--more]'], summary: 'x', detail: 'Does x in {delivery}.' }];
    expect(renderEntry('x', DEFAULTS, { entries }).split('\n')).toEqual([
      long,
      '  [--more]',
      `${' '.repeat(78 - 'run by the skills'.length)}run by the skills`,
      '',
      'Does x in .omni-loop/delivery.',
    ]);
  });

  it('wraps the sentences at 78 columns, a blank line between paragraphs', () => {
    const detail = `${'word '.repeat(20).trim()}\n\nsecond paragraph`;
    const entries = [{ name: 'x', kind: 'command', who: 'you', usage: ['omni x'], summary: 'x', detail }];
    const [, , ...body] = renderEntry('x', DEFAULTS, { entries }).split('\n');
    expect(body).toEqual([`${'word '.repeat(15).trim()}`, `${'word '.repeat(5).trim()}`, '', 'second paragraph']);
  });
});
