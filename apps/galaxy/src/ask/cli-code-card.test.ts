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

  it('says in one short sentence that the terminal gets its own sign-in, for the word pass (PRD 1660)', () => {
    const html = renderToStaticMarkup(createElement(CliSignInCard, { supabase: SUPABASE, returnPath: '/auth/callback?next=ask-cli' }));
    expect(html).toContain('<p class="ask-muted">The terminal gets its own sign-in.</p>');
    expect(html).toContain('Sign the terminal in');
  });

  it('offers GitHub again after a failed try', () => {
    const html = renderToStaticMarkup(createElement(CliSignInCard, { supabase: SUPABASE, returnPath: '/x', error: 'Expired.' }));
    expect(html).toContain('>Try again with GitHub</button>');
  });

  it('names the token it makes, and where it is shown once, for purpose=token (PRD 1628)', () => {
    const card = (toTerminal: boolean) => renderToStaticMarkup(createElement(CliSignInCard, {
      supabase: SUPABASE, returnPath: '/x', purpose: { kind: 'token', name: 'laptop', days: 90, toTerminal },
    }));
    expect(card(true)).toContain('Make a terminal token');
    expect(card(true)).toContain('<strong>laptop</strong>, for 90 days.');
    expect(card(true)).toContain('<code>omni setup-token</code>');
    expect(card(false)).toContain('back on your profile page.');
    expect(card(false)).not.toContain('Sign the terminal in');
    expect(card(false)).toContain('>Sign in with GitHub</button>');
  });

  it('starts the sign-in through githubSignIn, which asks for read:org', () => {
    const source = readFileSync(new URL('./cli-code-card.tsx', import.meta.url), 'utf8');
    const shared = readFileSync(new URL('./page/GithubSignInCard.tsx', import.meta.url), 'utf8');
    expect(source).toContain('useGithubSignIn(');
    expect(shared).toContain('startGithubSignIn(supabase,');
    expect(source + shared).not.toMatch(/google|\bhd\b/i);
  });
});
