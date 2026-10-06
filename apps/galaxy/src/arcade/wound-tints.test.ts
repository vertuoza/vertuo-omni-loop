import { WOUND_TINT } from '@omni/design';
import { WOUND_KINDS } from 'vertuo-omni-plan/game/events.ts';
import { describe, expect, it } from 'vitest';

// The arcade is where the game's wounds meet the design's sprites: the design never imports the game
// (PRD 1066), so the two lists are held equal here, where both may be read.
describe('the wound tints', () => {
  it('has a tint in the design for every wound kind the game names, and no other', () => {
    expect(Object.keys(WOUND_TINT).sort()).toEqual([...WOUND_KINDS].sort());
  });
});
