// @ts-nocheck
// PRD #99, slice s1: the signature's lines, built from the `signature` config section, and the
// three questions `omni phase0` and `omni credits` ask of what GitHub holds. PRD #215, slice s1: the
// footer is a template, its `{name}` and `{home}` filled before the marker; slice s2: the hero is
// Omni-man.
import { describe, expect, it } from 'vitest';
import { parseConfig } from './config.ts';
import { botLogin, carriesTrailer, footerLine, isSignedBody, SIGNED_MARKER, trailerLine } from './signature.ts';

const EMAIL = '333776611+omni-loop-invader[bot]@users.noreply.github.com';
const TRAILER = `Co-authored-by: Omni-man <${EMAIL}>`;
const HOME = 'https://vertuo-omni-loop-galaxy.vercel.app';
const FOOTER = `🦸 Omni-man by [Omni Loop](${HOME}) ©`;
const signature = parseConfig('kit: 1\n').signature;
const custom = { name: 'Robo', email: 'robo@example.com', footer: 'Made by Robo' };

describe('the lines a signature prints', () => {
  it('the trailer names the signature and its address', () => {
    expect(trailerLine(signature)).toBe(TRAILER);
    expect(trailerLine(custom)).toBe('Co-authored-by: Robo <robo@example.com>');
  });

  it('the footer is the footer, then the hidden marker on the same line', () => {
    expect(SIGNED_MARKER).toBe('<!-- omni-loop:signed -->');
    expect(footerLine(signature)).toBe(`${FOOTER} <!-- omni-loop:signed -->`);
    expect(footerLine(custom)).toBe('Made by Robo <!-- omni-loop:signed -->');
  });

  it('fills every {name} and {home} in the footer, wherever they appear', () => {
    const twice = { ...custom, home: 'https://example.com', footer: '{name} and {name}, at {home} or {home}' };
    expect(footerLine(twice)).toBe('Robo and Robo, at https://example.com or https://example.com <!-- omni-loop:signed -->');
    expect(footerLine({ ...twice, footer: '[{home}]({home}) — {name}' })).toBe(
      '[https://example.com](https://example.com) — Robo <!-- omni-loop:signed -->',
    );
  });

  it('prints anything else in the footer as written, an unknown placeholder included', () => {
    const other = { ...custom, home: 'https://example.com', footer: '{x} {Name} {home {name}} { name } {{name}}' };
    expect(footerLine(other)).toBe('{x} {Name} {home Robo} { name } {Robo} <!-- omni-loop:signed -->');
  });

  it('fills each placeholder once: a value holding a placeholder or a $ is printed as it is', () => {
    const tricky = { ...custom, name: '{home} $& $1', home: 'https://example.com/{name}', footer: '{name} | {home}' };
    expect(footerLine(tricky)).toBe('{home} $& $1 | https://example.com/{name} <!-- omni-loop:signed -->');
  });

  it('signing off gives no line at all', () => {
    expect(trailerLine(null)).toBeNull();
    expect(footerLine(null)).toBeNull();
  });
});

describe('whether a body is signed', () => {
  it('is signed when it carries the marker, whatever the footer says', () => {
    expect(isSignedBody(`Part of #99\n\nThe slice.\n\n${footerLine(signature)}\n`)).toBe(true);
    expect(isSignedBody(`Part of #99\n\nAnother wording ${SIGNED_MARKER}`)).toBe(true);
  });

  it('is not signed with the words of the footer alone, or with no body', () => {
    expect(isSignedBody(FOOTER)).toBe(false);
    expect(isSignedBody('<!-- omni-loop:signed')).toBe(false);
    expect(isSignedBody('')).toBe(false);
    expect(isSignedBody(null)).toBe(false);
    expect(isSignedBody(undefined)).toBe(false);
  });
});

describe('whether a commit message carries the trailer', () => {
  const message = (...trailers) => ['docs(phase-0): widgets', '', 'Body.', '', ...trailers, ''].join('\n');

  it('carries it when one line is exactly the trailer, beside other trailers', () => {
    expect(carriesTrailer(message('Co-Authored-By: Claude <noreply@anthropic.com>', TRAILER), signature)).toBe(true);
    expect(carriesTrailer(message(TRAILER).replace(/\n/g, '\r\n'), signature)).toBe(true);
    expect(carriesTrailer(message(`${TRAILER}  `), signature)).toBe(true);
  });

  it('another name or another address is not his', () => {
    expect(carriesTrailer(message(`Co-authored-by: OmniWoman <${EMAIL}>`), signature)).toBe(false);
    expect(carriesTrailer(message('Co-authored-by: Omni-man <omniman@example.com>'), signature)).toBe(false);
    expect(carriesTrailer(message('Co-Authored-By: Claude <noreply@anthropic.com>'), signature)).toBe(false);
  });

  it('the name he signed with before PRD #215, OmniMan, is now another name (its Decision 5)', () => {
    expect(carriesTrailer(message(`Co-authored-by: OmniMan <${EMAIL}>`), signature)).toBe(false);
  });

  it('the trailer inside a longer line is not the trailer', () => {
    expect(carriesTrailer(message(`See: ${TRAILER}`), signature)).toBe(false);
    expect(carriesTrailer(`subject ${TRAILER}`, signature)).toBe(false);
  });

  it('nothing carries it when signing is off, or when there is no message', () => {
    expect(carriesTrailer(message(TRAILER), null)).toBe(false);
    expect(carriesTrailer('', signature)).toBe(false);
    expect(carriesTrailer(null, signature)).toBe(false);
  });
});

describe('the bot login in an address', () => {
  it('is the login between + and @ in a noreply address', () => {
    expect(botLogin(EMAIL)).toBe('omni-loop-invader[bot]');
    expect(botLogin('42+octocat@users.noreply.github.com')).toBe('octocat');
  });

  it('is the login before @ in an older noreply address that has no id', () => {
    expect(botLogin('octocat@users.noreply.github.com')).toBe('octocat');
  });

  it('is null for any address that is not a GitHub noreply one', () => {
    expect(botLogin('robo@example.com')).toBeNull();
    expect(botLogin('noreply@anthropic.com')).toBeNull();
    expect(botLogin('1+x@users.noreply.github.com.evil.example')).toBeNull();
    expect(botLogin('')).toBeNull();
    expect(botLogin(null)).toBeNull();
  });
});
