import { describe, it, expect } from 'vitest';
import { configFrom } from './config.ts';

const rows = {
  sectors: [{ name: 'ai', repos: ['vertuo-ai-domain', 'vertuo-mcp'] }, { name: 'core', repos: ['vertuo-core'] }],
  teams: [
    { name: 'beaver', home: 'core', label: 'BEAVER', color: '#d08a4a', motto: 'Dams.', mascot: 'beaver', sort: 10, retired_at: null },
    { name: 'octopod', home: 'ai' },
    { name: 'invincible-team', home: null, retired_at: '2026-09-25T15:00:00+00:00' },
  ],
  roster: [
    { github_login: 'Alice', team: 'beaver' },
    { github_login: 'bob', team: 'octopod' },
    { github_login: 'mark', team: 'invincible-team' },
    { github_login: 'ghost', team: 'no-such-fleet' },
  ],
};

describe('config', () => {
  it('turns the sectors into lookups', () => {
    const c = configFrom(rows);
    expect(c.repos).toEqual(['vertuo-ai-domain', 'vertuo-mcp', 'vertuo-core']);
    expect(c.sectorOf('vertuo-mcp')).toBe('ai');
    expect(c.sectorOf('unknown')).toBeNull();
    expect(c.homeOf('beaver')).toBe('core');
    expect(c.homeOf('invincible-team')).toBeNull();
    expect(c.homeOf('nobody')).toBeNull();
  });

  it('keeps each fleet\'s look and marks the retired ones', () => {
    const c = configFrom(rows);
    expect(c.teams.beaver).toEqual({ home: 'core', label: 'BEAVER', color: '#d08a4a', motto: 'Dams.', mascot: 'beaver', sort: 10, retired: false });
    expect(c.teams.octopod).toEqual({ home: 'ai', retired: false });
    expect(c.teams['invincible-team']!.retired).toBe(true);
  });

  it('answers a login\'s fleet whatever its case, and leaves out retired or unknown fleets', () => {
    const c = configFrom(rows);
    expect(c.roster).toEqual({ alice: 'beaver', bob: 'octopod' });
    expect(c.teamOf('ALICE')).toBe('beaver');
    expect(c.teamOf('mark')).toBeNull();
    expect(c.teamOf('ghost')).toBeNull();
    expect(c.teamOf(null)).toBeNull();
  });

  it('names the tracked repositories the game reads, and finds a full name\'s sector by its bare name (PRD 728)', () => {
    const c = configFrom({
      ...rows,
      repositories: [
        { full_name: 'vertuoza/vertuo-ai-domain', tracked: true },
        { full_name: 'vertuoza/old-thing', tracked: false },
        { full_name: 'Vertuoza/Vertuo-Apps', tracked: true },
      ],
    });
    expect(c.tracked).toEqual(['vertuoza/vertuo-ai-domain', 'vertuoza/vertuo-apps']);
    expect(c.sectorOf('vertuoza/vertuo-ai-domain')).toBe('ai');
    expect(c.sectorOf('vertuoza/vertuo-apps')).toBeNull();
    expect(configFrom(rows).tracked).toEqual([]);
  });

  it('refuses a fleet whose home is not a sector', () => {
    expect(() => configFrom({ sectors: [], teams: [{ name: 'beaver', home: 'nowhere' }] })).toThrow(/home/);
  });
});
