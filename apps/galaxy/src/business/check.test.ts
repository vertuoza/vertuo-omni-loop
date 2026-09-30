import { describe, expect, it } from 'vitest';
import { claimOf, type Claim } from './model';
import { foundRows, thatsUs } from './reveal';
import {
  additionText, checkRows, FADE_MS, isFaded, lastSeenOf, seenSince, settled, stillTrue,
} from './check';

// What the weekly recheck leaves to check (PRD 774 s4), as pure data: an addition (a new value of a kind
// that holds several, beside confirmed ones), a replacement (a new offering or size that would replace a
// confirmed one, now contradicted), and a faded claim (confirmed, quoted before, and not quoted for eight
// weeks). ✓ / ✗ settle each; ✓ Still true clears a fade.

const NOW = Date.parse('2026-10-05T09:00:00Z');
const WEEK = 7 * 24 * 3600_000;
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const claim = (seq: number, kind: Claim['kind'], value: string, over: Partial<Claim> = {}): Claim =>
  ({ id: `c-${seq}`, seq, kind, value, source: 'pick', state: 'confirmed', cited: 0, lastBy: null, ...over });
const receipt = (seenAt: string) => ({ kind: 'file' as const, where: 'acme/app/README.md', quote: 'We sell in France.', seenAt });
const evidence = (seq: number, kind: Claim['kind'], value: string, over: Partial<Claim> = {}) =>
  claim(seq, kind, value, { source: 'evidence', state: 'proposed', receipts: [receipt(ago(0))], ...over });

describe('the rows to check', () => {
  it('an addition: a new region beside a confirmed one, said as the list it would become', () => {
    const claims = [claim(1, 'region', 'Belgium'), evidence(2, 'region', 'France')];
    const rows = checkRows(claims, NOW);
    expect(rows).toEqual([{ kind: 'addition', claim: claims[1], before: [claims[0]] }]);
    expect(additionText(rows[0] as Extract<typeof rows[0], { kind: 'addition' }>)).toEqual({ label: 'Region', from: 'Belgium', to: 'Belgium + France' });
  });

  it('a first value of a kind is a found row, not an addition', () => {
    const claims = [evidence(1, 'region', 'France')];
    expect(checkRows(claims, NOW)).toEqual([]);
    expect(foundRows(claims)).toEqual(claims);
  });

  it('an addition leaves What we found', () => {
    const claims = [claim(1, 'rival', 'Brick & Co'), evidence(2, 'rival', 'Mortar Inc'), evidence(3, 'trade', 'construction')];
    expect(foundRows(claims).map((c) => c.id)).toEqual(['c-3']);
  });

  it('a replacement: a new offering over the confirmed one, now contradicted', () => {
    const old = claim(1, 'offering', 'ERP', { state: 'contradicted' });
    const newer = evidence(2, 'offering', 'CRM', { replaces: 'c-1' });
    expect(checkRows([old, newer], NOW)).toEqual([{ kind: 'replacement', claim: newer, old }]);
  });

  it('a replacement whose old claim is not on the page shows nothing', () => {
    expect(checkRows([evidence(2, 'offering', 'CRM', { replaces: 'gone' })], NOW)).toEqual([]);
  });

  it('comes on top in order: replacements, additions, then faded claims', () => {
    const claims = [
      claim(1, 'region', 'Belgium'),
      claim(2, 'rival', 'Brick & Co', { receipts: [receipt(ago(9 * WEEK))], lastSeen: ago(9 * WEEK) }),
      evidence(3, 'region', 'France'),
      claim(4, 'offering', 'ERP', { state: 'contradicted' }),
      evidence(5, 'offering', 'CRM', { replaces: 'c-4' }),
    ];
    expect(checkRows(claims, NOW).map((r) => `${r.kind} ${r.claim.id}`)).toEqual(['replacement c-5', 'addition c-3', 'faded c-2']);
  });
});

describe('fading', () => {
  it('a confirmed claim with receipts unseen for eight weeks fades', () => {
    const c = claim(1, 'rival', 'Brick & Co', { receipts: [receipt(ago(FADE_MS + 1))], lastSeen: ago(FADE_MS + 1) });
    expect(isFaded(c, NOW)).toBe(true);
    expect(checkRows([c], NOW)).toEqual([{ kind: 'faded', claim: c, since: ago(FADE_MS + 1) }]);
  });

  it('a claim quoted within eight weeks does not fade', () => {
    expect(isFaded(claim(1, 'rival', 'X', { receipts: [receipt(ago(FADE_MS - 1))] }), NOW)).toBe(false);
  });

  it('a claim without receipts (a pick) never fades, however old', () => {
    expect(isFaded(claim(1, 'rival', 'X', { lastSeen: ago(52 * WEEK) }), NOW)).toBe(false);
  });

  it('only a confirmed claim fades', () => {
    expect(isFaded(claim(1, 'rival', 'X', { state: 'rejected', receipts: [receipt(ago(9 * WEEK))] }), NOW)).toBe(false);
  });

  it('last seen is the newer of the claim’s last_seen and its newest receipt', () => {
    expect(lastSeenOf(claim(1, 'rival', 'X', { receipts: [receipt(ago(9 * WEEK))], lastSeen: ago(WEEK) }))).toBe(ago(WEEK));
    expect(lastSeenOf(claim(1, 'rival', 'X', { receipts: [receipt(ago(WEEK))], lastSeen: ago(9 * WEEK) }))).toBe(ago(WEEK));
    expect(lastSeenOf(claim(1, 'rival', 'X'))).toBeNull();
  });

  it('says its date as "not seen since 12 Aug"', () => {
    expect(seenSince('2026-08-12T15:00:00Z')).toBe('not seen since 12 Aug');
  });

  it('✓ Still true clears it', () => {
    const c = claim(1, 'rival', 'X', { receipts: [receipt(ago(9 * WEEK))], lastSeen: ago(9 * WEEK) });
    const after = stillTrue([c], 'c-1', new Date(NOW).toISOString());
    expect(after[0].lastSeen).toBe(new Date(NOW).toISOString());
    expect(isFaded(after[0], NOW)).toBe(false);
  });

  it('reads last_seen from the stored row', () => {
    const row = { id: 'c-1', seq: 1, kind: 'rival', value: 'X', source: 'evidence', state: 'confirmed', last_seen: '2026-08-12T15:00:00Z' };
    expect(claimOf(row).lastSeen).toBe('2026-08-12T15:00:00Z');
    expect(claimOf({ ...row, last_seen: null })).not.toHaveProperty('lastSeen');
  });
});

describe('settling', () => {
  const old = claim(1, 'offering', 'ERP', { state: 'contradicted' });
  const newer = evidence(2, 'offering', 'CRM', { replaces: 'c-1' });

  it('✓ Right on a replacement confirms the new claim and rejects the old', () => {
    const after = settled([old, newer], { ...newer, state: 'confirmed' });
    expect(after.find((c) => c.id === 'c-2')?.state).toBe('confirmed');
    expect(after.find((c) => c.id === 'c-1')?.state).toBe('rejected');
  });

  it('✗ Wrong on a replacement rejects the new claim and confirms the old again', () => {
    const after = settled([old, newer], { ...newer, state: 'rejected' });
    expect(after.find((c) => c.id === 'c-2')?.state).toBe('rejected');
    expect(after.find((c) => c.id === 'c-1')?.state).toBe('confirmed');
  });

  it('✓ / ✗ on an addition confirm or reject it alone', () => {
    const be = claim(1, 'region', 'Belgium');
    const fr = evidence(2, 'region', 'France');
    expect(settled([be, fr], { ...fr, state: 'confirmed' }).map((c) => c.state)).toEqual(['confirmed', 'confirmed']);
    expect(settled([be, fr], { ...fr, state: 'rejected' }).map((c) => c.state)).toEqual(['confirmed', 'rejected']);
  });

  it('keeps the receipts and citations the saved row comes back without', () => {
    const fr = evidence(2, 'region', 'France', { cited: 3, lastBy: 'plan #7' });
    const after = settled([fr], { ...fr, state: 'confirmed', receipts: undefined, cited: 0, lastBy: null });
    expect(after[0]).toMatchObject({ state: 'confirmed', cited: 3, lastBy: 'plan #7', receipts: fr.receipts });
  });

  it('That’s us confirms a waiting addition too, as the database does', () => {
    const claims = [claim(1, 'region', 'Belgium'), evidence(2, 'region', 'France'), evidence(3, 'trade', 'construction')];
    expect(thatsUs(claims, {}).claims.map((c) => c.state)).toEqual(['confirmed', 'confirmed', 'confirmed']);
  });
});
