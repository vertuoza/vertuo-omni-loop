import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DemoInput, PartInput } from '../part';
import { seasonBounds } from '../season';
import { Counts } from './Counts';
import { demoCounts } from './demo';
import { loadCounts } from './load';

// The four counts (PRD 328) are a stub until slice s5 builds them in this folder: their read touches
// nothing, their view draws nothing, their demo is nothing, and their stylesheet holds no rule.

const NOW = new Date('2026-09-26T10:00:00Z');
const season = seasonBounds(NOW);
const untouched = () => { throw new Error('the stub read something'); };
const input = { db: { from: untouched, rpc: untouched }, workspace: 'w1', userId: 'u1', login: 'ada-gh', team: 'pirates', now: NOW, season, galaxy: untouched } as unknown as PartInput;

describe('the counts, a stub', () => {
  it('read nothing', async () => {
    expect(await loadCounts(input)).toBeNull();
  });

  it('draw nothing, whatever they are given', () => {
    expect(renderToStaticMarkup(createElement(Counts, { part: null, season }))).toBe('');
    expect(renderToStaticMarkup(createElement(Counts, { part: 'unreadable', season }))).toBe('');
  });

  it('are nothing in the demo', () => {
    expect(demoCounts({ now: NOW, season, login: 'dam-dev', team: 'beaver' } as DemoInput)).toBeNull();
  });

  it('have a stylesheet with no rule yet', () => {
    const css = readFileSync(new URL('./counts.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css.trim()).toBe('');
  });
});
