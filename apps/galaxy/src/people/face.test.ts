import { describe, expect, it } from 'vitest';
import { faceOf, githubPhoto } from './face';

// A person's face (PRD 652): their arcade hero, tinted in their fleet's colour, else their GitHub
// photo (the roster's avatar, else the login's public photo), else the name's initial.

const HERO = { v: 1, body: 'girl', skin: 2, hair: 3, suit: 0, cape: 8 };

describe('faceOf', () => {
  it('draws a valid hero as a pixel SVG, tinted in the fleet colour, with no name of its own', () => {
    const face = faceOf({ name: 'ADA', login: 'ada-gh', avatarUrl: 'https://a.test/ada.png', hero: HERO, color: '#3355ff' });
    expect(face.kind).toBe('hero');
    if (face.kind !== 'hero') return;
    expect(face.svg).toMatch(/^<svg [^>]*shape-rendering="crispEdges"/);
    expect(face.svg).not.toMatch(/<title|role="img"|aria-label/);
    const other = faceOf({ name: 'ADA', hero: HERO, color: '#ff3355' });
    expect(other.kind === 'hero' && other.svg).not.toBe(face.svg);
  });

  it('draws the hero untinted when the fleet colour is not a hex colour', () => {
    const plain = faceOf({ name: 'ADA', hero: HERO, color: null });
    const bad = faceOf({ name: 'ADA', hero: HERO, color: 'red;background:url(x)' });
    expect(bad).toEqual(plain);
    expect(bad.kind === 'hero' && bad.svg).not.toContain('url(x)');
  });

  it('with no valid hero, the roster avatar', () => {
    expect(faceOf({ name: 'ADA', login: 'ada-gh', avatarUrl: 'https://a.test/ada.png', hero: { v: 9 } }))
      .toEqual({ kind: 'photo', url: 'https://a.test/ada.png' });
  });

  it('with no avatar but a login, the login\'s public GitHub photo, encoded', () => {
    expect(faceOf({ name: 'Paul', login: 'PaEtienne', avatarUrl: null }))
      .toEqual({ kind: 'photo', url: 'https://github.com/PaEtienne.png?size=48' });
    expect(githubPhoto('a b/c')).toBe('https://github.com/a%20b%2Fc.png?size=48');
  });

  it('with neither, the name\'s first letter', () => {
    expect(faceOf({ name: 'élodie' })).toEqual({ kind: 'initial', letter: 'É' });
    expect(faceOf({ name: '  ' })).toEqual({ kind: 'initial', letter: '?' });
  });
});
