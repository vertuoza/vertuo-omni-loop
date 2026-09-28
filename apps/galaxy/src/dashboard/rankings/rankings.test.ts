import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DemoInput, PartInput } from '../part';
import { seasonBounds } from '../season';
import { demoRankings } from './demo';
import { loadRankings } from './load';
import { Rankings } from './Rankings';

// The rankings (PRD 328) are a stub until slice s3 builds them in this folder: their read touches
// nothing, their view draws nothing, their demo is nothing, and their stylesheet holds no rule.

const NOW = new Date('2026-09-26T10:00:00Z');
const season = seasonBounds(NOW);
const untouched = () => { throw new Error('the stub read something'); };
const input = { db: { from: untouched, rpc: untouched }, workspace: 'w1', userId: 'u1', login: 'ada-gh', team: 'pirates', now: NOW, season, galaxy: untouched } as unknown as PartInput;

describe('the rankings, a stub', () => {
  it('read nothing', async () => {
    expect(await loadRankings(input)).toBeNull();
  });

  it('draw nothing, whatever they are given', () => {
    expect(renderToStaticMarkup(createElement(Rankings, { part: null, season }))).toBe('');
    expect(renderToStaticMarkup(createElement(Rankings, { part: 'unreadable', season }))).toBe('');
  });

  it('are nothing in the demo', () => {
    expect(demoRankings({ now: NOW, season, login: 'dam-dev', team: 'beaver' } as DemoInput)).toBeNull();
  });

  it('have a stylesheet with no rule yet', () => {
    const css = readFileSync(new URL('./rankings.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css.trim()).toBe('');
  });
});
