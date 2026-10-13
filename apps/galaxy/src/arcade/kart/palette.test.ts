import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { pack } from './texture';

// The palette guard (bug 1813): a canvas's little-endian pixel holds a colour as 0xAABBGGRR, so a colour written
// 0xffRRGGBB comes out with its red and blue swapped, as the tunnel's pale yellow portal drew cyan. Every colour of
// OMNI KART's engine is written `#rrggbb` and packed by `pack` (texture.ts); a source holding a packed literal fails.

const KART = dirname(fileURLToPath(import.meta.url));
/** An opaque colour written packed: 0xff and six hex digits, but not the alpha mask `pack` builds with. */
const PACKED = /\b0xff(?!000000\b)[0-9a-f]{6}\b/gi;

/** The colours written packed in a source's text. */
function packedLiterals(text: string): string[] {
  return text.match(PACKED) ?? [];
}

describe('the palette guard (bug 1813)', () => {
  it('finds a colour written packed, and leaves the alpha mask alone', () => {
    expect(packedLiterals('portal: 0xfffff0a8, rim: 0xFFFFE29A, mask: 0xff000000, seed: 0x6d2b79f5')).toEqual(['0xfffff0a8', '0xFFFFE29A']);
  });

  it('packs `#rrggbb` as the canvas reads it: red in the low byte, blue in the third', () => {
    expect(pack('#ff0000')).toBe(0xff0000ff);
    expect(pack('#0000ff')).toBe(0xffff0000);
  });

  it('finds no colour written packed in the engine\'s sources: each is `#rrggbb` through `pack`', () => {
    const sources = readdirSync(KART).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    const found = sources.flatMap((f) => packedLiterals(readFileSync(join(KART, f), 'utf8')).map((l) => `${f}: ${l}`));
    expect(sources).toContain('mode7.ts');
    expect(found).toEqual([]);
  });
});
