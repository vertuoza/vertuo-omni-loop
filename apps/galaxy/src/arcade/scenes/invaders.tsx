'use client';
// Entropy Invaders' text layer: the score line (the score, the wave, the lives left as small heroes),
// and the screen over the field when one is up: the ready screen with the score table, the pause,
// the game over with its score. Laid out for the grid the game is drawn on (invaders.css).
import type { WoundKind } from '@omni/galaxy';
import type { Hero } from '@omni/sprites';
import { woundTint } from '@omni/sprites';
import { useScreen } from '../Screen';
import { HeroSprite, Sprite } from '../Sprite';
import { WOUND_LOOK } from '../fleets';
import { Hint } from '../hint';
import { rowKinds, type GameHud } from '../games/invaders';
import './common.css';
import './invaders.css';

/** A score as the cabinet shows it: five digits at least, in groups of three, `01 240`. */
export function scoreText(score: number): string {
  return String(Math.max(0, Math.floor(score))).padStart(5, '0').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** What each alien pays, top row first: the close values the view's rules carry. */
function ScoreTable({ values }: { values: Readonly<Record<WoundKind, number>> }) {
  const { grid } = useScreen();
  return (
    <ul className="inv-table">
      {rowKinds(values).map((kind) => (
        <li key={kind}>
          <Sprite name="entropy" tint={woundTint(kind)} scale={grid.name === 'tall' ? 0.75 : 1} />
          <span className="inv-pts">= {values[kind]} PTS</span>
          <span className="inv-kind" style={{ color: WOUND_LOOK[kind].color }}>{WOUND_LOOK[kind].name}</span>
        </li>
      ))}
    </ul>
  );
}

export function InvadersOverlay({ hud, values, hero, team }: {
  /** What the game shows now; null before a game is set up. */
  hud: GameHud | null;
  /** Each kind's close value: `rules.woundClose`, what each alien pays. */
  values: Readonly<Record<WoundKind, number>>;
  /** The player's hero and fleet: the lives left are drawn as their hero. */
  hero: Hero;
  team: string | null;
}) {
  if (!hud) return null;
  return (
    <div className="inv">
      <p className="inv-stat inv-score"><b>SCORE</b><span>{scoreText(hud.score)}</span></p>
      <p className="inv-stat inv-wave"><b>WAVE</b><span>{hud.wave}</span></p>
      <span className="inv-lives" role="img" aria-label={`${hud.lives} ${hud.lives === 1 ? 'life' : 'lives'} left`}>
        {Array.from({ length: hud.lives }, (_, i) => <HeroSprite key={i} hero={hero} team={team} scale={0.5} />)}
      </span>
      {hud.phase === 'ready' && (
        <div className="j-panel inv-panel inv-ready">
          <p className="inv-title">ENTROPY INVADERS</p>
          <p className="inv-sub">SCORE ADVANCE TABLE</p>
          <ScoreTable values={values} />
          <p className="inv-how">HOLD ◀ ▶ TO FLY · HOLD A TO FIRE</p>
          <p className="hint"><Hint k="A">START</Hint> <Hint k="B">GAME ROOM</Hint></p>
        </div>
      )}
      {hud.phase === 'paused' && (
        <div className="j-panel inv-panel inv-mid">
          <p className="inv-title">PAUSED</p>
          <p className="hint"><Hint k="ENTER">RESUME</Hint> <Hint k="B">GAME ROOM</Hint></p>
        </div>
      )}
      {hud.phase === 'over' && (
        <div className="j-panel inv-panel inv-mid">
          <p className="inv-title">GAME OVER</p>
          <p className="inv-final"><b>SCORE</b><span>{scoreText(hud.score)}</span></p>
          <p className="inv-sub">WAVE {hud.wave}</p>
          <p className="hint"><Hint k="A">GAME ROOM</Hint></p>
        </div>
      )}
      {hud.phase === 'play' && <p className="hint inv-foot"><Hint k="ENTER">PAUSE</Hint></p>}
    </div>
  );
}
