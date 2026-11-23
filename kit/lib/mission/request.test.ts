import { describe, expect, it } from 'vitest';
import { isRequestId, readRequest, requestLines } from './request.ts';

describe('a mission request as the page answers it', () => {
  it('reads the fleet and the goal, the goal word for word', () => {
    const goal = "  Quotes get a dark mode, for night owls: it's 100% theirs  ";
    expect(readRequest({ request: { id: 'x', fleet: 'crew-bots', goal } })).toEqual({ fleet: 'crew-bots', goal });
    expect(requestLines({ fleet: 'crew-bots', goal })).toEqual(['fleet: crew-bots', `goal: ${goal}`]);
  });

  it('reads nothing from a reply with no goal or no fleet', () => {
    expect(readRequest({})).toBeNull();
    expect(readRequest({ request: { fleet: 'crew-bots', goal: '  ' } })).toBeNull();
    expect(readRequest({ request: { goal: 'a goal' } })).toBeNull();
  });

  it('knows a uuid', () => {
    expect(isRequestId('3f2a9c1e-7b4d-4e8a-9c2f-1a2b3c4d5e6f')).toBe(true);
    expect(isRequestId('dark-mode')).toBe(false);
  });
});
