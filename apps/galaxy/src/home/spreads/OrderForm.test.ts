import { describe, expect, it } from 'vitest';
import { OrderForm } from './OrderForm';
import { heading, html, text } from './render';

describe('the order form', () => {
  const markup = html(OrderForm());

  it('opens on Join the loop!, then the call to sign up', () => {
    expect(heading(markup)).toBe('Join the loop!');
    expect(text(markup)).toMatch(/^Join the loop! To join instantly: sign up with GitHub /);
  });

  it('keeps the sign-up, now enabled (PRD 359), PRESS START to /play, the fine print and the Konami tip', () => {
    expect(markup).toMatch(/<button [^>]*data-sign-up=""[^>]*>[\s\S]*?SIGN UP WITH GITHUB/);
    expect(markup).not.toMatch(/disabled|COMING SOON/);
    expect(markup).toMatch(/<a [^>]*href="\/play"[^>]*>PRESS START<\/a>/);
    expect(text(markup)).toContain('Omni Loop runs on Claude Code. Invite-only while in beta.');
    expect(text(markup)).toContain('↑ ↑ ↓ ↓ ← → ← → B A FLASHES CHEAT ACTIVATED! AND DROPS YOU IN THE GAME.');
  });

  it('offers GETTING STARTED, a plain link to /docs beside PRESS START, in its button style', () => {
    const start = /<a class="home-start" href="\/docs">GETTING STARTED<\/a>/;
    expect(markup).toMatch(start);
    const row = markup.match(/<div class="home-order-row">([\s\S]*?)<\/div>/)?.[1] ?? '';
    expect(row).toMatch(/PRESS START<\/a><a [^>]*>GETTING STARTED<\/a>$/);
    expect(row.match(start)?.[0]).not.toContain('data-press-start');
  });
});
