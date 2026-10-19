import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ConceptFacts, FixIssue } from '../dossier/github/fix';
import { UNREAD } from '../dossier/github/summary';
import type { StoredStage } from '../stages/stage';
import { prdKey } from '../stages/store';
import { conceptPull, conceptState, shippedByPerson, CONCEPT_STATE_LABELS, type ConceptProgress, type ConceptState } from './state';
import { ConceptStateChip } from './state-chip';
import { parseIssue, parsePr, parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';

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

  describe('shipped by itself (PRD 2213)', () => {
    const progress = (prds: (number | null)[], stages: Record<number, StoredStage>): ConceptProgress => ({
      repo: 'acme/widgets',
      areas: prds.map((prd) => ({ prd: prd === null ? null : parsePrd(prd) })),
      stages: new Map(Object.entries(stages).map(([prd, stage]) => [prdKey({ repository: 'acme/widgets', prd: parsePrd(Number(prd)) }), stage])),
    });

    it('is shipped once merged, every area names a PRD and each one is shipped or retro', () => {
      expect(conceptState(facts(pull('merged')), progress([1, 2], { 1: 'shipped', 2: 'retro' }))).toBe('shipped');
    });

    it('stays in the inbox while an area names no PRD, a PRD is at another stage, or none is stored', () => {
      expect(conceptState(facts(pull('merged')), progress([1, null], { 1: 'shipped' }))).toBe('in-inbox');
      expect(conceptState(facts(pull('merged')), progress([1, 2], { 1: 'shipped', 2: 'outbox' }))).toBe('in-inbox');
      expect(conceptState(facts(pull('merged')), progress([1, 2], { 1: 'shipped' }))).toBe('in-inbox');
      expect(conceptState(facts(pull('merged')), progress([], {}))).toBe('in-inbox');
      expect(conceptState(facts(pull('merged')), null)).toBe('in-inbox');
    });

    it('never ships a concept in review, nor one whose pull request is unknown (BR-PRODUCT-93)', () => {
      const done = progress([1], { 1: 'shipped' });
      expect(conceptState(facts(pull('open')), done)).toBe('in-review');
      expect(conceptState(facts(UNREAD), done)).toBe('unknown');
      expect(conceptState(null, done)).toBe('unknown');
    });
  });

  describe('shipped by a person (PRD 2213, s3)', () => {
    const issue = (state: 'open' | 'closed'): FixIssue => ({ number: parseIssue(1269), url: 'u', state, author: null, createdAt: '2026-10-01T09:00:00Z', risk: null, regression: false });
    const withIssue = (p: ConceptFacts['pull'], state: 'open' | 'closed'): ConceptFacts => ({ issue: issue(state), pull: p });
    const areas: ConceptProgress = { repo: 'acme/widgets', areas: [{ prd: parsePrd(1) }, { prd: null }], stages: new Map() };

    it('is shipped once merged and the issue is closed, whatever the areas', () => {
      expect(conceptState(withIssue(pull('merged'), 'closed'))).toBe('shipped');
      expect(conceptState(withIssue(pull('merged'), 'closed'), areas)).toBe('shipped');
      expect(shippedByPerson(withIssue(pull('merged'), 'closed'), areas)).toBe(true);
    });

    it('is in the inbox again once the issue is reopened, or when it could not be read', () => {
      expect(conceptState(withIssue(pull('merged'), 'open'), areas)).toBe('in-inbox');
      expect(conceptState({ issue: UNREAD, pull: pull('merged') }, areas)).toBe('in-inbox');
      expect(conceptState({ issue: null, pull: pull('merged') }, areas)).toBe('in-inbox');
      expect(shippedByPerson(withIssue(pull('merged'), 'open'), areas)).toBe(false);
    });

    it('never ships a concept in review, whatever its issue, and unknown stays unknown (BR-PRODUCT-93)', () => {
      expect(conceptState(withIssue(pull('open'), 'closed'))).toBe('in-review');
      expect(conceptState(withIssue(UNREAD, 'closed'))).toBe('unknown');
      expect(conceptState(withIssue(null, 'closed'))).toBe('unknown');
      expect(shippedByPerson(withIssue(pull('open'), 'closed'))).toBe(false);
    });

    it('is shipped by itself, not by a person, when every area shipped as well', () => {
      const done: ConceptProgress = { repo: 'acme/widgets', areas: [{ prd: parsePrd(1) }], stages: new Map([[prdKey({ repository: 'acme/widgets', prd: parsePrd(1) }), 'shipped']]) };
      expect(conceptState(withIssue(pull('merged'), 'closed'), done)).toBe('shipped');
      expect(shippedByPerson(withIssue(pull('merged'), 'closed'), done)).toBe(false);
    });
  });

  it('names the concept PR only when it was read', () => {
    expect(conceptPull(facts(pull('open')))).toEqual({ number: 1270, url: URL });
    expect(conceptPull(facts(UNREAD))).toBeNull();
    expect(conceptPull(null)).toBeNull();
  });

  it('draws each state as its chip, in words', () => {
    expect(CONCEPT_STATE_LABELS).toEqual({ 'in-review': 'in review', 'in-inbox': 'in the inbox', shipped: 'shipped', unknown: 'state unknown' });
    expect(chip('in-review')).toBe('<span class="fix-state fix-state-in-review">in review</span>');
    expect(chip('in-inbox')).toBe('<span class="fix-state fix-state-merged">in the inbox</span>');
    expect(chip('shipped')).toBe('<span class="fix-state fix-state-shipped">shipped</span>');
    expect(chip('unknown')).toBe('<span class="fix-state fix-state-unknown">state unknown</span>');
  });
});
