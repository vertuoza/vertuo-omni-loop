// OMNI DUET's lines (issue 1692): one short line of the game's own words for each chapter wave, and a
// few for endless mode, shown in the middle of the playfield as the wave begins (`LINE_SECONDS`) by the
// text layer, then faded out. They speak of turning, balance and keeping on; they are OMNI DUET's own,
// never Duet's. Each is 40 characters at most, so it sits on one line across the playfield.

/** How long a wave's line shows once the wave begins, in seconds: the text layer fades it out over its end. */
export const LINE_SECONDS = 2;

/** One line a wave, chapter by chapter, in the order of the chapters' waves (waves.ts). */
export const CHAPTER_LINES: readonly (readonly string[])[] = Object.freeze([
  Object.freeze([
    'Two lights, one turn.',
    'Hold steady. Let it pass.',
    'Every turn begins with a lean.',
    'Stand tall through the gate.',
    'Small turns, soft hands.',
    'The circle remembers you.',
    'Stand tall, then lie down.',
    'Breathe between the blocks.',
    'Patience is a kind of speed.',
    'The drift ends. You remain.',
  ]),
  Object.freeze([
    'Now things begin to move.',
    'Follow what slides away.',
    'Go with it, not against it.',
    'Left, then right, then left.',
    'Lean into the sweep.',
    'A gate, then the current.',
    'Keep the turn alive.',
    'Back and forth, like breathing.',
    'Short bars, long patience.',
    'Balance is a moving thing.',
  ]),
  Object.freeze([
    'Now the world turns too.',
    'Turn as it turns.',
    'Three spins, one hold.',
    'Change your mind, quickly.',
    'Lie level past the pillar.',
    'Spin against the spin.',
    'Through the gate, into the wheel.',
    'Every turn has a twin.',
    'Hold, let go, hold again.',
    'Dizzy is only a direction.',
  ]),
  Object.freeze([
    'Everything at once.',
    'Calm at the centre.',
    'Read the whole wave.',
    'One more turn than fear.',
    'Rods in a row. Keep turning.',
    'Steady hands in loud weather.',
    'Some shapes fade. Trust them.',
    'Turn with the chain.',
    'See it once, then remember.',
    'The storm thins. Keep on.',
  ]),
]);

/** Endless mode's lines, one a wave in turn, again from the first after the last. */
export const ENDLESS_LINES: readonly string[] = Object.freeze([
  'No end, only the next turn.',
  'Faster now. Stay round.',
  'Keep the two of you apart.',
  'Balance is a habit.',
  'Keep on turning.',
  'The circle never closes.',
  'Still here. Still turning.',
  'One more wave.',
]);

/** The line wave `wave` (from 0) of chapter `chapter` (from 0) begins with, or endless wave `wave`'s. */
export function lineOf({ chapter, wave, endless }: { chapter: number; wave: number; endless: boolean }): string {
  if (endless) return ENDLESS_LINES[wave % ENDLESS_LINES.length] ?? '';
  return CHAPTER_LINES[chapter]?.[wave] ?? '';
}
