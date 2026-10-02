import { decorative } from '../../people/face';
import { pixelSvg } from '../../design/pixel-svg';
import { at } from 'vertuo-omni-plan/kit/lib/narrow.ts';

// The pixel medal of the fleet ranking's top three (issue 958): a disc on a red-and-blue ribbon, its
// rank stamped in it, in gold, silver or bronze; past third place, no medal and the plain rank. Drawn
// on the server as a crisp SVG, hidden from a screen reader, which reads the rank as text beside it.

const RIBBON = [
  'RRR...BBB..',
  '.RRR.BBB...',
  '..RRBBB....',
  '...RBB.....',
  '....OOO....',
];
const DISC = [
  '...OOOOO...',
  '..OLLLLMO..',
  '.OLMMMMMDO.',
  '.OLMMMMMDO.',
  '.OLMMMMMDO.',
  '.OLMMMMMDO.',
  '.OMMMMMMDO.',
  '.OMMMMMMDO.',
  '..ODDDDDO..',
  '...OOOOO...',
];
const DIGITS: Record<number, readonly string[]> = {
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'],
};
const METALS: Record<number, { L: string; M: string; D: string }> = {
  1: { L: '#fff1a8', M: '#f5c518', D: '#b8860b' },
  2: { L: '#ffffff', M: '#d3d7e6', D: '#8e93ab' },
  3: { L: '#f6c79a', M: '#d0844a', D: '#8f5222' },
};
const OUTLINE = '#17153d';

/** The medal of this rank as a decorative pixel SVG, or null past third place. */
export function medalSvg(rank: number): string | null {
  const metal = METALS[rank];
  const digit = DIGITS[rank];
  if (!metal || !digit) return null;
  const palette: Record<string, string> = { O: OUTLINE, R: '#d6334f', B: '#2f6fe0', N: OUTLINE, ...metal };
  const rows = [...RIBBON, ...DISC].map((row) => Array.from(row));
  digit.forEach((line, y) => { Array.from(line).forEach((c, x) => { if (c === '#') at(rows, RIBBON.length + 2 + y, 'the digit\'s row')[4 + x] = 'N'; }); });
  const w = at(rows, 0, "the medal's first row").length;
  const pixels = rows.flatMap((row) => row.map((c) => palette[c] ?? null));
  return decorative(pixelSvg({ w, h: rows.length, pixels }, { scale: 2, title: '' }));
}
