import { describe, expect, it } from 'vitest';
import { railReader, type RailDb } from './rail.repository';

// The rail's read of a fleet's missions (#3320): a mission's scope names repository PRD numbers and product PRD ids.

const ID = '11111111-1111-4111-8111-111111111111';
const WORKSPACE = '33333333-3333-4333-8333-333333333333';

function fakeDb(missions: unknown[]): RailDb {
  const answer = Promise.resolve({ data: missions, error: null });
  const self: Record<string, unknown> = { then: answer.then.bind(answer) };
  for (const name of ['select', 'eq', 'neq', 'order', 'limit']) self[name] = () => self;
  return { from: () => self, rpc: () => Promise.resolve({ data: null, error: null }) } as unknown as RailDb;
}

describe('the rail\'s missions', () => {
  it('reads a mission whose scope mixes a PRD number and a product PRD id', async () => {
    const mission = { id: ID, number: 41, repo: 'demo-org/shop', status: 'running', scope: { prds: [2803, 'demo-loop-28'], roadmaps: [] } };
    expect(await railReader(fakeDb([mission])).missions(WORKSPACE, 'night-shift')).toEqual([{ id: ID, number: 41, repo: 'demo-org/shop', status: 'running', prds: [2803, 'demo-loop-28'] }]);
  });
});
