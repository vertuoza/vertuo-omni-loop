import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SignedIn } from './SignedIn';
import type { SignedInView } from './signed-in';

// The signed-in pill (PRD 1006, s1): the visitor's face beside CONTINUE YOUR GAME, a plain link to
// /play, drawn by Controls into each sign-up slot in place of SIGN UP WITH GITHUB.

const draw = (view: SignedInView) => renderToStaticMarkup(createElement(SignedIn, { view }));

describe('the signed-in pill', () => {
  it('is a link to /play named for screen readers', () => {
    const html = draw({ name: 'Ada Lovelace', face: { kind: 'initial', letter: 'A' } });
    expect(html).toMatch(/^<a [^>]*href="\/play"/);
    expect(html).toContain('aria-label="Continue your game as Ada Lovelace"');
  });

  it('says CONTINUE YOUR GAME', () => {
    const html = draw({ name: 'Ada', face: { kind: 'initial', letter: 'A' } });
    expect(html.replace(/<[^>]+>/g, ' ')).toMatch(/CONTINUE YOUR GAME/);
  });

  it('draws the GitHub photo, decorative', () => {
    const html = draw({ name: 'Ada', face: { kind: 'photo', url: 'https://a.example/ada.png' } });
    expect(html).toMatch(/<img [^>]*src="https:\/\/a.example\/ada.png"/);
    expect(html).toMatch(/<img [^>]*alt=""/);
  });

  it('draws the initial when there is no photo', () => {
    const html = draw({ name: 'Ada', face: { kind: 'initial', letter: 'A' } });
    expect(html).toMatch(/<span class="home-signed-in-face"[^>]*aria-hidden="true"[^>]*>A<\/span>/);
    expect(html).not.toContain('<img');
  });

  it('draws a hero as its SVG, when the decision gives one', () => {
    const html = draw({ name: 'Ada', face: { kind: 'hero', svg: '<svg data-hero=""></svg>' } });
    expect(html).toContain('<svg data-hero=""></svg>');
  });
});

describe('a sign-up slot holding the pill', () => {
  const css = readFileSync(new URL('./home.css', import.meta.url), 'utf8');

  it('hides its SIGN UP WITH GITHUB button and the line under it', () => {
    expect(css).toMatch(/\.home-signup-slot:has\(\.home-signed-in\) \.home-signup,\s*\.home-signup-slot:has\(\.home-signed-in\) \.home-signup-hint \{ display: none; \}/);
  });
});
