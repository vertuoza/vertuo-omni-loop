import { describe, expect, it } from 'vitest';
import { AI_FLEET_PATH, PLAYERS_FLEET_PATH, fleetRedirect } from './redirect';

// An AI fleet's page is on /app/ai-fleet, a players' fleet's on /app/fleet; a link to the wrong one lands on the right one (PRD 3233 s3).

describe('fleetRedirect', () => {
  it('AC-8: sends /app/fleet?fleet=<an AI fleet> to /app/ai-fleet, every other query kept', () => {
    expect(fleetRedirect(PLAYERS_FLEET_PATH, 'orion', ['orion'], { fleet: 'orion', tab: 'missions' })).toBe('/app/ai-fleet?fleet=orion&tab=missions');
    expect(fleetRedirect(PLAYERS_FLEET_PATH, 'orion', ['orion'], { fleet: 'orion', period: '30d', tab: 'board' })).toBe('/app/ai-fleet?fleet=orion&period=30d&tab=board');
  });

  it('sends /app/ai-fleet?fleet=<a players\' fleet> back to /app/fleet', () => {
    expect(fleetRedirect(AI_FLEET_PATH, 'beaver', ['orion'], { fleet: 'beaver', period: '7d' })).toBe('/app/fleet?fleet=beaver&period=7d');
  });

  it('leaves each fleet on its own page, and a page with no fleet asked', () => {
    expect(fleetRedirect(PLAYERS_FLEET_PATH, 'beaver', ['orion'], { fleet: 'beaver' })).toBeNull();
    expect(fleetRedirect(AI_FLEET_PATH, 'orion', ['orion'], { fleet: 'orion' })).toBeNull();
    expect(fleetRedirect(PLAYERS_FLEET_PATH, null, ['orion'], {})).toBeNull();
    expect(fleetRedirect(AI_FLEET_PATH, null, ['orion'], {})).toBeNull();
  });
});
