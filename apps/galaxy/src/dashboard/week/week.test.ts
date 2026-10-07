import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DemoInput } from '../part';
import { seasonBounds } from '../season';
import { chartDays, weekDays, weekTotal, type ChartDay } from './chart';
import { demoWeek } from './demo';
import type { WeekValue } from './load';
import { barHeight, CHART, Week } from './Week';
import { sure } from '../../arcade/test/sure';

// The week of merges as the server draws it (PRD 328), to static markup: a heading, the week's total
// at its top right, seven bars in inline SVG (no chart library, no script), today last, each under its
// weekday, a y-axis of whole numbers, and a list of the seven days and their counts that a screen
// reader reads in place of the bars. With no GitHub login, or when its read failed, it says so.

const NOW = new Date('2026-09-26T10:00:00Z'); // Saturday
const season = seasonBounds(NOW);
const WEEK = weekDays(NOW);
const week = (counts: number[]): WeekValue => ({ kind: 'week', days: WEEK.map((date, i) => ({ date, count: sure(counts[i], 'counts[i]') })) });
const render = (part: Parameters<typeof Week>[0]['part']) => renderToStaticMarkup(createElement(Week, { part, season }));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const svgOf = (html: string) => /<svg[\s\S]*<\/svg>/.exec(html)?.[0] ?? '';
const outside = (html: string) => html.replace(/<svg[\s\S]*<\/svg>/, '');
const bars = (html: string) => [...html.matchAll(/<path class="dash-week-bar"[^>]*d="([^"]+)"/g)].map((m) => sure(m[1], 'm[1]'));
const listed = (html: string) => [...html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => text(sure(m[1], 'm[1]')));
const ticks = (html: string) => [...svgOf(html).matchAll(/<text class="dash-week-tick"[^>]*>(\d+)<\/text>/g)].map((m) => Number(m[1]));
const names = (html: string) => [...svgOf(html).matchAll(/<text class="dash-week-name[^"]*"[^>]*>(\w+)<\/text>/g)].map((m) => m[1]);
const UNREADABLE_LINE = 'Couldn’t load this. Reload in a moment.';
const EMPTY_LINE = 'No PRs merged into main in the last 7 days';

describe('the week, drawn', () => {
  const html = render(week([0, 2, 1, 3, 1, 0, 2]));

  it('is a section headed by what it counts, with the week\'s total', () => {
    expect(html).toMatch(/^<section class="dash-week" aria-labelledby="dash-week-title">/);
    expect(html).toMatch(/<h2 id="dash-week-title"[^>]*>PRs merged into main · last 7 days<\/h2>/);
    expect(text(html)).toContain('9 total');
  });

  it('puts the total at the top right: in the heading\'s row, after it', () => {
    const head = /<header class="dash-week-head">([\s\S]*?)<\/header>/.exec(html)?.[1] ?? '';
    expect(head.indexOf('<h2')).toBeLessThan(head.indexOf('dash-week-total'));
    expect(text(head)).toMatch(/9 total$/);
  });

  it('draws inline SVG on the server: no chart library, no script, no canvas', () => {
    expect(svgOf(html)).toMatch(/^<svg class="dash-week-chart"/);
    expect(html).not.toMatch(/<script|<canvas|<foreignObject/);
  });

  it('draws a bar for each day that has merges, and none for an empty day', () => {
    expect(bars(html)).toHaveLength(5);
  });

  it('labels each of the seven bars with its weekday, today last and marked', () => {
    expect(names(html)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    expect(svgOf(html)).toMatch(/<text class="dash-week-name is-today"[^>]*>Sat<\/text>/);
    expect([...svgOf(html).matchAll(/is-today/g)]).toHaveLength(1);
  });

  it('marks the y-axis in whole numbers from 0 to the highest bar', () => {
    expect(ticks(html)).toEqual([0, 1, 2, 3]);
  });

  it('draws each bar in proportion, the highest reaching the axis\'s top', () => {
    const tallest = bars(html).find((d) => d.includes(`V${CHART.top + 4}`));
    expect(tallest).toBeDefined();
    expect(barHeight(3, 3)).toBe(CHART.plot);
    expect(barHeight(1, 3)).toBe(CHART.plot / 3);
    expect(barHeight(0, 3)).toBe(0);
  });

  it('hides the drawing from a screen reader, which reads the list of the seven days and their counts instead', () => {
    expect(svgOf(html)).toMatch(/^<svg [^>]*aria-hidden="true"/);
    const list = /<ul class="ask-sr">[\s\S]*?<\/ul>/.exec(html)?.[0] ?? '';
    expect(listed(list)).toEqual([
      'Sunday 20 September: 0 PRs',
      'Monday 21 September: 2 PRs',
      'Tuesday 22 September: 1 PR',
      'Wednesday 23 September: 3 PRs',
      'Thursday 24 September: 1 PR',
      'Friday 25 September: 0 PRs',
      'Saturday 26 September, today: 2 PRs',
    ]);
  });

  it('names each day\'s count on its bar\'s column, for a pointer that rests there', () => {
    const titles = [...svgOf(html).matchAll(/<title>([^<]*)<\/title>/g)].map((m) => m[1]);
    expect(titles).toEqual(listed(html));
  });

  it('never says the week is empty when it is not', () => {
    expect(text(html)).not.toContain(EMPTY_LINE);
  });

  it('draws the counts chartDays gives, and sums them', () => {
    const days: ChartDay[] = chartDays([{ kind: 'pr-merged', login: 'ada-gh', at: '2026-09-20T22:30:00Z' }], NOW, 'ada-gh');
    const drawn = render({ kind: 'week', days });
    expect(listed(drawn)[1]).toBe('Monday 21 September: 1 PR');
    expect(text(outside(drawn))).toContain(`${weekTotal(days)} total`);
  });

  it('keeps a busy week\'s axis readable: a round step, and the highest bar marked', () => {
    const busy = render(week([0, 4, 12, 7, 1, 0, 3]));
    expect(ticks(busy)).toEqual([0, 5, 12]);
    expect(text(busy)).toContain('27 total');
  });
});

describe('an empty week', () => {
  const html = render(week([0, 0, 0, 0, 0, 0, 0]));

  it('draws seven empty days, an axis to 1, and says there were none', () => {
    expect(bars(html)).toHaveLength(0);
    expect(names(html)).toHaveLength(7);
    expect(ticks(html)).toEqual([0, 1]);
    expect(text(outside(html))).toContain(EMPTY_LINE);
  });

  it('shows its total as 0, and lists seven zeros', () => {
    expect(text(outside(html))).toContain('0 total');
    expect(listed(html).every((line) => line.endsWith(': 0 PRs'))).toBe(true);
    expect(listed(html)).toHaveLength(7);
  });
});

describe('the week, when it cannot be shown', () => {
  it('with no GitHub login: the heading, and the way to link one in the arcade, in place of the chart', () => {
    const html = render({ kind: 'no-github' });
    expect(html).toContain('PRs merged into main · last 7 days');
    expect(html).toMatch(/<a [^>]*href="\/play"[^>]*>Link your GitHub in the arcade<\/a>/);
    expect(html).not.toContain('<svg');
    expect(text(html)).not.toContain('total');
  });

  it('when its read failed: the heading, and the line saying so, in place of the chart', () => {
    const html = render('unreadable');
    expect(html).toContain('PRs merged into main · last 7 days');
    expect(text(html)).toContain(UNREADABLE_LINE);
    expect(html).not.toContain('<svg');
    expect(text(html)).not.toContain('total');
  });
});

describe('the week in the demo', () => {
  const demo = demoWeek({ now: NOW, season, login: 'dam-dev', team: 'beaver' } as DemoInput);

  it('is made up and fixed: nine merges over the seven days before and up to today', () => {
    expect(demo).toEqual({ kind: 'week', days: WEEK.map((date, i) => ({ date, count: [2, 1, 3, 1, 0, 0, 2][i] })) });
    expect(weekTotal((demo as Extract<WeekValue, { kind: 'week' }>).days)).toBe(9);
  });

  it('moves with the day it is shown on: today is always last', () => {
    const monday = demoWeek({ now: new Date('2026-09-28T10:00:00Z'), season, login: 'dam-dev', team: 'beaver' } as DemoInput);
    expect((monday as Extract<WeekValue, { kind: 'week' }>).days.at(-1)).toEqual({ date: '2026-09-28', count: 2 });
  });
});

describe('the week\'s stylesheet', () => {
  const css = readFileSync(new URL('./week.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('draws the bars in the page\'s signal, and the axis in its quiet tokens', () => {
    expect(css).toMatch(/\.dash-week-bar \{[^}]*fill: var\(--ask-plasma\);/);
    expect(css).toMatch(/\.dash-week-grid \{[^}]*stroke: var\(--ask-line\);/);
    expect(css).toMatch(/\.dash-week-tick,\s*\.dash-week-name \{[^}]*fill: var\(--ask-muted\);/);
  });

  it('lets the chart take the column\'s width, and lets its heading and total wrap on a phone', () => {
    expect(css).toMatch(/\.dash-week-chart \{[^}]*width: 100%;/);
    expect(css).toMatch(/\.dash-week-head \{[^}]*flex-wrap: wrap;/);
  });
});
