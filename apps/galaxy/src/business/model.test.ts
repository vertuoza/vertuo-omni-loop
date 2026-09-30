import { describe, expect, it } from 'vitest';
import {
  businessReducer, citationLine, claimOf, displayId, initialState, OFFERINGS, planConfirm, planPick, planTap, REGIONS,
  sentence, sentenceText, sizeOf, sizeStops, TRADES, valueLabel, type Claim,
} from './model';

// Settings → Business as pure data (PRD 748 s2): the sentence the confirmed claims write, what a pick
// changes (a kind that holds one value rejects the old claim before the new one is picked, since no
// function replaces a claim), the citation line, and the page's state.

let next = 0;
const claim = (kind: Claim['kind'], value: string, over: Partial<Claim> = {}): Claim => {
  next += 1;
  return { id: `c-${next}`, seq: next, kind, value, source: 'pick', state: 'confirmed', cited: 0, lastBy: null, ...over };
};

describe('a stored claim', () => {
  it('reads its row and counts its citations, the last one naming who cited it and for what', () => {
    const row = { id: 'c-9', seq: 4, kind: 'rival', value: 'Acme Build', source: 'suggestion', state: 'confirmed', product_id: 'p-1' };
    const citations = [
      { claim_id: 'c-9', cited_by: 'think-big', ref: 'concept #9', cited_at: '2026-10-02T10:00:00Z' },
      { claim_id: 'c-9', cited_by: 'brainstorm', ref: null, cited_at: '2026-10-01T10:00:00Z' },
      { claim_id: 'c-1', cited_by: 'think-big', ref: null, cited_at: '2026-10-03T10:00:00Z' },
    ];
    const read = claimOf(row, citations);
    expect(read).toEqual({ id: 'c-9', seq: 4, kind: 'rival', value: 'Acme Build', source: 'suggestion', state: 'confirmed', cited: 2, lastBy: 'think-big concept #9' });
    expect(displayId(read)).toBe('rival#4');
    expect(citationLine(read)).toBe('cited 2× · last by think-big concept #9');
    expect(citationLine(claimOf(row))).toBe('not cited yet');
  });

  it('says a size in people, and a list value with its first letter up', () => {
    expect(valueLabel({ kind: 'size', value: '2-50' })).toBe('2–50 people');
    expect(valueLabel({ kind: 'trade', value: 'construction' })).toBe('Construction');
  });
});

describe('the pick lists', () => {
  it('are short, generic, and end nowhere with Other (the page adds it)', () => {
    expect(OFFERINGS).toEqual(['ERP', 'CRM', 'marketplace', 'developer tool', 'analytics', 'e-commerce']);
    expect(TRADES).toEqual(['construction', 'retail', 'healthcare', 'finance', 'logistics', 'manufacturing', 'software']);
    expect(REGIONS).toEqual(['Belgium', 'France', 'Netherlands', 'Germany', 'United Kingdom', 'Europe', 'North America', 'Worldwide']);
  });
});

describe('the sentence', () => {
  it('has a blank per kind while nothing is confirmed', () => {
    expect(sentenceText([])).toBe('We sell ___ to ___-person ___ in ___, up against ___.');
    expect(sentence([]).filter((p) => 'blank' in p).map((p) => 'blank' in p && p.blank)).toEqual(['offering', 'size', 'trade', 'region', 'rival']);
  });

  it('fills each blank from the confirmed claims, and leaves out proposed and rejected ones', () => {
    const claims = [
      claim('offering', 'ERP'), claim('size', '2-50'), claim('trade', 'construction'), claim('region', 'Belgium'),
      claim('region', 'France'), claim('rival', 'Acme Build'), claim('rival', 'Guessed Co', { state: 'proposed', source: 'suggestion' }),
      claim('rival', 'Wrong Co', { state: 'rejected' }),
    ];
    expect(sentenceText(claims)).toBe('We sell an ERP to 2–50-person construction firms in Belgium and France, up against Acme Build.');
  });

  it('fills blanks one at a time, as a member taps', () => {
    expect(sentenceText([claim('offering', 'CRM')])).toBe('We sell a CRM to ___-person ___ in ___, up against ___.');
  });
});

describe('what a pick changes', () => {
  it('picks a new value of a one-value kind after rejecting the confirmed one', () => {
    const erp = claim('offering', 'ERP');
    const old = claim('size', '2-50');
    expect(planPick([erp, old], 'size', '5-100')).toEqual({ reject: [old], pick: '5-100' });
    expect(planPick([erp, old], 'offering', 'CRM')).toEqual({ reject: [erp], pick: 'CRM' });
  });

  it('changes nothing when the value is already confirmed, whatever its case', () => {
    expect(planPick([claim('offering', 'ERP')], 'offering', 'erp')).toEqual({ reject: [], pick: null });
  });

  it('adds a region or a rival beside the others', () => {
    const be = claim('region', 'Belgium');
    expect(planPick([be], 'region', 'France')).toEqual({ reject: [], pick: 'France' });
    expect(planPick([], 'rival', '  Acme Build ')).toEqual({ reject: [], pick: 'Acme Build' });
  });

  it('taps a picked chip off by rejecting it, and an unpicked one on', () => {
    const be = claim('region', 'Belgium');
    expect(planTap([be], 'region', 'Belgium')).toEqual({ reject: [be], pick: null });
    expect(planTap([be], 'region', 'France')).toEqual({ reject: [], pick: 'France' });
    const erp = claim('offering', 'ERP');
    expect(planTap([erp], 'offering', 'CRM')).toEqual({ reject: [erp], pick: 'CRM' });
  });

  it('confirms a row of a one-value kind after rejecting the confirmed one, and a rival beside the others', () => {
    const erp = claim('offering', 'ERP');
    const crm = claim('offering', 'CRM', { state: 'rejected' });
    expect(planConfirm([erp, crm], crm)).toEqual([erp]);
    const rival = claim('rival', 'Acme Build', { state: 'rejected' });
    expect(planConfirm([claim('rival', 'Other Co'), rival], rival)).toEqual([]);
  });
});

describe('the size slider', () => {
  it('reads a stored size as two stops, and nothing else', () => {
    expect(sizeStops('2-50')).toEqual([1, 5]);
    expect(sizeStops('500-1000+')).toEqual([8, 9]);
    expect(sizeStops('50-2')).toBeNull();
    expect(sizeStops('3-50')).toBeNull();
  });

  it('rests on the confirmed size, else on 2–50, unpicked', () => {
    expect(sizeOf([claim('size', '10-100')])).toEqual({ stops: [3, 6], picked: true });
    expect(sizeOf([claim('size', '10-100', { state: 'rejected' })])).toEqual({ stops: [1, 5], picked: false });
  });
});

describe('the page\'s state', () => {
  it('keeps a saved claim\'s citations, and adds a new one', () => {
    const cited = claim('offering', 'ERP', { cited: 3, lastBy: 'think-big' });
    let s = businessReducer(initialState([cited]), { type: 'busy' });
    s = businessReducer(s, { type: 'saved', claim: { ...cited, state: 'rejected', cited: 0, lastBy: null } });
    const fresh = claim('offering', 'CRM');
    s = businessReducer(s, { type: 'saved', claim: fresh });
    s = businessReducer(s, { type: 'done' });
    expect(s.claims).toEqual([{ ...cited, state: 'rejected' }, fresh]);
    expect(s.busy).toBe(false);
  });

  it('shows a refusal, and lets the slider go back to the stored size', () => {
    let s = businessReducer(initialState([]), { type: 'size-draft', stops: [6, 2] });
    expect(s.sizeDraft).toEqual([2, 6]);
    s = businessReducer(businessReducer(s, { type: 'busy' }), { type: 'refused', message: 'no' });
    expect(s).toMatchObject({ busy: false, refusal: 'no', sizeDraft: null });
  });

  it('folds the picks away on Skip, storing nothing, and opens them again', () => {
    const s = businessReducer(businessReducer(initialState([]), { type: 'type', kind: 'rival' }), { type: 'skip' });
    expect(s).toMatchObject({ skipped: true, typing: null, claims: [] });
    expect(businessReducer(s, { type: 'unskip' }).skipped).toBe(false);
  });
});
