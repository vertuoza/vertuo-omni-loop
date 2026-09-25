// The Vertuoza mark: split bars that narrow row by row into a V, coral to blue. The deck emblem
// (SVG) and the boot screen (canvas) both draw it from these pixel runs.

export const MARK_SIZE = 36;

// Each row of bars as [x, width] on the 36-pixel grid; rows are 10 pixels apart.
const ROWS = [
  [[0, 22], [24, 12]],
  [[4, 8], [14, 18]],
  [[8, 12], [22, 6]],
  [[12, 12]],
];
// How far each pixel line of a bar is inset at both ends: a 6-pixel-tall pill with stepped round ends.
const CAP = [2, 1, 0, 0, 1, 2];

/** The mark as horizontal pixel runs: [x, y, width, row of bars]. */
export const MARK_RUNS = ROWS.flatMap((bars, row) =>
  bars.flatMap(([x, w]) => CAP.map((c, line) => [x + c, row * 10 + line, w - 2 * c, row] as const)));

/** The left-to-right gradient, as [offset, colour] stops, and its darker shade for shadows. */
export const MARK_STOPS = [[0, '#ff5f6d'], [0.55, '#a45cff'], [1, '#4a63ff']] as const;
export const MARK_SHADE = [[0, '#a8183a'], [0.55, '#6a2fd0'], [1, '#2f3fc4']] as const;
