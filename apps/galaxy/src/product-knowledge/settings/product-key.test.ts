import { describe, expect, it } from 'vitest';
import { keyCardFrom, keyShapeOk, refusalLine, SHAPE_RULE, suggestKey } from './product-key';

// The Product key card's rules (PRD 2784 s1): the suggestion from a name, the shape check that mirrors
// products_key_shape, and the card's five states. Fictional products only.

describe('suggestKey', () => {
  it('makes kebab-case from the name', () => {
    expect(suggestKey('Acme Insight')).toBe('acme-insight');
  });

  it('drops the leading digits of each part and the parts left empty', () => {
    expect(suggestKey('Field App 2')).toBe('field-app');
    expect(suggestKey('2fast 3furious')).toBe('fast-furious');
  });

  it('drops accents and runs of other characters', () => {
    expect(suggestKey('Café  Étoilé!! Pro')).toBe('cafe-etoile-pro');
  });

  it('cuts at 40 characters on a part boundary', () => {
    const key = suggestKey('alpha bravo charlie delta echo foxtrot golf hotel');
    expect(key).toBe('alpha-bravo-charlie-delta-echo-foxtrot');
    expect(key.length).toBeLessThanOrEqual(40);
    expect(suggestKey(`${'x'.repeat(40)} yy`)).toBe('x'.repeat(40));
    expect(suggestKey('x'.repeat(50))).toBe('x'.repeat(40));
  });

  it('gives an empty field when nothing is left', () => {
    expect(suggestKey('')).toBe('');
    expect(suggestKey('2024 !!!')).toBe('');
  });
});

describe('keyShapeOk', () => {
  it('accepts what products_key_shape accepts', () => {
    for (const key of ['mobile', 'field-app', 'a1-b2-c3', 'x'.repeat(40)]) expect(keyShapeOk(key)).toBe(true);
  });

  it('refuses what products_key_shape refuses', () => {
    for (const key of ['', 'Mobile', '1mobile', 'field--app', '-app', 'app-', 'field_app', 'a-1', 'x'.repeat(41), 'field app']) {
      expect(keyShapeOk(key)).toBe(false);
    }
  });
});

describe('keyCardFrom', () => {
  const base = { key: null, owner: true, archived: false };

  it('an owner with no key gets the field, then the confirm step', () => {
    expect(keyCardFrom(base, false)).toEqual({ kind: 'owner-field' });
    expect(keyCardFrom(base, true)).toEqual({ kind: 'owner-confirm' });
  });

  it('another member with no key only reads', () => {
    expect(keyCardFrom({ ...base, owner: false }, false)).toEqual({ kind: 'member' });
    expect(keyCardFrom({ ...base, owner: false }, true)).toEqual({ kind: 'member' });
  });

  it('an archived product with no key offers nothing', () => {
    expect(keyCardFrom({ ...base, archived: true }, false)).toEqual({ kind: 'archived' });
  });

  it('a key set is shown to everyone', () => {
    expect(keyCardFrom({ key: 'acme', owner: false, archived: true }, true)).toEqual({ kind: 'set', key: 'acme' });
  });
});

describe('refusalLine', () => {
  it('maps each refusal to one short line', () => {
    expect(refusalLine('taken', 'acme')).toBe('Another product has acme.');
    expect(refusalLine('shape', 'acme')).toBe(SHAPE_RULE);
    expect(refusalLine('refused', 'acme')).toBe('Only an owner sets it.');
  });
});
