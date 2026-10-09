import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ConceptFacts } from '../dossier/github/fix';
import { UNREAD } from '../dossier/github/summary';
import { conceptPull, conceptState, CONCEPT_STATE_LABELS, type ConceptState } from './state';
import { ConceptStateChip } from './state-chip';
import { parsePr } from 'vertuo-omni-plan/kit/lib/ids.ts';

// A concept's state (PRD 1272, s4), from its stored facts: in review while its concept PR is open, in the
// inbox once it merged, state unknown when the pull request could not be read, or none was found.

const URL = 'https://github.com/acme/widgets/pull/1270';
const pull = (state: 'open' | 'merged') => ({ number: parsePr(1270), url: URL, state, mergedAt: state === 'merged' ? '2026-10-07T09:00:00Z' : null, mergedBy: null });
const facts = (p: ConceptFacts['pull']): ConceptFacts => ({ issue: UNREAD, pull: p });
const chip = (state: ConceptState) => renderToStaticMarkup(createElement(ConceptStateChip, { state }));

describe('a concept\'s state', () => {
  it('is in review while its PR is open, and in the inbox once it merged', () => {
    expect(conceptState(facts(pull('open')))).toBe('in-review');
    expect(conceptState(facts(pull('merged')))).toBe('in-inbox');
  });

  it('is unknown with no facts, a pull request that could not be read, or none found', () => {
    expect(conceptState(null)).toBe('unknown');
    expect(conceptState(facts(UNREAD))).toBe('unknown');
    expect(conceptState(facts(null))).toBe('unknown');
  });

  it('names the concept PR only when it was read', () => {
    expect(conceptPull(facts(pull('open')))).toEqual({ number: 1270, url: URL });
    expect(conceptPull(facts(UNREAD))).toBeNull();
    expect(conceptPull(null)).toBeNull();
  });

  it('draws each state as its chip, in words', () => {
    expect(CONCEPT_STATE_LABELS).toEqual({ 'in-review': 'in review', 'in-inbox': 'in the inbox', unknown: 'state unknown' });
    expect(chip('in-review')).toBe('<span class="fix-state fix-state-in-review">in review</span>');
    expect(chip('in-inbox')).toBe('<span class="fix-state fix-state-merged">in the inbox</span>');
    expect(chip('unknown')).toBe('<span class="fix-state fix-state-unknown">state unknown</span>');
  });
});
