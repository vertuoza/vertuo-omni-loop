import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { demoGalaxy } from '../../data/load-galaxy';
import type { DemoInput } from '../part';
import { seasonBounds } from '../season';
import { ASK } from './counts';
import { demoCounts } from './demo';

// The four counts in the demo (PRD 328): made up and fixed, as the spec's user story tells them (two
// PRDs created, fourteen questions answered, one waiting, which lands on /ask), since the demo world
// has no ask tables and no contributions.

const input = (now: Date): DemoInput => ({ now, season: seasonBounds(now), galaxy: demoGalaxy(now), login: 'dam-dev', team: 'beaver' });

describe('the demo\'s counts', () => {
  it('are the spec\'s: 14 questions answered, 3 outbox items settled, 2 PRDs created, and 1 question waiting, linking to /ask', () => {
    expect(demoCounts(input(new Date('2026-09-28T10:00:00Z')))).toEqual({ answered: 14, settled: 3, prds: 2, waiting: { count: 1, href: ASK } });
  });

  it('are fixed: the same on any day', () => {
    expect(demoCounts(input(new Date('2026-10-01T01:00:00Z')))).toEqual(demoCounts(input(new Date('2026-09-28T10:00:00Z'))));
  });
});
