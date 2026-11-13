// Where a question goes (PRD omni-loop-7 s3): pure, with fixture vectors. The vectors stand for questions by their
// direction: two wordings of one question point almost the same way, an unrelated one points elsewhere.
import { describe, expect, it } from 'vitest';
import { cosine, place, SIMILARITY } from './group.ts';

/** "can a quote be sent without a payment term" */
const SENT_WITHOUT_TERM = [0.9, 0.3, 0.1, 0.05];
/** "can a quote go out with no payment term" */
const OUT_WITH_NO_TERM = [0.88, 0.33, 0.12, 0.04];
/** "how do I reset my password" */
const PASSWORD = [0.1, 0.05, 0.9, 0.4];

describe('SIMILARITY', () => {
  it('is 0.92, the spec\'s threshold', () => {
    expect(SIMILARITY).toBe(0.92);
  });
});

describe('cosine', () => {
  it('is 1 for the same direction, 0 for orthogonal ones and for a vector with no length', () => {
    expect(cosine([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBe(0);
    expect(cosine([0, 0], [1, 1])).toBe(0);
    expect(cosine([1, 1], [0, 0])).toBe(0);
  });
});

describe('place — a question joins the nearest group within the threshold, or starts one', () => {
  it('puts two wordings of one question in one group, and an unrelated question in another', () => {
    const near = { groupId: 'g-1', cosine: cosine(OUT_WITH_NO_TERM, SENT_WITHOUT_TERM) };
    expect(near.cosine).toBeGreaterThanOrEqual(SIMILARITY);
    expect(place(near)).toEqual({ kind: 'join', groupId: 'g-1' });

    const far = { groupId: 'g-1', cosine: cosine(PASSWORD, SENT_WITHOUT_TERM) };
    expect(far.cosine).toBeLessThan(SIMILARITY);
    expect(place(far)).toEqual({ kind: 'start' });
  });

  it('joins at the threshold exactly and starts just below it', () => {
    expect(place({ groupId: 'g-1', cosine: 0.92 })).toEqual({ kind: 'join', groupId: 'g-1' });
    expect(place({ groupId: 'g-1', cosine: 0.9199 })).toEqual({ kind: 'start' });
  });

  it('starts a group when the product has none', () => {
    expect(place(null)).toEqual({ kind: 'start' });
  });

  it('reads the threshold as a setting of the job', () => {
    expect(place({ groupId: 'g-1', cosine: 0.8 }, 0.75)).toEqual({ kind: 'join', groupId: 'g-1' });
    expect(place({ groupId: 'g-1', cosine: 0.95 }, 0.97)).toEqual({ kind: 'start' });
  });
});
