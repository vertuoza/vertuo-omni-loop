import { describe, expect, it } from 'vitest';
import { makeMarkers } from './markers.ts';

describe('makeMarkers', () => {
  it('reproduces upstream markers byte for byte with the vertuo-outbox prefix', () => {
    const m = makeMarkers('vertuo-outbox');
    expect(m.comment).toBe('<!-- vertuo-outbox -->');
    expect(m.prComment).toBe('<!-- vertuo-outbox-pr -->');
    expect(m.settledOpen('s1-01-x')).toBe('<!-- vertuo-outbox-settled: s1-01-x -->');
    expect(m.settledClose('s1-01-x')).toBe('<!-- /vertuo-outbox-settled: s1-01-x -->');
    expect('<!-- vertuo-outbox-settled: s1-01-x -->').toMatch(m.settledOpenRe);
    expect(m.round(2, [1, 3])).toBe('<!-- vertuo-outbox-round: 2 1,3 -->');
    expect('<!-- vertuo-outbox-round: 2 1,3 -->'.match(m.roundRe)?.slice(1)).toEqual(['2', '1,3']);
    expect('<!-- vertuo-outbox-numbers: {"a":1} -->'.match(m.numbersRe)?.[1]).toBe('{"a":1}');
    expect('<!-- vertuo-outbox-announced: a,b -->'.match(m.announcedRe)?.[1]).toBe('a,b');
  });
  it('names the status comment /omni:pr keeps on every pull request (PRD 714)', () => {
    expect(makeMarkers('omni-outbox').status).toBe('<!-- omni-outbox-status -->');
    expect(makeMarkers('vertuo-outbox').status).toBe('<!-- vertuo-outbox-status -->');
  });
  it('uses the configured prefix', () => {
    expect(makeMarkers('omni-outbox').settledOpen('x')).toBe('<!-- omni-outbox-settled: x -->');
  });
});
