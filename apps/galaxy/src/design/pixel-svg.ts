// A pixel grid (a sprite frame from @omni/design's spritePixels) as a crisp SVG string: one path per
// colour, each run of one colour along a row a single rectangle, drawn `scale` times its size on the
// grid's own viewBox and never smoothed. The /design page draws every sprite with it, on the server,
// so the page needs no script to show the whole cast. The logo has its own (logoSvg), in the package.

export interface PixelGrid { readonly w: number; readonly h: number; readonly pixels: readonly (string | null)[] }

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function pixelSvg({ w, h, pixels }: PixelGrid, { scale, title }: { scale: number; title: string }): string {
  if (!Number.isInteger(scale) || scale < 1) throw new Error(`pixelSvg: scale must be a whole number of at least 1, not ${scale}`);
  const paths = new Map<string, string[]>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w;) {
      const c = pixels[y * w + x];
      let end = x + 1;
      while (end < w && pixels[y * w + end] === c) end++;
      if (c) {
        let path = paths.get(c);
        if (!path) {
          path = [];
          paths.set(c, path);
        }
        path.push(`M${x} ${y}h${end - x}v1h-${end - x}z`);
      }
      x = end;
    }
  }
  const name = escape(title);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" role="img" aria-label="${name}"><title>${name}</title>${
    [...paths].map(([fill, d]) => `<path fill="${fill}" d="${d.join('')}"/>`).join('')
  }</svg>`;
}
