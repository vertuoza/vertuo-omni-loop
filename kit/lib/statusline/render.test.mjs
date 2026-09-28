// PRD #324, slices s1 and s4: the status line's lines, drawn from what was read — the context bar and
// its colours, the 5-hour usage, `ask on`, the PRD line and the no-PRD line, the width and `NO_COLOR`.
import { describe, expect, it } from 'vitest';
import {
  columnsOf,
  colorOn,
  contextPart,
  fit,
  itemsPart,
  NO_PRD_LINE,
  prdLine,
  renderLines,
  resetIn,
  sessionLine,
  usagePart,
  visibleLength,
} from './render.mjs';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const NOW = Date.parse('2026-09-28T12:00:00Z');
const MINUTE = 60_000;

const bar = (filled) => '█'.repeat(filled) + '░'.repeat(10 - filled);

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
  const window = (minutes, percent = 25.4) => ({ percent, resetsAt: NOW + minutes * MINUTE });

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
    expect(renderLines({ input: INPUT, facts: { installed: true, askOn: true }, env: PLAIN, now: NOW })).toEqual([LINE_1, NO_PRD_LINE]);
    expect(NO_PRD_LINE).toBe('no PRD · /omni:brainstorm to start');
  });

  it('prints line 1 alone where the loop is not installed', () => {
    expect(renderLines({ input: INPUT, facts: { installed: false, askOn: true }, env: PLAIN, now: NOW })).toEqual([LINE_1]);
  });

  it('prints line 1 from the JSON alone when nothing could be read', () => {
    expect(renderLines({ input: INPUT, facts: null, env: PLAIN, now: NOW })).toEqual([
      `Opus 5.5 · context ${bar(5)} 58% · usage 25%, resets in 1h30`,
    ]);
  });

  it('prints `omni` for JSON that could not be read', () => {
    expect(renderLines({ input: null, facts: { installed: true, askOn: true }, env: PLAIN, now: NOW })).toEqual(['omni']);
  });

  it('holds no colour code when NO_COLOR is set to anything but an empty string', () => {
    for (const value of ['1', 'true', '0', 'no']) {
      const lines = renderLines({ input: INPUT, facts: { installed: true, askOn: true }, env: { NO_COLOR: value }, now: NOW });
      expect(lines.join('\n')).not.toContain('\x1b');
    }
    const coloured = renderLines({ input: INPUT, facts: { installed: true, askOn: true }, env: { NO_COLOR: '' }, now: NOW });
    expect(coloured[0]).toContain(YELLOW);
    expect(colorOn({})).toBe(true);
    expect(colorOn({ NO_COLOR: '' })).toBe(true);
    expect(colorOn({ NO_COLOR: '1' })).toBe(false);
  });

  it.each([40, 80, 200])('fits every line within COLUMNS=%i, colour codes not counted', (columns) => {
    for (const env of [{ COLUMNS: String(columns) }, { COLUMNS: String(columns), NO_COLOR: '1' }]) {
      const lines = renderLines({ input: INPUT, facts: { installed: true, askOn: true }, env, now: NOW });
      expect(lines).toHaveLength(2);
      for (const line of lines) expect(visibleLength(line)).toBeLessThanOrEqual(columns);
      if (visibleLength(LINE_1) > columns) expect(lines[0].replace(/\x1b\[[0-9;]*m/g, '')).toMatch(/…$/);
      else expect(lines[0].replace(/\x1b\[[0-9;]*m/g, '')).toBe(LINE_1);
      expect(lines[1]).toBe(NO_PRD_LINE);
    }
  });

  it('cuts a line too wide at its end with `…`, closing any colour it cut into', () => {
    const [line] = renderLines({ input: INPUT, facts: null, env: { COLUMNS: '24' }, now: NOW });
    expect(line).toBe(`Opus 5.5 · context ${YELLOW}████${RESET}…`);
    expect(visibleLength(line)).toBe(24);
  });

  it('does not cut a coloured line whose visible width fits exactly', () => {
    const exact = String(visibleLength(LINE_1));
    const [line] = renderLines({ input: INPUT, facts: { installed: true, askOn: true }, env: { COLUMNS: exact }, now: NOW });
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

describe('line 2: the PRD', () => {
  const BRAVO = { number: 7, topic: 'bravo', slice: null, stage: 'outbox', openItems: 2 };
  const LONG = { number: 324, topic: 'statusline-for-claude-code', slice: 's4', stage: 'outbox', openItems: 3 };

  it('names the PRD, its topic, its stage and its open items', () => {
    expect(prdLine(BRAVO)).toBe('PRD 7 bravo · outbox · 2 open items');
  });

  it('names the slice on a slice branch, between the topic and the stage', () => {
    expect(prdLine({ ...BRAVO, slice: 's2' })).toBe('PRD 7 bravo · s2 · outbox · 2 open items');
  });

  it('says `1 open item`, and leaves the part out at zero', () => {
    expect(itemsPart(1)).toBe('1 open item');
    expect(itemsPart(2)).toBe('2 open items');
    expect(itemsPart(0)).toBeNull();
    expect(prdLine({ ...BRAVO, openItems: 1 })).toBe('PRD 7 bravo · outbox · 1 open item');
    expect(prdLine({ ...BRAVO, openItems: 0 })).toBe('PRD 7 bravo · outbox');
  });

  it('shows open items in the outbox only', () => {
    expect(prdLine({ ...BRAVO, stage: 'inbox', openItems: 0 })).toBe('PRD 7 bravo · inbox');
    expect(prdLine({ ...BRAVO, number: 11, topic: 'delta', stage: 'in review' })).toBe('PRD 11 delta · in review');
  });

  it('reads `PRD <n> <topic> · shipped`, and nothing after', () => {
    expect(prdLine({ number: 3, topic: 'alpha', slice: 's2', stage: 'shipped', openItems: 4 })).toBe('PRD 3 alpha · shipped');
  });

  it('leaves the stage out without one', () => {
    expect(prdLine({ ...BRAVO, stage: null })).toBe('PRD 7 bravo');
    expect(prdLine({ ...BRAVO, slice: 's2', stage: null })).toBe('PRD 7 bravo · s2');
  });

  it('cuts the topic first, just enough to fit, ending in `…`', () => {
    expect(prdLine(LONG, 200)).toBe('PRD 324 statusline-for-claude-code · s4 · outbox · 3 open items');
    const line = prdLine(LONG, 50);
    expect(line).toBe('PRD 324 statusline-f… · s4 · outbox · 3 open items');
    expect(visibleLength(line)).toBe(50);
  });

  it('cuts the topic down to 8 characters at most, then the line at its end', () => {
    expect(prdLine(LONG, 45)).toBe('PRD 324 statusl… · s4 · outbox · 3 open items');
    expect(prdLine(LONG, 40)).toBe('PRD 324 statusl… · s4 · outbox · 3 open…');
  });

  it('never cuts a topic of 8 characters or fewer: the line is cut at its end', () => {
    expect(prdLine({ ...BRAVO, topic: 'abcdefgh' }, 30)).toBe('PRD 7 abcdefgh · outbox · 2 o…');
    expect(prdLine({ ...BRAVO, topic: 'abcdefghi' }, 36)).toBe('PRD 7 abcdefg… · outbox · 2 open it…');
  });

  it('prints the PRD line where the loop is installed and a PRD was read', () => {
    const facts = { installed: true, askOn: true, prd: { ...BRAVO, slice: 's2' } };
    expect(renderLines({ input: INPUT, facts, env: { NO_COLOR: '1' }, now: NOW })).toEqual([LINE_1, 'PRD 7 bravo · s2 · outbox · 2 open items']);
    const none = { installed: true, askOn: true, prd: null };
    expect(renderLines({ input: INPUT, facts: none, env: { NO_COLOR: '1' }, now: NOW })).toEqual([LINE_1, NO_PRD_LINE]);
    const notInstalled = { installed: false, askOn: true, prd: BRAVO };
    expect(renderLines({ input: INPUT, facts: notInstalled, env: { NO_COLOR: '1' }, now: NOW })).toEqual([LINE_1]);
  });

  it.each([40, 80, 200])('fits the PRD line within COLUMNS=%i, the topic cut before anything else', (columns) => {
    const facts = { installed: true, askOn: true, prd: LONG };
    for (const env of [{ COLUMNS: String(columns) }, { COLUMNS: String(columns), NO_COLOR: '1' }]) {
      const [, line] = renderLines({ input: INPUT, facts, env, now: NOW });
      expect(visibleLength(line)).toBeLessThanOrEqual(columns);
      expect(line).not.toContain('\x1b');
      if (columns < 63) expect(line).toMatch(/^PRD 324 statusl[^ ]*… · s4 · /);
      else expect(line).toBe('PRD 324 statusline-for-claude-code · s4 · outbox · 3 open items');
    }
  });
});
