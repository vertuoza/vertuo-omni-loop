'use client';
// Entropy Invaders' text layer: the score line (the score, the crew's best, the wave, the lives left
// as small heroes), and the screen over the field when one is up: the ready screen with the score
// table, the pause, the game over with its score and where sending it stands. Laid out for the grid
// the game is drawn on (invaders.css).
import type { WoundKind } from '@omni/galaxy';
import type { Hero } from '@omni/design';
import { woundTint } from '@omni/design';
import { useScreen } from '../Screen';
import { HeroSprite, Sprite } from '../Sprite';
import { WOUND_LOOK } from '../fleets';
import { Hint } from '../hint';
import { rowKinds, type GameHud } from '../games/invaders';
import type { ScoreLine } from '../types';
import { canRetry, sendTone, type ScoreSend } from './invaders-score';
import './common.css';
import './invaders.css';

const grouped = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** A score as the game shows it: five digits at least, in groups of three, `01 240`. */
export function scoreText(score: number): string {
  return grouped(String(Math.max(0, Math.floor(score))).padStart(5, '0'));
}

/** A score as a crew table shows it: its digits in groups of three, `9 210`. */
export function scoreDigits(score: number): string {
  return grouped(String(Math.max(0, Math.floor(score))));
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

/** The game over's line on its score: being saved, NEW BEST or the player's best, or not saved. */
function sendLine(send: ScoreSend | null): string | null {
  if (!send) return null;
  if (send.state === 'sending') return 'SAVING SCORE…';
  if (send.state === 'failed') return 'SCORE NOT SAVED';
  return send.newBest ? 'NEW BEST' : `YOUR BEST ${scoreDigits(send.best)}`;
}

export function InvadersOverlay({ hud, values, hero, team, hi = null, send = null, back = 'GAME ROOM' }: {
  /** What the game shows now; null before a game is set up. */
  hud: GameHud | null;
  /** Each kind's close value: `rules.woundClose`, what each alien pays. */
  values: Readonly<Record<WoundKind, number>>;
  /** The player's hero and fleet: the lives left are drawn as their hero. */
  hero: Hero;
  team: string | null;
  /** The crew's best at the game, shown as HI; none before anyone has a score. */
  hi?: ScoreLine | null;
  /** Where sending the game over's score stands; none before the game is over. */
  send?: ScoreSend | null;
  /** Where B leaves for, as its hint says: the game room in the arcade; the play dock folds (PRD 757). */
  back?: string;
}) {
  const { grid } = useScreen();
  if (!hud) return null;
  const line = sendLine(send);
  // The tall grid's score line has no room for a name beside the wave and the way to pause.
  const hiLabel = hi && (grid.name === 'tall' ? 'HI' : `HI · ${hi.name}`);
  return (
    <div className="inv">
      <p className="inv-stat inv-score"><b>SCORE</b><span>{scoreText(hud.score)}</span></p>
      {hi && <p className="inv-stat inv-hi"><b>{hiLabel}</b><span>{scoreText(hi.best)}</span></p>}
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
          <p className="hint"><Hint k="A">START</Hint> <Hint k="B">{back}</Hint></p>
        </div>
      )}
      {hud.phase === 'paused' && (
        <div className="j-panel inv-panel inv-mid">
          <p className="inv-title">PAUSED</p>
          <p className="hint"><Hint k="ENTER">RESUME</Hint> <Hint k="B">{back}</Hint></p>
        </div>
      )}
      {hud.phase === 'over' && (
        <div className="j-panel inv-panel inv-mid">
          <p className="inv-title">GAME OVER</p>
          <p className="inv-final"><b>SCORE</b><span>{scoreText(hud.score)}</span></p>
          {line && send && <p className={`inv-send inv-${sendTone(send)}`} role="status">{line}</p>}
          <p className="inv-sub">WAVE {hud.wave}</p>
          {canRetry(send)
            ? <p className="hint"><Hint k="A">RETRY</Hint> <Hint k="B">{back}</Hint></p>
            : <p className="hint"><Hint k="A">{back}</Hint></p>}
        </div>
      )}
      {hud.phase === 'play' && <p className="hint inv-foot"><Hint k="ENTER">PAUSE</Hint></p>}
    </div>
  );
}
