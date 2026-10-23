import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { periodWindow } from '../dashboard/board/period';
import { brokeMainOf, type MainWatchRow } from './broke-main';
import { EngineeringScreen, type EngineeringView } from './EngineeringScreen';
import { engineeringOf } from './tally';
import { sure } from '../arcade/test/sure';
import { PrdNumberSchema } from 'omni-loop/kit/lib/ids.ts';

// Loop health's broke-main line (PRD 2410 s4): the math, then the board that draws it.

const NOW = new Date('2026-09-26T10:00:00Z');
const WEEK = periodWindow('7d', NOW);
const FROM = WEEK.from.getTime(), TO = WEEK.to.getTime();
const TRACKED = new Set(['acme/widgets', 'acme/gears']);
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

let serial = 100;
const lane = (status: MainWatchRow['status'], over: Partial<MainWatchRow> = {}): MainWatchRow => ({
  repository: 'acme/widgets', prd: PrdNumberSchema.parse(++serial), status, mergedAt: '2026-09-22T08:00:00Z', breaks: status === 'broke' ? ['CI red: build'] : [], dossier: null, ...over,
});

describe('brokeMainOf', () => {
  it('is null with no PRD whose watch ended in the period', () => {
    expect(brokeMainOf([], TRACKED, FROM, TO)).toBeNull();
    expect(brokeMainOf([lane('watching')], TRACKED, FROM, TO)).toBeNull();
    expect(brokeMainOf([lane('broke', { mergedAt: '2026-08-01T08:00:00Z' })], TRACKED, FROM, TO)).toBeNull();
  });

  it('with some broken: counts them out of those that ended, the watched apart', () => {
    const got = brokeMainOf([lane('broke'), lane('clean'), lane('clean'), lane('clean'), lane('watching'), lane('watching')], TRACKED, FROM, TO);
    expect(got).toMatchObject({ ended: 4, broke: 1, share: 25, watching: 2 });
    expect(got?.list).toHaveLength(1);
  });

  it('with every PRD broken: 100%', () => {
    expect(brokeMainOf([lane('broke'), lane('broke')], TRACKED, FROM, TO)).toMatchObject({ ended: 2, broke: 2, share: 100, watching: 0 });
  });

  it('with none broken: 0% and an empty list', () => {
    expect(brokeMainOf([lane('clean')], TRACKED, FROM, TO)).toMatchObject({ ended: 1, broke: 0, share: 0, list: [] });
  });

  it('reads a PRD by its lanes: one broken lane breaks it, a lane still watched keeps it watched unless one broke', () => {
    const two = (a: MainWatchRow['status'], b: MainWatchRow['status']) =>
      brokeMainOf([lane(a, { prd: PrdNumberSchema.parse(7) }), lane(b, { prd: PrdNumberSchema.parse(7) })], TRACKED, FROM, TO);
    expect(two('broke', 'watching')).toMatchObject({ ended: 1, broke: 1, watching: 0 });
    expect(two('clean', 'watching')).toBeNull();
    expect(two('clean', 'clean')).toMatchObject({ ended: 1, broke: 0 });
  });

  it('counts a PRD once by its last lane merge, and narrows to the tracked repositories', () => {
    const rows = [
      lane('clean', { prd: PrdNumberSchema.parse(7), mergedAt: '2026-09-10T08:00:00Z' }), lane('clean', { prd: PrdNumberSchema.parse(7), mergedAt: '2026-09-22T08:00:00Z' }),
      lane('broke', { repository: 'acme/other' }),
    ];
    expect(brokeMainOf(rows, TRACKED, FROM, TO)).toMatchObject({ ended: 1, broke: 0 });
    expect(brokeMainOf(rows, new Set(['acme/other']), FROM, TO)).toMatchObject({ ended: 1, broke: 1 });
  });
});

describe('the board', () => {
  const view = (mainWatch: MainWatchRow[]): EngineeringView =>
    ({ kind: 'board', name: 'Vertuoza', board: engineeringOf({ tracked: ['acme/widgets', 'acme/gears'], pullRequests: [], reviews: [], mainWatch }, WEEK, 'merged', NOW) });
  const render = (v: EngineeringView) =>
    renderToStaticMarkup(createElement(EngineeringScreen, { view: v, period: '7d', supabase: null, signinError: null, query: {} }));
  const health = (html: string) => text(sure(sure(html.split('id="eng-health">')[1], 'the health panel').split('</section>')[0], 'its section'));

  it('says k of m PRDs broke main, the share, the ones still watched, and lists each with its page', () => {
    const html = render(view([
      lane('broke', { prd: PrdNumberSchema.parse(11), dossier: 'abc-123', breaks: ['CI red: build'] }), lane('clean'), lane('clean'), lane('watching'),
    ]));
    expect(health(html)).toContain('1 of 3 PRDs broke main · 33% · 1 more still watched acme/widgets#11 CI red: build');
    expect(html).toContain('href="/prd/abc-123"');
  });

  it('leaves the line out with no PRD whose watch ended', () => {
    expect(health(render(view([lane('watching')])))).not.toContain('broke main');
    expect(health(render(view([])))).not.toContain('broke main');
  });
});
