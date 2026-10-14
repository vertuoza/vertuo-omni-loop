// What the CIRCUIT step shows of each circuit (PRD 1923): its id, name and board from the register, and its minimap as rows of
// coloured runs of tiles, drawn by the text layer. It is loaded with the game, so the scenes outside arcade/kart/ never import it
// at run time (guard.test.ts).
import { minimapTiles } from './art';
import { isSnow } from './art.snow';
import { CIRCUITS } from './circuits';
import { reliefRange } from './relief';
import { parseTrack } from './track';
import type { CircuitCard } from '../scenes/kart.ts';

/** The ground a minimap sits on: FROST EIGHT's powder, and COMET RING's void. */
const POWDER = '#eef4fa';
const VOID = '#07061c';

/** One card per circuit, in driving-menu order: the tiles of the minimap joined into runs along a row. */
export function circuitCards(): CircuitCard[] {
  return CIRCUITS.map((c) => {
    const track = parseTrack(c.source);
    const tiles = [...minimapTiles(track, reliefRange(track))].sort((a, b) => a.y - b.y || a.x - b.x);
    const runs: CircuitCard['runs'][number][] = [];
    for (const t of tiles) {
      const last = runs[runs.length - 1];
      if (last && last.y === t.y && last.colour === t.colour && last.x + last.w === t.x) runs[runs.length - 1] = { ...last, w: last.w + 1 };
      else runs.push({ x: t.x, y: t.y, w: 1, colour: t.colour });
    }
    return { id: c.id, name: c.name, board: c.board, cols: track.cols, rows: track.rows, ground: isSnow(track) ? POWDER : VOID, runs };
  });
}
