import { describe, expect, it } from 'vitest';
import { CANON_ACTION, canonActions, canonComment, canonMarker, commentMarker, readCanonMarker } from './canon-actions.mjs';

const RED = Object.freeze({
  state: 'red',
  reason: 'canon ✗ 2',
  claimsRead: 3,
  findings: [
    { quote: 'the CFO of a holding', claims: ['never#4', 'size#1'], why: 'a group' },
    { quote: 'six entities', claims: ['never#4'], why: 'a group again' },
  ],
  persona: { name: 'Marc', line: 'Not for my five plumbers.' },
});
const GREEN = Object.freeze({ state: 'green', reason: 'canon ✓ · 3 claims read', claimsRead: 3, findings: [], persona: null });
const NEUTRAL = Object.freeze({ state: 'neutral', reason: 'no business', claimsRead: 0, findings: [], persona: null });
const GALAXY = 'https://galaxy.example';

describe('canonActions — the buttons on a red canon check run', () => {
  it('a red canon check carries Rewrite for <persona> and Change the claim', () => {
    expect(canonActions(RED)).toEqual([
      { label: 'Rewrite for Marc', description: 'Post the command that reworks the spec', identifier: CANON_ACTION.rewrite },
      { label: 'Change the claim', description: 'Open the claim on Settings › Business', identifier: CANON_ACTION.claim },
    ]);
  });

  it.each([['green', GREEN], ['neutral', NEUTRAL], ['absent', null]])('a %s canon check carries none', (_, canon) => {
    expect(canonActions(canon)).toEqual([]);
  });

  it("keeps within GitHub's limits: label 20, description 40, identifier 20 characters", () => {
    const long = { ...RED, persona: { name: 'Maximilian-Alexander', line: 'no' } };
    for (const action of canonActions(long)) {
      expect(action.label.length).toBeLessThanOrEqual(20);
      expect(action.description.length).toBeLessThanOrEqual(40);
      expect(action.identifier.length).toBeLessThanOrEqual(20);
    }
    expect(canonActions(long)[0].label).toBe('Rewrite for Maximili');
  });

  it('without a persona, the first button reads Rewrite the spec', () => {
    expect(canonActions({ ...RED, persona: null })[0].label).toBe('Rewrite the spec');
  });
});

describe('canonMarker / readCanonMarker — the facts a click needs, hidden in the summary', () => {
  it('a red canon writes the PRD, the persona and every cited claim once, in order', () => {
    const marker = canonMarker({ prd: 839, canon: RED });
    expect(marker.startsWith('<!--')).toBe(true);
    expect(readCanonMarker(`PRD 839\n\n${marker}\n- ok`)).toEqual({ prd: 839, persona: 'Marc', claims: ['never#4', 'size#1'] });
  });

  it('a green or neutral canon, or no PRD, writes none', () => {
    expect(canonMarker({ prd: 839, canon: GREEN })).toBeNull();
    expect(canonMarker({ prd: 839, canon: NEUTRAL })).toBeNull();
    expect(canonMarker({ prd: null, canon: RED })).toBeNull();
  });

  it('a summary without a marker, or with a broken one, reads as null', () => {
    expect(readCanonMarker('PRD 1\n- ok — canon: canon ✓')).toBeNull();
    expect(readCanonMarker('<!-- omni-canon {not json} -->')).toBeNull();
    expect(readCanonMarker('<!-- omni-canon {"prd":"x","claims":[]} -->')).toBeNull();
    expect(readCanonMarker(undefined)).toBeNull();
  });
});

describe('canonComment — the one comment each action posts', () => {
  const facts = { prd: 839, persona: 'Marc', claims: ['never#4', 'size#1'] };

  it('Rewrite for <persona> posts the rework command', () => {
    const body = canonComment(CANON_ACTION.rewrite, facts, { galaxyUrl: GALAXY });
    expect(body).toContain(commentMarker(CANON_ACTION.rewrite));
    expect(body).toContain('To rewrite the spec for Marc, run `/omni:brainstorm --rework 839`.');
  });

  it('without a persona, it still names the command', () => {
    const body = canonComment(CANON_ACTION.rewrite, { ...facts, persona: null }, { galaxyUrl: GALAXY });
    expect(body).toContain('To rewrite the spec, run `/omni:brainstorm --rework 839`.');
  });

  it('Change the claim links each cited claim on Settings › Business: a Never line at its #never-<seq>', () => {
    const body = canonComment(CANON_ACTION.claim, facts, { galaxyUrl: `${GALAXY}/` });
    expect(body).toContain(commentMarker(CANON_ACTION.claim));
    expect(body).toContain('[never#4](https://galaxy.example/app/settings/business#never-4)');
    expect(body).toContain('[size#1](https://galaxy.example/app/settings/business)');
  });

  it('the two actions carry different markers, so each edits only its own comment', () => {
    expect(commentMarker(CANON_ACTION.rewrite)).not.toBe(commentMarker(CANON_ACTION.claim));
  });

  it('an unknown action has no comment', () => {
    expect(canonComment('something-else', facts, { galaxyUrl: GALAXY })).toBeNull();
  });
});
