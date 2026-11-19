import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ledgerOf, type EventRow } from '../room/room';
import type { RepairRow } from '../repair';
import { MissionsTab } from './MissionsTab';
import { missionOf, type MissionRow, type MissionsView } from './missions-tab';
import { applyLine, type ItemRow, type RetroRead, type RetroRow } from './retros';
import { demoMissionsPort, httpMissionsPort } from './missions-tab.client';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined }) }));

// The Missions tab's stuck state, Retros and Questions, and the room's new rows (PRD 3065 s5, the `mission-start` screen's 1.A to
// 1.E and the `fleet-room` screen's 2.A, AC-1, AC-4, AC-6, AC-7, AC-8): the words, the counts and the links.

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').replace(/ ,/g, ',').trim();
const M = '22222222-2222-4222-8222-222222222222';
const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const FP = 'ab12cd34'.padEnd(64, '0');
const row = (over: Partial<MissionRow> = {}): MissionRow => ({ id: M, repo: 'acme/shop', number: 40, title: 'Pay online', goal: 'Every quote can be paid online.', status: 'running', waitingOn: null, prds: [parsePrd(2803), parsePrd(2805)], level: 'alone', inPlan: false, ...over });
const repair = (over: Partial<RepairRow> = {}): RepairRow => ({
  mission: M, prd: parsePrd(2805), trigger: 'stuck', fingerprint: FP, round: 1, number: 1, job: null, fixPr: 'https://github.com/acme/shop/pull/3071', outcome: null, startedAt: '2027-01-26T04:20:00Z',
  retro: { cause: "PRD 2805's preview never deploys, so QA is held each time.", class: 'code', proposedFix: 'Add the preview secret.' }, ...over,
});
const roadmap: RetroRow = {
  id: 'r1', mission: M, milestone: '2790', file: '.omni-loop/delivery/missions/40-pay/retros/1-roadmap-2790.md', skipped: null, at: '2027-01-26T09:01:00Z',
  retro: {
    wentWell: [{ text: '3 of 4 PRDs reached ready with no question.', cites: [{ kind: 'prd', ref: 2803 }, { kind: 'prd', ref: 2804 }] }],
    toChange: [{ text: 'PRD 2805 was stuck twice on its preview.', cites: [{ kind: 'repair', ref: 4 }] }],
  },
};
const whole: RetroRow = { id: 'r2', mission: M, milestone: 'mission', file: null, skipped: null, at: '2027-01-26T10:00:00Z', retro: { wentWell: [{ text: 'The QA pair caught 5 bugs.', cites: [{ kind: 'pr', ref: 2817 }] }], toChange: [{ text: 'Nothing to change.', cites: [{ kind: 'event', ref: 9 }] }] } };
const item: ItemRow = { id: 'i1', mission: M, target: 'the Roadmap form: Prerequisites', wording: 'Name every secret a preview needs.', evidence: ['PRD 2805 was stuck twice waiting on a preview secret.'], answer: null, note: null, answeredBy: null, at: '2027-01-26T09:02:00Z' };
const read = (over: Partial<RetroRead>): RetroRead => ({ repairs: [], retros: [], items: [], ...over });
const html = (...missions: ReturnType<typeof missionOf>[]) => renderToStaticMarkup(createElement(MissionsTab, { view: { workspace: WORKSPACE, fleet: 'night-shift', missions } satisfies MissionsView }));

describe('a mission whose stuck repair works (1.A)', () => {
  it('reads Stuck: 5 jobs, nothing moved, the repair\'s number, what is left, its fix and its cause', () => {
    const out = html(missionOf(row(), [], [], [], undefined, read({ repairs: [repair({ number: 1 }), repair({ mission: M, trigger: 'failure', number: 1, outcome: 'fixed', fingerprint: 'other'.padEnd(64, '0'), startedAt: '2027-01-26T03:00:00Z' })] })));
    expect(text(out)).toContain("Stuck: 5 jobs, nothing moved Repairing (1 of 3) · 7 left in this mission PR 3071 Cause: PRD 2805's preview never deploys, so QA is held each time.");
    expect(out).toContain('href="https://github.com/acme/shop/pull/3071"');
  });

  it('says nothing once no stuck repair is at work, or on a mission that is not running', () => {
    expect(text(html(missionOf(row(), [], [], [], undefined, read({ repairs: [repair({ outcome: 'fixed' })] }))))).not.toContain('Stuck: 5 jobs');
    expect(text(html(missionOf(row({ status: 'paused' }), [], [], [], undefined, read({ repairs: [repair({})] }))))).not.toContain('Stuck: 5 jobs');
  });
});

describe('a mission paused by stuck (1.B)', () => {
  const paused = (extra: Partial<RetroRead> = {}) => missionOf(row({ status: 'paused', pausedBy: 'stuck' }), [], [], [], undefined, read({
    repairs: [repair({ outcome: 'not fixed' }), repair({ number: 2, fixPr: null, outcome: 'not fixed', startedAt: '2027-01-26T05:00:00Z', retro: { cause: 'PRD 2805 waits on a preview secret.', class: 'flake', proposedFix: 'Add the preview secret, then resume.' } })], ...extra,
  }));

  it('asks once: the cause, the repairs tried, the proposed fix, what is left, Resume and Stop the mission', () => {
    const out = html(paused());
    const words = text(out);
    expect(words).toContain('Paused: stuck');
    expect(words).toContain('PRD 2805 waits on a preview secret.');
    expect(words).toContain('PR 3071 · Fix · not fixed');
    expect(words).toContain('Retried as a flake · not fixed');
    expect(words).toContain('Proposed fix: Add the preview secret, then resume.');
    expect(words).toContain('Each cause gets 3 more · 7 of 9 left');
    expect(out).toMatch(/<button[^>]*data-primary[^>]*>Resume/);
    expect(words).toContain('Stop the mission');
    // The row has no second Resume: the question holds both.
    expect(out.match(/>Resume</g)).toHaveLength(1);
    expect(out).not.toContain('Paused: budget reached');
  });
});

describe('Retros (1.C, 1.E)', () => {
  it('draws one card per milestone retro: its headline, both sides with their citations, its file on the mission branch', () => {
    const out = html(missionOf(row({ status: 'delivered' }), [], [], [], undefined, read({ retros: [whole, roadmap] })));
    const words = text(out);
    expect(words).toContain('Retros Roadmap #2790 delivered Went well 3 of 4 PRDs reached ready with no question. (PRD 2803, PRD 2804) To change PRD 2805 was stuck twice on its preview. (repair 4)');
    expect(words).toContain('retros/1-roadmap-2790.md on the mission branch');
    expect(out).toContain('href="https://github.com/acme/shop/blob/mission/40-pay-online/.omni-loop/delivery/missions/40-pay/retros/1-roadmap-2790.md"');
    expect(out).toContain('href="https://github.com/acme/shop/issues/2803"');
    expect(out).toContain('href="https://github.com/acme/shop/pull/2817"');
    // The roadmap's retro comes before the mission's, the order the milestones were reached.
    expect(words.indexOf('Roadmap #2790 delivered')).toBeLessThan(words.indexOf('Mission delivered'));
  });

  it('says a retro with no file is kept on this page only (AC-6)', () => {
    const words = text(html(missionOf(row({ status: 'delivered', level: 'with-you' }), [], [], [], undefined, read({ retros: [whole] }))));
    expect(words).toContain('Mission delivered Went well The QA pair caught 5 bugs. (PR 2817)');
    expect(words).toContain('Kept on this page only');
    expect(words).not.toContain('on the mission branch');
  });

  it('reads a retro that was not written as skipped, never as done', () => {
    const skipped: RetroRow = { id: 'r3', mission: M, milestone: 'mission', file: null, retro: null, skipped: 'budget reached', at: '2027-01-26T10:00:00Z' };
    const words = text(html(missionOf(row({ status: 'delivered' }), [], [], [], undefined, read({ retros: [skipped] }))));
    expect(words).toContain('Mission delivered Retro skipped: budget reached');
    expect(words).not.toContain('Went well');
    expect(words).not.toContain('Kept on this page only');
  });

  it('shows no Retros block for a mission with none, nor another mission\'s retro', () => {
    expect(text(html(missionOf(row(), [], [], [], undefined, read({}))))).not.toContain('Retros');
    expect(text(html(missionOf(row(), [], [], [], undefined, read({ retros: [{ ...whole, mission: 'other' }] }))))).not.toContain('Retros');
  });
});

describe('Questions (1.C, 1.D, AC-7, AC-8)', () => {
  it('draws a question with the form, the wording and the evidence, and Adopt and Decline', () => {
    const out = html(missionOf(row({ status: 'delivered' }), [], [], [], undefined, read({ items: [item] })));
    const words = text(out);
    expect(words).toContain('Questions Change the Roadmap form: Prerequisites Proposed wording: “Name every secret a preview needs.” Evidence: PRD 2805 was stuck twice waiting on a preview secret.');
    expect(out).toMatch(/<button[^>]*data-primary[^>]*>Adopt/);
    expect(words).toContain('Decline');
  });

  it('once adopted shows who, the wording and the line that applies it, and no button', () => {
    const adopted: ItemRow = { ...item, answer: 'adopted', answeredBy: 'Irisa', note: 'In the next docs PR.' };
    const out = html(missionOf(row({ status: 'delivered' }), [], [], [], undefined, read({ items: [adopted] })));
    const words = text(out);
    expect(words).toContain('Adopted by Irisa: “Name every secret a preview needs.”');
    expect(words).toContain('In the next docs PR.');
    expect(words).toContain('Not applied yet. To apply: open a docs pull request on the Roadmap form: Prerequisites, and merge it.');
    expect(out).not.toMatch(/>Adopt</);
    expect(out).not.toMatch(/>Decline</);
  });

  it('says a declined one was declined, with nothing to apply', () => {
    const declined: ItemRow = { ...item, answer: 'declined', answeredBy: null };
    const words = text(html(missionOf(row({ status: 'delivered' }), [], [], [], undefined, read({ items: [declined] }))));
    expect(words).toContain('Declined by a member');
    expect(words).not.toContain('Not applied yet');
  });

  it('points a law at its owner and any other target at a docs pull request', () => {
    expect(applyLine('law BR-PRODUCT-12')).toBe('/omni:knowledge-add amend BR-PRODUCT-12 (only its owner approves).');
    expect(applyLine('rule N-PRODUCT-3')).toBe('open a docs pull request on rule N-PRODUCT-3, and merge it.');
  });
});

describe('the calls', () => {
  it('Adopt and Stop go to their routes, as the signed-in person', async () => {
    const seen: [string, unknown][] = [];
    const fetch = ((path: string, init?: { body?: string }) => { seen.push([path, init?.body === undefined ? null : JSON.parse(init.body)]); return Promise.resolve({ ok: true, json: () => Promise.resolve(path.includes('/items/') ? { item: { id: M, answer: 'adopted' } } : { mission: { id: M, status: 'stopped' } }) }); }) as unknown as typeof globalThis.fetch;
    const port = httpMissionsPort(fetch);
    expect(await port.answerItem(M, 'adopted')).toEqual({ ok: true });
    expect(await port.stopStuck(M)).toEqual({ ok: true });
    expect(seen).toEqual([[`/api/missions/items/${M}`, { answer: 'adopted' }], [`/api/missions/${M}/stop`, null]]);
    expect(await demoMissionsPort.answerItem(M, 'declined')).toMatchObject({ ok: false });
  });
});

describe('the Operation room (2.A)', () => {
  const at = (hour: number) => `2027-01-26T0${String(hour)}:00:00Z`;
  const event = (kind: string, over: Partial<EventRow>): EventRow => ({ id: kind, mission: M, at: at(1), role: 'supervisor', actor: 'agent', kind, prd: null, job: null, link: null, sentence: '', ...over });

  it('adds a row per stuck repair, per milestone retro, per item proposed and per answer', () => {
    const events = [
      event('stuck', { at: at(4), sentence: 'Stuck: 5 jobs, nothing moved. Sent /omni:repair --mission 40 --stuck to any runner (stuck repair 1).' }),
      event('milestone-retro', { at: at(5), sentence: 'Retro: roadmap #2790 delivered.', link: 'https://github.com/acme/shop/blob/mission/40-pay/m/retros/1-roadmap-2790.md' }),
      event('item-proposed', { at: at(6), sentence: 'Proposes a change to the Roadmap form: Prerequisites.' }),
      event('item-answered', { at: at(7), actor: 'irisa', sentence: 'Adopted the change to the Roadmap form: Prerequisites.' }),
      event('stuck-answer', { at: at(8), actor: 'irisa', sentence: 'irisa stopped the mission: it was stuck.' }),
    ];
    const rows = ledgerOf(events, { role: null, mission: null });
    expect(rows.map((r) => [r.by, r.state, r.sentence])).toEqual([
      ['irisa', 'Answered', 'irisa stopped the mission: it was stuck.'],
      ['irisa', 'Answered', 'Adopted the change to the Roadmap form: Prerequisites.'],
      ['Supervisor · agent', 'Proposed', 'Proposes a change to the Roadmap form: Prerequisites.'],
      ['Supervisor · agent', 'Written', 'Retro: roadmap #2790 delivered.'],
      ['Supervisor · agent', 'Stuck', 'Stuck: 5 jobs, nothing moved. Sent /omni:repair --mission 40 --stuck to any runner (stuck repair 1).'],
    ]);
    expect(rows.find((r) => r.state === 'Written')?.linkLabel).toBe('retros/1-roadmap-2790.md');
  });

  it('reads a retro that was not written as Skipped, and the pause by stuck as Paused', () => {
    const rows = ledgerOf([event('milestone-retro', { sentence: 'Retro skipped: budget reached (mission delivered).' }), event('stuck', { at: at(2), sentence: 'Paused: stuck: the cause.' })], { role: null, mission: null });
    expect(rows.map((r) => r.state)).toEqual(['Paused', 'Skipped']);
  });
});
