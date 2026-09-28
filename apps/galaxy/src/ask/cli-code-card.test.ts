import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CliSignInCard } from './cli-code-card';

const SUPABASE = { url: 'http://127.0.0.1:54321', key: 'anon' };

describe('the terminal\'s sign-in card, /ask/signin (PRD 359)', () => {
  it('offers only GitHub', () => {
    const html = renderToStaticMarkup(createElement(CliSignInCard, { supabase: SUPABASE, returnPath: '/auth/callback?next=ask-cli' }));
    expect(html).toContain('>Sign in with GitHub</button>');
    expect(html).not.toMatch(/google/i);
  });

  it('offers GitHub again after a failed try', () => {
    const html = renderToStaticMarkup(createElement(CliSignInCard, { supabase: SUPABASE, returnPath: '/x', error: 'Expired.' }));
    expect(html).toContain('>Try again with GitHub</button>');
  });

  it('starts the sign-in through githubSignIn, which asks for read:org', () => {
    const source = readFileSync(new URL('./cli-code-card.tsx', import.meta.url), 'utf8');
    expect(source).toContain('startGithubSignIn(supabase,');
    expect(source).not.toMatch(/google|\bhd\b/i);
  });
});
