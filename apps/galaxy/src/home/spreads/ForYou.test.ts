import { describe, expect, it } from 'vitest';
import { ForYou } from './ForYou';
import { heading, html } from './render';

describe('What\'s in it for you?', () => {
  it('opens on its own h2', () => {
    expect(heading(html(ForYou()))).toBe('What\'s in it for you?');
  });
});
