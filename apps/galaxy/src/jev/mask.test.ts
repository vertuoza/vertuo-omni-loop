import { describe, expect, it } from 'vitest';
import { maskSecrets as kitMask } from 'vertuo-omni-plan/kit/lib/openrouter.mjs';
import { MASK, maskSecrets, maskState } from './mask';

// The mask (PRD 812 s1, decision 10): every token-shaped string is masked before anything reaches Jev,
// by the kit's own rules (kit/lib/openrouter.mjs › maskSecrets), ported here.

const SECRETS = [
  'ghp_abcdefghijklmnopqrstuvwxyz0123456789',
  'ghs_ABCDEFGHIJKLMNOPQRSTUVWX0123456789ab',
  'github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz',
  'sk-or-v1-0123456789abcdef0123456789abcdef',
  'sk-ant-api03-abcdefghijklmnopqrstuvwxyz',
  'AKIAIOSFODNN7EXAMPLE',
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
];

describe('maskSecrets', () => {
  it('masks each of the kit\'s secret shapes, and a bearer credential', () => {
    const text = `curl -H "Authorization: Bearer abc.def-ghi" ${SECRETS.join(' ')}`;
    const masked = maskSecrets(text);
    for (const secret of [...SECRETS, 'abc.def-ghi']) expect(masked).not.toContain(secret);
    expect(masked).toContain(`Bearer ${MASK}`);
  });

  it('masks exactly as the kit does', () => {
    const text = `a ${SECRETS.join(' b ')} and Bearer x.y, a task-list and sk-short`;
    expect(maskSecrets(text)).toBe(kitMask(text));
    expect(MASK).toBe('[masked]');
  });

  it('leaves ordinary words alone', () => {
    expect(maskSecrets('a task-list and sk-short stay')).toBe('a task-list and sk-short stay');
  });

  it('changes nothing when masking twice', () => {
    const once = maskSecrets(`Bearer x.y ${SECRETS.join(' ')}`);
    expect(maskSecrets(once)).toBe(once);
    expect(maskSecrets(`Bearer x.y ${SECRETS[0]}`)).toBe(`Bearer ${MASK} ${MASK}`);
  });

  it('reads nothing as the empty text', () => {
    expect(maskSecrets(undefined)).toBe('');
    expect(maskSecrets(null)).toBe('');
  });
});

describe('maskState', () => {
  it('masks every string inside a state, keys and shape kept', () => {
    const state = { title: `fix ${SECRETS[0]}`, paths: ['a.ts', `b ${SECRETS[3]}`], n: 3, nested: { ok: true, body: 'Bearer tok.en' } };
    expect(maskState(state)).toEqual({ title: `fix ${MASK}`, paths: ['a.ts', `b ${MASK}`], n: 3, nested: { ok: true, body: `Bearer ${MASK}` } });
    expect(maskState(maskState(state))).toEqual(maskState(state));
  });
});
