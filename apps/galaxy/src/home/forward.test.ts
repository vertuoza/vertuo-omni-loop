import { describe, expect, it } from 'vitest';
import { FORWARD_SCRIPT, forwardOf } from './forward';
import { runInNewContext } from 'node:vm';

// The arcade's old deep links, opened on HOME: each goes on to the game at /play with the same hash,
// and any other hash stays on HOME (PRD 261).

describe('forwarding the arcade\'s old links from HOME', () => {
  it.each(['#map', '#fleets', '#heroes', '#briefing', '#planet-7', '#planet-2332'])('sends %s on to /play', (hash) => {
    expect(forwardOf(hash)).toBe(`/play${hash}`);
  });

  // The links the rest of the app still writes to the arcade: the star chart from /knowledge, the menu
  // from the app's Game mode, and the game room.
  it.each(['#chart', '#menu', '#games'])('sends %s on to /play as well', (hash) => {
    expect(forwardOf(hash)).toBe(`/play${hash}`);
  });

  it.each(['', '#', '#top', '#planet-x', '#planet-', '#map2', '#MAP', '#map/x', 'map'])('keeps %j on HOME', (hash) => {
    expect(forwardOf(hash)).toBeNull();
  });
});

describe('the script HOME runs before it paints', () => {
  const run = (hash: string) => {
    const went: string[] = [];
    const location = { hash, replace: (to: string) => { went.push(to); } };
    runInNewContext(FORWARD_SCRIPT, { location });
    return went;
  };

  it('replaces the address with /play and the same hash', () => {
    expect(run('#planet-12')).toEqual(['/play#planet-12']);
    expect(run('#briefing')).toEqual(['/play#briefing']);
  });

  it('leaves any other hash where it is', () => {
    expect(run('')).toEqual([]);
    expect(run('#top')).toEqual([]);
    expect(run('#planet-x')).toEqual([]);
  });
});
