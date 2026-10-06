import { describe, expect, it } from 'vitest';
import { isBot, isOmniSigned, OMNI_LOGIN, SIGNATURE } from './signed.ts';

const TRAILER = `Co-authored-by: ${SIGNATURE.name} <${SIGNATURE.email}>`;

describe('isOmniSigned', () => {
  it('is Omni-man by the e-mail of the trailer on any commit', () => {
    expect(isOmniSigned({ author: 'ana', body: '', commitMessages: ['feat: one', `feat: two\n\n${TRAILER}`] })).toBe(true);
    const renamed = `Co-authored-by: Someone Else <${SIGNATURE.email}>`;
    expect(isOmniSigned({ author: 'ana', body: '', commitMessages: [`fix: x\n\n${renamed}\r`] })).toBe(true);
  });

  it('is Omni-man by the footer marker in the body', () => {
    expect(isOmniSigned({ author: 'ana', body: 'Hello\n\n🦸 Omni-man by Omni Loop © <!-- omni-loop:signed -->', commitMessages: [] })).toBe(true);
  });

  it('is Omni-man when omni-loop-invader[bot] opened it', () => {
    expect(OMNI_LOGIN).toBe('omni-loop-invader[bot]');
    expect(isOmniSigned({ author: 'omni-loop-invader[bot]', body: null, commitMessages: [] })).toBe(true);
  });

  it('is not Omni-man otherwise', () => {
    expect(isOmniSigned({ author: 'ana', body: 'no marker', commitMessages: ['feat: x\n\nCo-authored-by: Bob <bob@example.com>'] })).toBe(false);
    expect(isOmniSigned({ author: 'ana', body: null, commitMessages: [`quoting ${TRAILER} inside a line`] })).toBe(false);
    expect(isOmniSigned({ author: null, body: undefined, commitMessages: undefined })).toBe(false);
  });
});

describe('isBot', () => {
  it('is a login ending in [bot], or GitHub type Bot', () => {
    expect(isBot({ login: 'dependabot[bot]', type: 'User' })).toBe(true);
    expect(isBot({ login: 'renovate', type: 'Bot' })).toBe(true);
    expect(isBot({ login: 'ana', type: 'User' })).toBe(false);
    expect(isBot(null)).toBe(false);
  });
});
