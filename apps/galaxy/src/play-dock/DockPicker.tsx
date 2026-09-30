'use client';
// The dock's picker (PRD 817): the games this player may play, one line each, the cursor on the one
// chosen last. Up and down choose, A plays, B folds the dock. A click on a line plays it.
import { Hint } from '../arcade/hint';
import { DOCK_TITLE, type DockGameId } from './dock';

export function DockPicker({ games, sel, onPick }: {
  games: readonly DockGameId[];
  sel: number;
  /** A click on a line: play that game. */
  onPick: (game: DockGameId) => void;
}) {
  return (
    <div className="pd-picker">
      <p className="pd-pick-title">PICK A GAME</p>
      <ul className="pd-pick-list">
        {games.map((g, i) => (
          <li key={g}>
            <button type="button" className="pd-pick" aria-current={i === sel} onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(g)}>
              {i === sel ? '▶ ' : '  '}{DOCK_TITLE[g]}
            </button>
          </li>
        ))}
      </ul>
      <p className="hint pd-pick-hint"><Hint k="A">PLAY</Hint> <Hint k="B">FOLD</Hint></p>
    </div>
  );
}
