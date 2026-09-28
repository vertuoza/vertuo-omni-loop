import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DemoInput, PartInput } from '../part';
import { seasonBounds } from '../season';
import { demoWeek } from './demo';
import { loadWeek } from './load';
import { Week } from './Week';

// The week of merges (PRD 328) is a stub until slice s4 builds it in this folder: its read touches
// nothing, its view draws nothing, its demo is nothing, and its stylesheet holds no rule.

const NOW = new Date('2026-09-26T10:00:00Z');
const season = seasonBounds(NOW);
const untouched = () => { throw new Error('the stub read something'); };
const input = { db: { from: untouched, rpc: untouched }, workspace: 'w1', userId: 'u1', login: 'ada-gh', team: 'pirates', now: NOW, season, galaxy: untouched } as unknown as PartInput;

describe('the week, a stub', () => {
  it('reads nothing', async () => {
    expect(await loadWeek(input)).toBeNull();
  });

  it('draws nothing, whatever it is given', () => {
    expect(renderToStaticMarkup(createElement(Week, { part: null, season }))).toBe('');
    expect(renderToStaticMarkup(createElement(Week, { part: 'unreadable', season }))).toBe('');
  });

  it('is nothing in the demo', () => {
    expect(demoWeek({ now: NOW, season, login: 'dam-dev', team: 'beaver' } as DemoInput)).toBeNull();
  });

  it('has a stylesheet with no rule yet', () => {
    const css = readFileSync(new URL('./week.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css.trim()).toBe('');
  });
});
