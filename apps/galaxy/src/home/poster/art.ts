// The poster's pictures (PRD 261), drawn on the server from @omni/design and the game's own
// renderers, so HOME paints them with no script: the crest, OmniMan pointing, the invaded planet and
// the starfield behind it. Each is an SVG string, crisp at a whole-number scale.
import { drawPlanet, drawStarfield, logoSvg, makeStarfield, OMNI_LOOP, spritePixels } from '@omni/design';
import { pixelSvg, type PixelGrid } from '../../design/pixel-svg';

/** The crest's form on the poster: the full wordmark, where the ad puts its logo. */
export const CREST_FORM = 'full' as const;
/** OmniMan's pose on the poster: pointing across at the crest. */
export const OMNI_POSE = 'omni-point' as const;

/** OmniMan's pose as he flies past the planet (PRD 394): fist up, cape out, the one that reads as
 * flying. Chosen by the PRD's author from the sprites @omni/design draws. */
export const FLYBY_POSE = 'omni-cheer-cape' as const;

/** The planet's radius on its own grid, and the seed of its ground. */
export const PLANET = { r: 28, seed: 7 } as const;
/** How much of the planet is secured in each frame the poster cycles through: the invasion spreading. */
export const PLANET_PROGRESS = [0.25, 0.5, 0.8] as const;

/** The starfield's own grid, and how many stars it holds. */
export const STARS = { seed: 261, w: 320, h: 270, count: 190 } as const;

/** The crest, large: the full form, at 4× (the page scales it to its column). */
export function crestSvg(): string {
  return logoSvg(CREST_FORM, { scale: 4, title: OMNI_LOOP.name });
}

/** OmniMan's `omni-point` pose at poster scale. */
export function omniSvg(): string {
  return pixelSvg(spritePixels(OMNI_POSE, { frame: 0 }), { scale: 4, title: 'OmniMan pointing at the crest' });
}

/** OmniMan flying past: the `omni-cheer-cape` sprite at poster scale. The page tilts him along his
 * path and hides him from a screen reader; the title only names the picture. */
export function flybySvg(): string {
  return pixelSvg(spritePixels(FLYBY_POSE, { frame: 0 }), { scale: 4, title: 'OmniMan flying past the planet' });
}

const hex = (v: number) => v.toString(16).padStart(2, '0');

/**
 * The planet as drawPlanet paints it, as a pixel grid. drawPlanet draws into a canvas it makes
 * itself (an OffscreenCanvas when there is one), then copies it onto the one it is given: on the
 * server there is no canvas, so for the length of the call it is handed one that keeps the pixels.
 */
export function planetPixels(progress: number): PixelGrid {
  const g = globalThis as { OffscreenCanvas?: unknown }; // ts-allow: globalThis is lent an OffscreenCanvas for the call, and given its own back after
  const had = Object.hasOwn(g, 'OffscreenCanvas');
  const before = g.OffscreenCanvas;
  class Keeper {
    image: ImageData | null = null;
    constructor(readonly width: number, readonly height: number) {}
    getContext() {
      return {
        createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: (image: ImageData) => { this.image = image; },
      };
    }
  }
  let drawn: Keeper | null = null;
  g.OffscreenCanvas = Keeper;
  try {
    const onto = { drawImage: (canvas: Keeper) => { drawn = canvas; } };
    drawPlanet(onto as unknown as CanvasRenderingContext2D, { cx: 0, cy: 0, r: PLANET.r, seed: PLANET.seed, progress }); // ts-allow: drawPlanet calls only drawImage, which this stand-in has
  } finally {
    if (had) g.OffscreenCanvas = before; else delete g.OffscreenCanvas;
  }
  const image = (drawn as Keeper | null)?.image; // ts-allow: TypeScript narrows drawn to null, but drawImage sets it during the call
  if (!image) throw new Error('planetPixels: drawPlanet drew nothing');
  const { width: w, height: h, data } = image;
  const pixels: (string | null)[] = [];
  for (let i = 0; i < data.length; i += 4) {
    pixels.push(data[i + 3]! < 128 ? null : `#${hex(data[i]!)}${hex(data[i + 1]!)}${hex(data[i + 2]!)}`);
  }
  return { w, h, pixels };
}

let planets: readonly string[] | null = null;

/** The planet's frames, one per step of PLANET_PROGRESS, drawn once. */
export function planetSvgs(): readonly string[] {
  planets ??= PLANET_PROGRESS.map((p) =>
    pixelSvg(planetPixels(p), { scale: 4, title: `The planet, ${Math.round(p * 100)}% secured` }));
  return planets;
}

let stars: string | null = null;

/** The starfield, as the game draws it standing still: one path per colour, every star a pixel or two. */
export function starfieldSvg(): string {
  if (stars) return stars;
  const { seed, w, h, count } = STARS;
  const paths = new Map<string, string[]>();
  const ctx = {
    fillStyle: '',
    fillRect(x: number, y: number, dw: number, dh: number) {
      const list = paths.get(this.fillStyle) ?? [];
      list.push(`M${x} ${y}h${dw}v${dh}h-${dw}z`);
      paths.set(this.fillStyle, list);
    },
  };
  drawStarfield(ctx as unknown as CanvasRenderingContext2D, makeStarfield(seed, w, h, count), 0, { w, h }); // ts-allow: drawStarfield calls only what this stand-in has
  stars = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" aria-hidden="true">${
    [...paths].map(([fill, d]) => `<path fill="${fill}" d="${d.join('')}"/>`).join('')
  }</svg>`;
  return stars;
}
