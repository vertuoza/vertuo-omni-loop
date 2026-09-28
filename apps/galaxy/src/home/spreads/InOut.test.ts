import { describe, expect, it } from 'vitest';
import { InOut } from './InOut';
import { heading, html } from './render';

describe('Easy in, easy out', () => {
  it('opens on its own h2', () => {
    expect(heading(html(InOut()))).toBe('Easy in, easy out');
  });
});
