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
});
