// PRD #324, slices s1, s4 and s6, and PRD #1208, slice s5: the status line's lines, drawn from what was
// read — the context bar and its colours, the 5-hour usage, `ask on`, line 2 drawn from `omni now` for
// every kind and the no-PRD line, the width and `NO_COLOR`.
import { describe, expect, it } from 'vitest';
import {
  contextPart,
  fit,
  itemsPart,
  NO_PRD_LINE,
  renderLines,
  resetIn,
  secondLine,
  sessionLine,
  usagePart,
  visibleLength,
  wavePart,
} from './render.ts';
import { assertDefined } from '../../test/assert.ts';
import { parseIssue, parsePrd } from '../ids.ts';
import { NOTHING } from '../now/now.ts';
import type { Now } from '../now/now.ts';
import { readEnv } from '../env/read.ts';

/** The terminal `main()` reads from `env`. */
const t = (env: Record<string, string>) => readEnv(env).terminal;
const columnsOf = (env: Record<string, string>) => t(env).columns;
const colorOn = (env: Record<string, string>) => t(env).color;

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const NOW = Date.parse('2026-09-28T12:00:00Z');
const MINUTE = 60_000;

const bar = (filled: number) => '█'.repeat(filled) + '░'.repeat(10 - filled);

/** What `parseInput` gives for a full payload: 58.9 % of the context, 25.4 % of the window, 90 minutes left. */
const INPUT = {
  model: 'Opus 5.5',
  contextPercent: 58.9,
  fiveHour: { percent: 25.4, resetsAt: NOW + 90 * MINUTE },
  currentDir: '/work/repo',
  projectDir: '/work/repo',
};
const LINE_1 = `Opus 5.5 · context ${bar(5)} 58% · usage 25%, resets in 1h30 · ask on`;

describe('the context part', () => {
  it.each([
    [0, 0, GREEN],
    [49, 4, GREEN],
    [50, 5, YELLOW],
    [79, 7, YELLOW],
    [80, 8, RED],
    [100, 10, RED],
    [130, 10, RED],
  ])('at %i %% fills %i cells, in its colour', (percent, filled, colour) => {
    expect(contextPart(percent, { color: false })).toBe(`context ${bar(filled)} ${percent}%`);
    expect(contextPart(percent, { color: true })).toBe(`context ${colour}${bar(filled)} ${percent}%${RESET}`);
  });

  it('rounds the percentage down, for the cells and the colour alike', () => {
    expect(contextPart(58.9, { color: false })).toBe(`context ${bar(5)} 58%`);
    expect(contextPart(49.99, { color: true })).toBe(`context ${GREEN}${bar(4)} 49%${RESET}`);
    expect(contextPart(79.9, { color: true })).toBe(`context ${YELLOW}${bar(7)} 79%${RESET}`);
  });

  it('reads `context —` without a percentage, with no colour', () => {
    expect(contextPart(null, { color: true })).toBe('context —');
    expect(contextPart(undefined, { color: false })).toBe('context —');
  });
});

describe('the 5-hour usage part', () => {
  const window = (minutes: number, percent = 25.4) => ({ percent, resetsAt: NOW + minutes * MINUTE });

  it('reads the percentage rounded down and the time to the reset', () => {
    expect(usagePart(window(90), NOW)).toBe('usage 25%, resets in 1h30');
    expect(usagePart(window(45, 7.9), NOW)).toBe('usage 7%, resets in 45m');
  });

  it('is left out without a five-hour window', () => {
    expect(usagePart(null, NOW)).toBeNull();
    expect(usagePart(undefined, NOW)).toBeNull();
  });

  it('is left out once its reset has passed', () => {
    expect(usagePart(window(0), NOW)).toBeNull();
    expect(usagePart(window(-5), NOW)).toBeNull();
  });

  it('reads minutes under an hour, and hours with two-digit minutes from an hour on', () => {
    expect(resetIn(45 * MINUTE)).toBe('45m');
    expect(resetIn(59 * MINUTE)).toBe('59m');
    expect(resetIn(60 * MINUTE)).toBe('1h00');
    expect(resetIn(65 * MINUTE)).toBe('1h05');
    expect(resetIn(299 * MINUTE)).toBe('4h59');
  });

  it('counts a started minute as a whole one, so it never reads 0m', () => {
    expect(resetIn(30_000)).toBe('1m');
    expect(resetIn(44 * MINUTE + 1)).toBe('45m');
    expect(resetIn(59 * MINUTE + 30_000)).toBe('1h00');
  });
});

describe('line 1', () => {
  it('holds the model, the context, the usage and `ask on`, in that order', () => {
    expect(sessionLine({ ...INPUT, askOn: true }, { now: NOW, color: false })).toBe(LINE_1);
  });

  it('leaves out `ask on` while ask mode is off', () => {
    expect(sessionLine({ ...INPUT, askOn: false }, { now: NOW, color: false })).toBe(`Opus 5.5 · context ${bar(5)} 58% · usage 25%, resets in 1h30`);
  });

  it('leaves out each part with nothing to say, but always says the context', () => {
    expect(sessionLine({ model: null, contextPercent: null, fiveHour: null, askOn: false }, { now: NOW, color: false })).toBe('context —');
    expect(sessionLine({ model: 'Sonnet', contextPercent: null, fiveHour: null, askOn: true }, { now: NOW, color: false })).toBe('Sonnet · context — · ask on');
  });

  it('colours the bar and its percentage, and nothing else', () => {
    expect(sessionLine({ ...INPUT, askOn: true }, { now: NOW, color: true })).toBe(
      `Opus 5.5 · context ${YELLOW}${bar(5)} 58%${RESET} · usage 25%, resets in 1h30 · ask on`,
    );
  });
});

describe('renderLines', () => {
  const PLAIN = { NO_COLOR: '1' };

  it('prints line 1, then the no-PRD line where the loop is installed', () => {
    expect(renderLines({ input: INPUT, facts: { installed: true, askOn: true }, terminal: t(PLAIN), now: NOW })).toEqual([LINE_1, NO_PRD_LINE]);
    expect(NO_PRD_LINE).toBe('no PRD · /omni:brainstorm to start');
  });

  it('prints line 1 alone where the loop is not installed', () => {
    expect(renderLines({ input: INPUT, facts: { installed: false, askOn: true }, terminal: t(PLAIN), now: NOW })).toEqual([LINE_1]);
  });

  it('prints line 1 from the JSON alone when nothing could be read', () => {
    expect(renderLines({ input: INPUT, facts: null, terminal: t(PLAIN), now: NOW })).toEqual([
      `Opus 5.5 · context ${bar(5)} 58% · usage 25%, resets in 1h30`,
    ]);
  });

  it('prints `omni` for JSON that could not be read', () => {
    expect(renderLines({ input: null, facts: { installed: true, askOn: true }, terminal: t(PLAIN), now: NOW })).toEqual(['omni']);
  });

  it('holds no colour code when NO_COLOR is set to anything but an empty string', () => {
    for (const value of ['1', 'true', '0', 'no']) {
      const lines = renderLines({ input: INPUT, facts: { installed: true, askOn: true }, terminal: t({ NO_COLOR: value }), now: NOW });
      expect(lines.join('\n')).not.toContain('\x1b');
    }
    const coloured = renderLines({ input: INPUT, facts: { installed: true, askOn: true }, terminal: t({ NO_COLOR: '' }), now: NOW });
    expect(coloured[0]).toContain(YELLOW);
    expect(colorOn({})).toBe(true);
    expect(colorOn({ NO_COLOR: '' })).toBe(true);
    expect(colorOn({ NO_COLOR: '1' })).toBe(false);
  });

  it.each([40, 80, 200])('fits every line within COLUMNS=%i, colour codes not counted', (columns) => {
    for (const env of [{ COLUMNS: String(columns) }, { COLUMNS: String(columns), NO_COLOR: '1' }]) {
      const lines = renderLines({ input: INPUT, facts: { installed: true, askOn: true }, terminal: t(env), now: NOW });
      expect(lines).toHaveLength(2);
      for (const line of lines) expect(visibleLength(line)).toBeLessThanOrEqual(columns);
      assertDefined(lines[0], 'lines[0]');
      if (visibleLength(LINE_1) > columns) expect(lines[0].replace(/\x1b\[[0-9;]*m/g, '')).toMatch(/…$/);
      else expect(lines[0].replace(/\x1b\[[0-9;]*m/g, '')).toBe(LINE_1);
      expect(lines[1]).toBe(NO_PRD_LINE);
    }
  });

  it('cuts a line too wide at its end with `…`, closing any colour it cut into', () => {
    const [line] = renderLines({ input: INPUT, facts: null, terminal: t({ COLUMNS: '24' }), now: NOW });
    expect(line).toBe(`Opus 5.5 · context ${YELLOW}████${RESET}…`);
    assertDefined(line, 'line');
    expect(visibleLength(line)).toBe(24);
  });

  it('does not cut a coloured line whose visible width fits exactly', () => {
    const exact = String(visibleLength(LINE_1));
    const [line] = renderLines({ input: INPUT, facts: { installed: true, askOn: true }, terminal: t({ COLUMNS: exact }), now: NOW });
    expect(line).toBe(`Opus 5.5 · context ${YELLOW}${bar(5)} 58%${RESET} · usage 25%, resets in 1h30 · ask on`);
  });

  it('reads COLUMNS as 80 when it is unset or not a number', () => {
    expect(columnsOf({})).toBe(80);
    expect(columnsOf({ COLUMNS: '' })).toBe(80);
    expect(columnsOf({ COLUMNS: 'wide' })).toBe(80);
    expect(columnsOf({ COLUMNS: '0' })).toBe(80);
    expect(columnsOf({ COLUMNS: '-4' })).toBe(80);
    expect(columnsOf({ COLUMNS: '12.5' })).toBe(80);
    expect(columnsOf({ COLUMNS: '120' })).toBe(120);
    expect(columnsOf({ COLUMNS: ' 40 ' })).toBe(40);
  });
});

describe('fit and visibleLength', () => {
  it('counts characters, never colour codes', () => {
    expect(visibleLength(`a${RED}██${RESET}b`)).toBe(4);
    expect(visibleLength('context —')).toBe(9);
  });

  it('leaves a line that fits as it is', () => {
    expect(fit('abcd', 4)).toBe('abcd');
    expect(fit(`ab${RED}cd${RESET}`, 4)).toBe(`ab${RED}cd${RESET}`);
  });

  it('cuts a line too wide to width - 1 characters and `…`', () => {
    expect(fit('abcdef', 4)).toBe('abc…');
    expect(fit('abcdef', 1)).toBe('…');
    expect(fit(`ab${RED}cdef${RESET}gh`, 5)).toBe(`ab${RED}cd${RESET}…`);
    expect(fit(`ab${RED}c${RESET}defgh`, 5)).toBe(`ab${RED}c${RESET}d…`);
  });
});

describe('line 2, drawn from omni now (PRD 1208, s5)', () => {
  const slice = (id: string, wave: number, state: string) => ({ id, wave, state });
  const named = (id: string, name: string | null, state: string) => ({ id, name, state });
  const prd = (number: number, topic: string, stage: string | null, slices: { id: string; name: string | null; state: string }[] = []) =>
    ({ kind: 'prd' as const, number: parsePrd(number), topic, stage: stage as 'building', slices, links: [] });
  const answer = (work: unknown, headline: unknown = null) => ({ headline, work, doing: null }) as Now;
  const HELP_BOARD = [slice('s1', 1, 'merged'), slice('s2', 1, 'merged'), slice('s3', 2, 'in-flight'), slice('s4', 2, 'claimed-stale'), slice('s5', 4, 'blocked')];
  const BUILDING = prd(315, 'help-and-status', 'building', [named('s3', 'tabs', 'in-flight'), named('s4', 'board', 'claimed-stale')]);
  const board = (slices: ReturnType<typeof slice>[] | null, openItems = 0, number = 315) => ({ number: parsePrd(number), slices, openItems });

  it('reads each of the spec\'s six lines', () => {
    expect(secondLine(answer(BUILDING), board(HELP_BOARD))).toBe('PRD 315 help-and-status · building · wave 2/4 · now s3 tabs, s4 board');
    expect(secondLine(answer(prd(315, 'help-and-status', 'outbox')), board([slice('s1', 1, 'merged'), slice('s2', 2, 'merged')], 2))).toBe(
      'PRD 315 help-and-status · outbox · all slices merged · 2 open items',
    );
    const fix = (kind: 'bug' | 'visual', number: number, topic: string, stage: string) => ({ kind, number: parseIssue(number), topic, stage, slices: [], links: [] });
    expect(secondLine(answer(fix('bug', 1180, 'login-redirect', 'fix PR open')), null)).toBe('bug #1180 login-redirect · fix PR open');
    expect(secondLine(answer(fix('visual', 1150, 'sidebar', 'in progress')), null)).toBe('visual #1150 sidebar · in progress');
    const roadmap = { kind: 'roadmap', number: 7, progress: '3/7 merged', links: [] };
    expect(secondLine(answer(BUILDING, roadmap), board(HELP_BOARD))).toBe('roadmap 7 · 3/7 merged · now PRD 315 · s3');
    expect(secondLine(NOTHING, null)).toBe(NO_PRD_LINE);
  });

  it('reads a headline with no work, a loop with no roadmap, and a fix under a loop', () => {
    expect(secondLine(answer(null, { kind: 'roadmap', number: 7, progress: '3/7 merged', links: [] }), null)).toBe('roadmap 7 · 3/7 merged');
    expect(secondLine(answer(prd(315, 'help-and-status', 'outbox'), { kind: 'loop', links: [] }), null)).toBe('loop · now PRD 315');
    const bug = { kind: 'bug', number: parseIssue(1180), topic: 'login-redirect', stage: 'in progress', slices: [], links: [] };
    expect(secondLine(answer(bug, { kind: 'loop', links: [] }), null)).toBe('loop · now bug #1180');
  });

  it('names the stuck slices after those in flight, in red unless colour is off, and the open items last', () => {
    const work = prd(315, 'help-and-status', 'building', [named('s3', 'tabs', 'in-flight'), named('s5', 'pane', 'stuck')]);
    const shown = board([...HELP_BOARD.slice(0, 3), slice('s5', 4, 'stuck')], 1);
    expect(secondLine(answer(work), shown)).toBe('PRD 315 help-and-status · building · wave 2/4 · now s3 tabs · stuck s5 pane · 1 open item');
    expect(secondLine(answer(work), shown, Number.POSITIVE_INFINITY, { color: true })).toBe(
      `PRD 315 help-and-status · building · wave 2/4 · now s3 tabs · ${RED}stuck s5 pane${RESET} · 1 open item`,
    );
  });

  it('leaves the wave and the open items out without the facts of the same PRD', () => {
    expect(secondLine(answer(BUILDING), null)).toBe('PRD 315 help-and-status · building · now s3 tabs, s4 board');
    expect(secondLine(answer(BUILDING), board(HELP_BOARD, 3, 7))).toBe('PRD 315 help-and-status · building · now s3 tabs, s4 board');
    expect(secondLine(answer(prd(7, 'bravo', 'outbox')), board(null, 2, 7))).toBe('PRD 7 bravo · outbox · 2 open items');
  });

  it('reads a PRD with no slice in flight, with no stage, in the inbox, in review and shipped', () => {
    expect(secondLine(answer(prd(7, 'bravo', 'building')), board([slice('s1', 1, 'merged'), slice('s2', 2, 'runnable')], 0, 7))).toBe('PRD 7 bravo · building · wave 2/2');
    expect(secondLine(answer(prd(7, 'bravo', null)), board(null, 2, 7))).toBe('PRD 7 bravo');
    expect(secondLine(answer(prd(9, 'charlie', 'inbox')), board(HELP_BOARD, 2, 9))).toBe('PRD 9 charlie · inbox');
    expect(secondLine(answer(prd(11, 'delta', 'in review')), null)).toBe('PRD 11 delta · in review');
    expect(secondLine(answer(prd(3, 'alpha', 'shipped')), board(HELP_BOARD, 4, 3))).toBe('PRD 3 alpha · shipped');
  });

  it('says `1 open item`, and leaves the part out at zero', () => {
    expect(itemsPart(1)).toBe('1 open item');
    expect(itemsPart(2)).toBe('2 open items');
    expect(itemsPart(0)).toBeNull();
    expect(itemsPart(null)).toBeNull();
  });

  it('reads the lowest wave not all merged over the highest, `all slices merged`, or nothing without a board', () => {
    expect(wavePart(HELP_BOARD)).toBe('wave 2/4');
    expect(wavePart([slice('s1', 1, 'runnable'), slice('s2', 3, 'blocked')])).toBe('wave 1/3');
    expect(wavePart([slice('s1', 1, 'merged'), slice('s2', 2, 'merged')])).toBe('all slices merged');
    expect(wavePart(null)).toBeNull();
    expect(wavePart([])).toBeNull();
  });

  it('cuts the slice names first at 60 columns, then the topic, then the line at its end', () => {
    const work = prd(315, 'help-and-status', 'building', [named('s3', 'tabs and their panes', 'in-flight'), named('s4', 'the cached board', 'claimed-stale')]);
    expect(secondLine(answer(work), board(HELP_BOARD), 200)).toBe('PRD 315 help-and-status · building · wave 2/4 · now s3 tabs and their panes, s4 the cached board');
    expect(secondLine(answer(work), board(HELP_BOARD), 60)).toBe('PRD 315 help-and-status · building · wave 2/4 · now s3, s4');
    expect(secondLine(answer(work), board(HELP_BOARD), 55)).toBe('PRD 315 help-and-st… · building · wave 2/4 · now s3, s4');
    expect(secondLine(answer(work), board(HELP_BOARD), 40)).toBe('PRD 315 help-an… · building · wave 2/4 …');
  });

  it('cuts the topic of a fix, never below 8 characters', () => {
    const bug = { kind: 'bug', number: parseIssue(1180), topic: 'login-redirect-loops-forever', stage: 'fix PR open', slices: [], links: [] };
    expect(secondLine(answer(bug), null, 40)).toBe('bug #1180 login-redirect-… · fix PR open');
    expect(secondLine(answer(bug), null, 30)).toBe('bug #1180 login-r… · fix PR o…');
  });

  it('prints line 2 where the loop is installed, the no-PRD line without an answer, and nothing where it is not', () => {
    const facts = { installed: true, askOn: true, now: answer(BUILDING), board: board(HELP_BOARD) };
    expect(renderLines({ input: INPUT, facts, terminal: t({ NO_COLOR: '1', COLUMNS: '200' }), now: NOW })).toEqual([
      LINE_1,
      'PRD 315 help-and-status · building · wave 2/4 · now s3 tabs, s4 board',
    ]);
    expect(renderLines({ input: INPUT, facts: { installed: true, askOn: true, now: null }, terminal: t({ NO_COLOR: '1' }), now: NOW })).toEqual([LINE_1, NO_PRD_LINE]);
    expect(renderLines({ input: INPUT, facts: { ...facts, installed: false }, terminal: t({ NO_COLOR: '1' }), now: NOW })).toEqual([LINE_1]);
  });

  it.each([40, 60, 80, 200])('fits line 2 within COLUMNS=%i, colour codes not counted, and none under NO_COLOR', (columns) => {
    const work = prd(315, 'help-and-status', 'building', [named('s3', 'tabs', 'in-flight'), named('s5', 'pane', 'stuck')]);
    const facts = { installed: true, askOn: false, now: answer(work), board: board([...HELP_BOARD.slice(0, 3), slice('s5', 4, 'stuck')], 2) };
    const [, coloured] = renderLines({ input: INPUT, facts, terminal: t({ COLUMNS: String(columns) }), now: NOW });
    const [, plain] = renderLines({ input: INPUT, facts, terminal: t({ COLUMNS: String(columns), NO_COLOR: '1' }), now: NOW });
    assertDefined(coloured, 'coloured');
    assertDefined(plain, 'plain');
    expect(visibleLength(coloured)).toBeLessThanOrEqual(columns);
    expect(plain).not.toContain('\x1b');
    expect(coloured.replace(/\x1b\[[0-9;]*m/g, '')).toBe(plain);
    if (columns === 200) expect(coloured).toContain(`${RED}stuck s5 pane${RESET}`);
  });
});
