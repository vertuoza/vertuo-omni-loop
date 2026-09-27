'use client';
// The level-up's text layer: the line over it, LEVEL UP!, the new level beside the hero, the XP bar
// counted from the new level, and, when a level climbed opened a game, NEW GAME UNLOCKED with the
// game's marquee: A plays it at once, B goes on to the menu. Without a game, A (or B) goes on to the
// menu. Laid out for the grid the screen is drawn on (levelup.css), over the hero levelup.ts draws.
import { woundTint } from '@omni/design';
import { useScreen } from '../Screen';
import { Sprite } from '../Sprite';
import { Hint } from '../hint';
import { barFill } from '../games/room';
import { eyebrowOf, xpLineOf, type LevelUp } from '../levelup';
import './common.css';
import './levelup.css';

export function LevelUpOverlay({ levelUp }: { levelUp: LevelUp }) {
  const { grid } = useScreen();
  const { xp, game } = levelUp;
  const fill = barFill(xp);
  const alien = grid.name === 'tall' ? 0.75 : 1;
  return (
    <div className={`lu ${game ? 'lu-game' : 'lu-plain'}`}>
      <p className="lu-eyebrow">{eyebrowOf(levelUp)}</p>
      <h2 className="lu-title">LEVEL UP!</h2>
      <span className="lu-level">LV {xp.level}</span>
      <span className="lu-bar" role="img" aria-label={`${Math.round(fill * 100)}% of the way to the next level`}>
        <i style={{ width: `${Math.round(fill * 100)}%` }} />
      </span>
      <p className="lu-count">{xpLineOf(levelUp)}</p>
      {game ? (
        <div className="lu-unlock" role="status">
          <p className="lu-new">NEW GAME UNLOCKED</p>
          <p className="lu-cabinet">
            <Sprite name="entropy" tint={woundTint('beacon')} scale={alien} />
            <span className="lu-marquee">{game.title}</span>
            <Sprite name="entropy" tint={woundTint('transmission')} scale={alien} flip />
          </p>
          <p className="hint lu-keys"><Hint k="A">PLAY NOW</Hint> <Hint k="B">LATER</Hint></p>
        </div>
      ) : (
        <p className="hint lu-keys"><Hint k="A">CONTINUE</Hint></p>
      )}
    </div>
  );
}
