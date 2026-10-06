import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SignInCard } from './SignInCard';

const SUPABASE = { url: 'http://127.0.0.1:54321', key: 'anon' };

describe('the ask page\'s sign-in card (PRD 359)', () => {
  it('offers only GitHub', () => {
    const html = renderToStaticMarkup(createElement(SignInCard, { supabase: SUPABASE, returnPath: '/ask/callback' }));
    expect(html).toContain('>Sign in with GitHub</button>');
    expect(html).not.toMatch(/google/i);
  });

  it('starts the sign-in through githubSignIn, which asks for read:org', () => {
    const source = readFileSync(new URL('./SignInCard.tsx', import.meta.url), 'utf8');
    const shared = readFileSync(new URL('./GithubSignInCard.tsx', import.meta.url), 'utf8');
    expect(source).toContain('<GithubSignInCard');
    expect(shared).toContain('startGithubSignIn(supabase,');
    expect(source + shared).not.toMatch(/google|\bhd\b/i);
  });
});
