import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import SignupLayout, { metadata, viewport } from '../../app/signup/layout';

// /signup in the doorway (PRD 1705): the frame the two terminal sign-ins have, the crest above the
// card, and no part of the app. Its title and the browser bar's colour stay as they were.

describe('/signup\'s layout (PRD 1705)', () => {
  const html = renderToStaticMarkup(SignupLayout({ children: createElement('section', { className: 'ask-card' }, 'the card') }));

  it('renders the doorway around the card', () => {
    expect(html).toContain('<div class="ask doorway">');
    expect(html).toContain('<a class="doorway-mark" href="/">');
    expect(html).toMatch(/<div class="doorway-card"><section class="ask-card">the card<\/section><\/div>/);
  });

  it('draws no part of the app, and reads no session', () => {
    expect(html).not.toMatch(/app-shell|<nav\b|<header\b|Game mode/);
    expect(readFileSync(new URL('../../app/signup/layout.tsx', import.meta.url), 'utf8')).not.toMatch(/AppShell|viewer|supabase/);
  });

  it('keeps its title and Omni\'s ground in the browser\'s bar', () => {
    expect(metadata.title).toBe('Sign up · OMNI LOOP');
    expect(viewport.themeColor).toBe('#07061c');
  });
});
