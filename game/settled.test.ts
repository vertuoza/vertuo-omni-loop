import { describe, it, expect } from 'vitest';
import { makeEvent, type GameEvent } from './events.ts';
import { settledPlanets } from './settled.ts';

const HOME = 'vertuoza/vertuo-tom';
const NOW = new Date('2026-10-11T09:00:00Z');
const ev = (id: string, type: string, at: string, over: Record<string, unknown> = {}): GameEvent => makeEvent({ id, type, at, planet: 513, home: HOME, ...over });
const terraformed = ev(`planet:${HOME}#513:terraformed`, 'PLANET_TERRAFORMED', '2026-10-10T21:51:51Z');
const merged = ev(`merge:${HOME}#515:${HOME}#513:merged`, 'FEATURE_MERGED', '2026-10-10T21:51:51Z', { region: HOME, contributor: 'martl-vertuoza', data: { pr: 515 } });
const wound = (state: 'opened' | 'closed', at: string) => ev(`outbox:${HOME}:${HOME}#513/s3-01:${state}`, state === 'opened' ? 'WOUND_OPENED' : 'WOUND_CLOSED', at, { region: HOME });

describe('settledPlanets', () => {
  it('settles a terraformed planet whose feature PR merged and whose wounds all closed', () => {
    const settled = settledPlanets([terraformed, merged, wound('opened', '2026-10-10T21:20:00Z'), wound('closed', '2026-10-10T21:40:00Z')], NOW);
    expect([...settled]).toEqual([[`${HOME}#513`, { mergedAt: '2026-10-10T21:51:51Z', repo: HOME, pr: 515, readBugs: true }]]);
  });

  it('still reads bugs in the aftershock window, and no more after it', () => {
    expect(settledPlanets([terraformed, merged], new Date('2026-10-24T21:51:51Z')).get(`${HOME}#513`)?.readBugs).toBe(true);
    expect(settledPlanets([terraformed, merged], new Date('2026-10-24T21:51:52Z')).get(`${HOME}#513`)?.readBugs).toBe(false);
  });

  it('never settles a planet with a wound open, one with no merge it knows, or one not terraformed', () => {
    expect(settledPlanets([terraformed, merged, wound('opened', '2026-10-10T21:20:00Z')], NOW).size).toBe(0);
    expect(settledPlanets([terraformed], NOW).size).toBe(0);
    expect(settledPlanets([merged, ev(`planet:${HOME}#513:decommissioned`, 'PLANET_DECOMMISSIONED', '2026-10-10T21:51:52Z')], NOW).size).toBe(0);
  });

  it('takes the home\'s feature PR over another region\'s, and ignores rows written before PRD 728', () => {
    const elsewhere = ev(`merge:vertuoza/vertuo-apps#40:${HOME}#513:merged`, 'FEATURE_MERGED', '2026-10-10T20:00:00Z', { region: 'vertuoza/vertuo-apps', data: { pr: 40 } });
    expect(settledPlanets([terraformed, merged, elsewhere], NOW).get(`${HOME}#513`)).toMatchObject({ repo: HOME, pr: 515 });
    expect(settledPlanets([terraformed, elsewhere], NOW).get(`${HOME}#513`)).toMatchObject({ repo: 'vertuoza/vertuo-apps', pr: 40 });
    const { home: _home, ...old } = terraformed;
    expect(settledPlanets([makeEvent(old), makeEvent({ ...merged, home: undefined })].map((e) => ({ ...e })), NOW).size).toBe(0);
  });
});
