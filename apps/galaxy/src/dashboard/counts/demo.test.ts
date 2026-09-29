import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { demoGalaxy } from '../../data/load-galaxy';
import type { DemoInput } from '../part';
import { seasonBounds } from '../season';
import { ASK } from './counts';
import { demoWaiting } from './demo';

// Waiting for you in the demo (PRD 328): made up and fixed, one question waiting, which lands on
// /ask, since the demo world has no ask tables.

const input = (now: Date): DemoInput => ({ now, season: seasonBounds(now), galaxy: demoGalaxy(now), login: 'dam-dev', team: 'beaver' });

describe('the demo\'s Waiting for you', () => {
  it('is 1 question waiting, linking to /ask', () => {
    expect(demoWaiting(input(new Date('2026-09-28T10:00:00Z')))).toEqual({ count: 1, href: ASK });
  });

  it('is fixed: the same on any day', () => {
    expect(demoWaiting(input(new Date('2026-10-01T01:00:00Z')))).toEqual(demoWaiting(input(new Date('2026-09-28T10:00:00Z'))));
  });
});
