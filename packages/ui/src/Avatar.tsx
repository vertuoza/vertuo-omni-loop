import { heroLook, spritePixels } from '@omni/design';
import type { Hero } from '@omni/design';
import './Avatar.css';
import type { AVATAR_SIZES } from './Avatar.meta.ts';

export type AvatarProps = {
  /** The person's hero: the preset numbers the arcade stores. */
  hero: Hero;
  /** The person's name: it is the avatar's text alternative. */
  name: string;
  size?: (typeof AVATAR_SIZES)[number];
};

/** The sprite's bust, head and shoulders: the first rows of the 32 × 48 hero. */
const BUST = 32;
const SCALES = { sm: 1, md: 2, lg: 3 } as const;

/** The path of each colour of the bust: one rectangle per run of pixels of that colour on a row. */
function bustPaths(hero: Hero): Map<string, string> {
  const look = heroLook(hero);
  const { w, pixels } = spritePixels(look.sprite, { tint: look.tint });
  const paths = new Map<string, string>();
  for (let y = 0; y < BUST; y++) {
    let x = 0;
    while (x < w) {
      const colour = pixels[y * w + x];
      if (colour === null || colour === undefined) { x += 1; continue; }
      let end = x + 1;
      while (end < w && pixels[y * w + end] === colour) end += 1;
      paths.set(colour, `${paths.get(colour) ?? ''}M${String(x)} ${String(y)}h${String(end - x)}v1h-${String(end - x)}z`);
      x = end;
    }
  }
  return paths;
}

/** A person's hero sprite, drawn at a whole-number scale so each sprite pixel stays a crisp block. */
export function Avatar({ hero, name, size = 'md' }: AvatarProps) {
  const px = BUST * SCALES[size];
  return (
    <span className={`omni-avatar omni-avatar--${size}`} role="img" aria-label={name}>
      <svg xmlns="http://www.w3.org/2000/svg" width={px} height={px} viewBox={`0 0 ${String(BUST)} ${String(BUST)}`} shapeRendering="crispEdges" aria-hidden="true" focusable="false">
        {[...bustPaths(hero)].map(([colour, d]) => <path key={colour} fill={colour} d={d} />)}
      </svg>
    </span>
  );
}
