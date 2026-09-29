import { heroLook, spritePixels, validHero } from '@omni/design';
import { pixelSvg } from '../design/pixel-svg';

// A person's face (PRD 652), decided once and carried as data, so a chip only draws it, even in a
// client component. In this order: their arcade hero when their player row holds a valid one, drawn as
// the hero block on /app draws it (heroLook → spritePixels → pixelSvg), tinted in their fleet's colour
// (none when that is not a hex colour); else their GitHub photo, the roster's avatar or else the
// login's public photo; else the name's initial. The picture is decorative: the name is always
// written beside it, so the SVG carries no title and no name.

export type Face =
  | { kind: 'hero'; svg: string }
  | { kind: 'photo'; url: string }
  | { kind: 'initial'; letter: string };

/** What a face is decided from: a roster row, or only what a screen knows. */
export interface FaceInput {
  name: string;
  login?: string | null;
  avatarUrl?: string | null;
  /** The player row's stored hero, unchecked. */
  hero?: unknown;
  /** Their fleet's colour. */
  color?: string | null;
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** An SVG string with its title and accessible name taken out: its wrapper hides it. */
export function decorative(svg: string): string {
  return svg.replace(/ role="img" aria-label="[^"]*"/, '').replace(/<title>[^<]*<\/title>/, '');
}

/** The login's public GitHub photo: no API call, no token, and a login outside the workspace still has one. */
export const githubPhoto = (login: string) => `https://github.com/${encodeURIComponent(login)}.png?size=48`;

export function faceOf({ name, login, avatarUrl, hero, color }: FaceInput): Face {
  if (validHero(hero)) {
    const look = heroLook(hero, color && HEX.test(color) ? color : undefined);
    return { kind: 'hero', svg: decorative(pixelSvg(spritePixels(look.sprite, { tint: look.tint }), { scale: 1, title: '' })) };
  }
  if (avatarUrl) return { kind: 'photo', url: avatarUrl };
  if (login) return { kind: 'photo', url: githubPhoto(login) };
  return { kind: 'initial', letter: Array.from(name.trim())[0]?.toUpperCase() ?? '?' };
}
