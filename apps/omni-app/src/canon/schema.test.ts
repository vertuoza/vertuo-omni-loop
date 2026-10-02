// What the canon gate reads (PRD 725, s20): the business the database answers and each finding of
// the model's reply, extra fields and all; a business missing what the gate uses fails, naming the field.
import { describe, expect, it } from 'vitest';
import { BusinessSchema, FindingSchema, parseBusiness } from './schema.ts';

const BUSINESS = {
  state: 'ok',
  business: { name: 'Vertuoza' },
  product: null,
  claims: [{ id: 'never#4', kind: 'never', value: 'Never: build for groups of companies', source: 'pick', state: 'confirmed' }],
  personas: [{ name: 'Marc', stance: null, trade: 'plumbing', who: 'runs five plumbers', usage: null }],
  updatedAt: null,
};

describe('the canon gate schemas', () => {
  it('read a business as the database answers it, every field kept', () => {
    expect(parseBusiness(BUSINESS)).toEqual(BUSINESS);
    expect(parseBusiness({ state: 'none', business: null, claims: [], personas: [], updatedAt: null })).toMatchObject({ business: null });
  });

  it('refuse a business whose claim has no id, naming the field', () => {
    expect(() => parseBusiness({ ...BUSINESS, claims: [{ kind: 'never', value: 'x' }] })).toThrow(/^the business read is malformed: claims\.0\.id: /);
    expect(BusinessSchema.safeParse({ ...BUSINESS, personas: [{ who: 'nobody' }] }).error?.issues[0]?.path).toEqual(['personas', 0, 'name']);
  });

  it('read a finding by its quote and claims, and refuse one whose claims are not text', () => {
    expect(FindingSchema.parse({ quote: 'six entities', claims: ['size#1'], why: 'too big' })).toEqual({ quote: 'six entities', claims: ['size#1'], why: 'too big' });
    expect(FindingSchema.safeParse({ quote: 'six entities', claims: [4] }).error?.issues[0]?.path).toEqual(['claims', 0]);
  });
});
