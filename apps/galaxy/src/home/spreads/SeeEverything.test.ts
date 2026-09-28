import { describe, expect, it } from 'vitest';
import { heading, html, text } from './render';
import { SeeEverything } from './SeeEverything';

describe('You see everything', () => {
  it('opens on its own h2, then its line', () => {
    const markup = html(SeeEverything());
    expect(heading(markup)).toBe('You see everything');
    expect(text(markup)).toBe('You see everything Every step leaves something a person can read.');
  });
});
