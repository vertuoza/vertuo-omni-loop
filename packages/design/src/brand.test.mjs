import { describe, expect, it } from 'vitest';
import { OMNI_LOOP } from './brand.mjs';
import { LOGO_DRAWINGS, LOGO_FORMS } from './logo.mjs';
import { INK } from './palette.mjs';

describe('OMNI_LOOP, the product brand', () => {
  it('names the product, its tagline, its logo, its icon and its theme colour', () => {
    expect(OMNI_LOOP.name).toBe('Omni Loop');
    expect(OMNI_LOOP.tagline).toMatch(/\S/);
    expect(LOGO_FORMS).toContain(OMNI_LOOP.logo);
    expect(LOGO_DRAWINGS).toContain(OMNI_LOOP.icon);
    expect(OMNI_LOOP.icon).toBe('favicon');
    expect(Object.values(INK)).toContain(OMNI_LOOP.themeColor);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(OMNI_LOOP)).toBe(true);
  });
});
