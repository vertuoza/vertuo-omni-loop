import { describe, expect, it } from 'vitest';
import { DOTTED_ICON, iconHref } from './icon';

// The browser tab's icon (PRD 499, s3): the crest with a red dot while something waits, the plain crest
// at 0.

describe('the tab icon', () => {
  it('is the dotted crest, an inline SVG data URL, above 0', () => {
    expect(iconHref(1, '/icon?abc')).toBe(DOTTED_ICON);
    expect(iconHref(12, '/icon?abc')).toBe(DOTTED_ICON);
    expect(DOTTED_ICON).toMatch(/^data:image\/svg\+xml,/);
    const svg = decodeURIComponent(DOTTED_ICON.slice('data:image/svg+xml,'.length));
    expect(svg).toMatch(/^<svg[^>]*viewBox="0 0 16 16"/);
    expect(svg).toMatch(/<path fill="#[0-9a-f]{6}" d="M12 0h3v1h-3z[^"]*"\/><\/svg>$/);
  });

  it('is the crest\'s own URL at 0', () => {
    expect(iconHref(0, '/icon?abc')).toBe('/icon?abc');
  });
});
