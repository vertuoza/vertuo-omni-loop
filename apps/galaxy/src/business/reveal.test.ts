import { describe, expect, it } from 'vitest';
import type { Claim } from './model';
import {
  foundRows, pagesLeft, receiptLabel, revealOf, scanLine, sourcesUsed, thatsUs, thinkText, type DraftView,
} from './reveal';

// The draft on Settings › Business as pure data (PRD 774 s3): which rows "What we found" lists, the
// "We think you sell …" sentence, the Sources used line, the scan, what a receipt chip says, what
// That's us confirms and rejects, and which of the reveal's states the page is in.

const claim = (seq: number, kind: Claim['kind'], value: string, over: Partial<Claim> = {}): Claim =>
  ({ id: `c-${seq}`, seq, kind, value, source: 'pick', state: 'confirmed', cited: 0, lastBy: null, ...over });
const found = (seq: number, kind: Claim['kind'], value: string, over: Partial<Claim> = {}) =>
  claim(seq, kind, value, { source: 'evidence', state: 'proposed', ...over });

const draft = (over: Partial<DraftView> = {}): DraftView =>
  ({ id: 'd-1', kind: 'draft', state: 'done', counts: {}, scanned: [], reason: null, ...over });

describe('what we found', () => {
  it('lists the proposed evidence claims only, in the sentence\'s order', () => {
    const claims = [
      found(4, 'rival', 'Brick & Co'),
      claim(1, 'offering', 'ERP'),
      found(2, 'region', 'France'),
      claim(3, 'rival', 'Guess Co', { source: 'suggestion', state: 'proposed' }),
      found(5, 'offering', 'CRM', { replaces: 'c-1' }),
      found(6, 'region', 'Spain', { state: 'rejected' }),
    ];
    expect(foundRows(claims).map((c) => c.value)).toEqual(['France', 'Brick & Co']);
  });
});

describe('the sentence while nothing is saved', () => {
  it('reads "We think you sell …" with the found values, leaving out those marked ✗', () => {
    const claims = [found(1, 'offering', 'ERP'), found(2, 'size', '2-50'), found(3, 'region', 'Belgium'), found(4, 'rival', 'Acme Build'), found(5, 'rival', 'Brick & Co')];
    expect(thinkText(claims, { 'c-5': 'wrong' })).toBe('We think you sell an ERP to 2–50-person ___ in Belgium, up against Acme Build.');
  });

  it('keeps what is already confirmed', () => {
    expect(thinkText([claim(1, 'trade', 'construction'), found(2, 'region', 'France')], {}))
      .toBe('We think you sell ___ to ___-person construction firms in France, up against ___.');
  });
});

describe('the Sources used line', () => {
  it('counts each kind it read, skipping the ones it read none of', () => {
    expect(sourcesUsed({ readmes: 2, docs: 0, prds: 14, pages: 1 })).toBe('2 READMEs · 14 PRDs · 1 web page');
    expect(sourcesUsed({ readmes: 1, docs: 3, prds: 1, pages: 2 })).toBe('1 README · 3 docs · 1 PRD · 2 web pages');
  });

  it('says so when it read nothing', () => {
    expect(sourcesUsed({})).toBe('nothing');
  });
});

describe('the scan', () => {
  it('marks a source read with ✓ and a skipped one with – and why', () => {
    expect(scanLine({ source: 'vertuo-app · README.md', state: 'read' })).toBe('✓ vertuo-app · README.md');
    expect(scanLine({ source: 'example.com/about', state: 'skipped', why: 'no answer in 10 s' })).toBe('– example.com/about · skipped (no answer in 10 s)');
    expect(scanLine({ source: 'example.com/about', state: 'skipped' })).toBe('– example.com/about · skipped');
  });
});

describe('a receipt chip', () => {
  it('names a repository file without its owner, and a web page without https://', () => {
    expect(receiptLabel({ kind: 'file', where: 'acme/vertuo-app/README.md', quote: 'q', seenAt: '' })).toBe('vertuo-app/README.md');
    expect(receiptLabel({ kind: 'link', where: 'https://example.com/pricing/', quote: 'q', seenAt: '' })).toBe('example.com/pricing');
  });
});

describe('That\'s us', () => {
  it('confirms every found row not marked ✗, and rejects the marked ones', () => {
    const claims = [found(1, 'offering', 'ERP'), found(2, 'region', 'France'), found(3, 'rival', 'Brick & Co'), claim(4, 'trade', 'retail')];
    const { rejected, claims: after } = thatsUs(claims, { 'c-2': 'wrong', 'c-1': 'right' });
    expect(rejected).toEqual(['c-2']);
    expect(after.map((c) => [c.value, c.state])).toEqual([['ERP', 'confirmed'], ['France', 'rejected'], ['Brick & Co', 'confirmed'], ['retail', 'confirmed']]);
  });
});

describe('web pages', () => {
  it('leaves three, less those pasted', () => {
    expect(pagesLeft([])).toBe(3);
    expect(pagesLeft([{ id: 'p1', url: 'https://a.example' }, { id: 'p2', url: 'https://b.example' }, { id: 'p3', url: 'https://c.example' }])).toBe(0);
  });
});

describe('the reveal\'s state', () => {
  const two = [found(1, 'offering', 'ERP'), found(2, 'region', 'Belgium')];

  it('is none before any draft, with nothing found', () => {
    expect(revealOf({ claims: [claim(1, 'offering', 'ERP')], draft: null, watched: false, saved: false })).toEqual({ kind: 'none' });
  });

  it('is the scan while a draft runs', () => {
    expect(revealOf({ claims: [], draft: draft({ state: 'running' }), watched: true, saved: false })).toEqual({ kind: 'scan' });
  });

  it('is the reveal with two or more found rows', () => {
    expect(revealOf({ claims: two, draft: draft(), watched: true, saved: false })).toEqual({ kind: 'reveal', found: 2 });
    expect(revealOf({ claims: two, draft: null, watched: false, saved: false })).toEqual({ kind: 'reveal', found: 2 });
  });

  it('is thin evidence with one', () => {
    expect(revealOf({ claims: two.slice(0, 1), draft: draft(), watched: true, saved: false })).toEqual({ kind: 'thin', found: 1 });
  });

  it('is nothing found after a draft that kept no quote, or ran without the model', () => {
    expect(revealOf({ claims: [], draft: draft({ counts: { kept: 0 } }), watched: true, saved: false })).toEqual({ kind: 'nothing' });
    expect(revealOf({ claims: [], draft: draft(), watched: true, saved: false })).toEqual({ kind: 'nothing' });
  });

  it('is nothing new after a draft whose quotes are all already on the page', () => {
    expect(revealOf({ claims: [claim(1, 'offering', 'ERP')], draft: draft({ counts: { kept: 2, seen: 2 } }), watched: true, saved: false })).toEqual({ kind: 'known' });
  });

  it('is none for an old draft the page did not watch, once its rows are settled', () => {
    expect(revealOf({ claims: [], draft: draft(), watched: false, saved: false })).toEqual({ kind: 'none' });
  });

  it('is saved once That\'s us is pressed', () => {
    expect(revealOf({ claims: [claim(1, 'offering', 'ERP')], draft: draft(), watched: true, saved: true })).toEqual({ kind: 'saved' });
  });

  it('is failed when the draft failed, with why', () => {
    expect(revealOf({ claims: [], draft: draft({ state: 'failed', reason: 'It stopped answering.' }), watched: true, saved: false })).toEqual({ kind: 'failed', reason: 'It stopped answering.' });
  });
});
