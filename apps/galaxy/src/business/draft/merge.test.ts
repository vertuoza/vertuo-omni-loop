import { describe, expect, it } from 'vitest';
import type { ClaimKind, ClaimState, StoredClaim } from '../model';
import { mergeOf, snapSize } from './merge';
import { sure } from '../../arcade/test/sure';

// Decision 9 of PRD 774 as a table: what a verified candidate becomes against what the business holds,
// and a size snapped to the slider's stops before it is compared.

const row = (seq: number, kind: ClaimKind, value: string, state: ClaimState, product: string | null = kind === 'region' ? null : 'p-1'): StoredClaim =>
  ({ id: `c-${seq}`, seq, kind, value, source: 'pick', state, product_id: product });

describe('mergeOf, decision 9', () => {
  const cases: Array<{ holds: string; held: StoredClaim[]; kind: ClaimKind; value: string; outcome: string; replaces?: string }> = [
    { holds: 'nothing for that value', held: [], kind: 'region', value: 'France', outcome: 'added' },
    { holds: 'nothing for that value, another region confirmed', held: [row(1, 'region', 'Belgium', 'confirmed')], kind: 'region', value: 'France', outcome: 'added' },
    { holds: 'the value, confirmed', held: [row(1, 'region', 'Belgium', 'confirmed')], kind: 'region', value: 'belgium', outcome: 'seen' },
    { holds: 'the value, proposed', held: [row(1, 'rival', 'Acme', 'proposed')], kind: 'rival', value: 'Acme', outcome: 'seen' },
    { holds: 'the value, contradicted', held: [row(1, 'offering', 'ERP', 'contradicted')], kind: 'offering', value: 'ERP', outcome: 'seen' },
    { holds: 'the value, rejected', held: [row(1, 'trade', 'retail', 'rejected')], kind: 'trade', value: 'Retail', outcome: 'rejected' },
    { holds: 'another confirmed offering', held: [row(1, 'offering', 'ERP', 'confirmed')], kind: 'offering', value: 'CRM', outcome: 'replacing', replaces: 'c-1' },
    { holds: 'another confirmed size', held: [row(1, 'size', '2-50', 'confirmed')], kind: 'size', value: '10-100', outcome: 'replacing', replaces: 'c-1' },
    { holds: 'two confirmed offerings: the oldest is replaced', held: [row(3, 'offering', 'CRM', 'confirmed'), row(2, 'offering', 'ERP', 'confirmed')], kind: 'offering', value: 'analytics', outcome: 'replacing', replaces: 'c-2' },
    { holds: 'another offering, only proposed', held: [row(1, 'offering', 'ERP', 'proposed')], kind: 'offering', value: 'CRM', outcome: 'added' },
    { holds: 'another offering, rejected', held: [row(1, 'offering', 'ERP', 'rejected')], kind: 'offering', value: 'CRM', outcome: 'added' },
    { holds: 'another confirmed trade: trade holds several here', held: [row(1, 'trade', 'retail', 'confirmed')], kind: 'trade', value: 'construction', outcome: 'added' },
    { holds: 'another confirmed Never line: several are held at once', held: [row(1, 'never', 'Build for groups of companies', 'confirmed')], kind: 'never', value: 'Answer public tenders', outcome: 'added' },
    { holds: 'the Never line, rejected', held: [row(1, 'never', 'Answer public tenders', 'rejected')], kind: 'never', value: 'answer public tenders', outcome: 'rejected' },
    { holds: 'the offering, on another product', held: [row(1, 'offering', 'ERP', 'confirmed', 'p-2')], kind: 'offering', value: 'CRM', outcome: 'added' },
  ];

  it.each(cases)('holds $holds: $outcome', ({ held, kind, value, outcome, replaces }) => {
    expect(mergeOf(held, kind, value, 'p-1')).toEqual({ outcome, replaces: replaces ?? null });
  });

  it('puts a region on the business, whatever product the source is on', () => {
    expect(mergeOf([row(1, 'region', 'Belgium', 'rejected')], 'region', 'Belgium', 'p-9').outcome).toBe('rejected');
  });
});

describe('snapSize', () => {
  it.each([
    ['2-50', '2-50'],
    ['30-60', '20-100'],
    ['30 to 60 employees', '20-100'],
    ['12', '10-20'],
    ['20', '20-20'],
    ['50+', '50-1000+'],
    ['2,000+ people', '1000+-1000+'],
    ['1000+', '1000+-1000+'],
    ['1-5000', '1-1000+'],
  ])('snaps %s to %s', (raw, snapped) => {
    expect(snapSize(raw)).toBe(snapped);
  });

  it('gives null when no number is named', () => {
    expect(snapSize('small firms')).toBeNull();
    expect(snapSize('0')).toBeNull();
    expect(snapSize('1, 5 or 20')).toBeNull();
  });

  it('compares a snapped size with the one held', () => {
    const snapped = snapSize('30-60');
    expect(snapped).not.toBeNull();
    expect(mergeOf([row(1, 'size', '20-100', 'confirmed')], 'size', sure(snapped, 'snapped'), 'p-1').outcome).toBe('seen');
  });
});
