'use client';
// The game room's text layer: the heading and the badge, the player's level and XP bar (or why they
// have none), and a cabinet per game, laid out for the grid the screen is drawn on: the three
// cabinets side by side on the wide grid, one a page on the tall one (games.css).
import type { WoundKind } from '@omni/galaxy';
import { woundTint } from '@omni/sprites';
import { useScreen } from '../Screen';
import { HeroSprite, Sprite } from '../Sprite';
import { fleet } from '../fleets';
import { Hint } from '../hint';
import type { Player } from '../types';
import { barFill, cabinets, type Cabinet, type XpStatus, XP_LINE } from '../games/room';
import { badgeOf } from './menu.tsx';
import './common.css';
import './games.css';

/** The player's level and XP bar, or the line that says why they have no level. */
function XpHeader({ xp }: { xp: XpStatus }) {
  if (xp.kind !== 'level') return <p className={`xp-line xp-${xp.kind}`}>{XP_LINE[xp.kind]}</p>;
  const fill = barFill(xp);
  return (
    <div className="xp">
      <span className="xp-level">LV {xp.level}</span>
      <span className="xp-bar" role="img" aria-label={`${Math.round(fill * 100)}% of the way to the next level`}>
        <i style={{ width: `${fill * 100}%` }} />
      </span>
      <span className="xp-count">{xp.next === null ? `${xp.xp} XP` : `${xp.xp} / ${xp.next} XP`}</span>
      <span className="xp-next">{xp.next === null ? 'MAX LEVEL' : `${xp.next - xp.xp} XP to LV ${xp.level + 1}`}</span>
    </div>
  );
}

// The attract on a lit cabinet's screen: three rows of Entropy over the player's hero.
const ROWS: WoundKind[] = ['fault-line', 'unconfirmed-ground', 'under-fire'];

function CabinetView({ cabinet, me, active, onPick }: { cabinet: Cabinet; me: Player | null; active: boolean; onPick: () => void }) {
  const cls = `cabinet${active ? ' active' : ''}`;
  if (cabinet.kind === 'soon') {
    return (
      <button type="button" className={`${cls} dark soon`} onClick={onPick}>
        <span className="marquee">? ? ?</span>
        <span className="cab-screen" aria-hidden="true" />
        <span className="cab-lock"><Sprite name="lock" scale={2} /><span>SOON</span></span>
        <span className="cab-note">Its own PRD sets its level</span>
      </button>
    );
  }
  const { game, unlocked, level } = cabinet;
  if (!unlocked) {
    return (
      <button type="button" className={`${cls} dark locked`} onClick={onPick}>
        <span className="marquee">{game.title}</span>
        <span className="cab-screen" aria-hidden="true" />
        <span className="cab-lock"><Sprite name="lock" scale={2} /><span>{level ? `LV ${level}` : 'LOCKED'}</span></span>
      </button>
    );
  }
  return (
    <button type="button" className={`${cls} lit`} onClick={onPick}>
      <span className="marquee">{game.title}</span>
      <span className="cab-screen" aria-hidden="true">
        {ROWS.map((kind) => (
          <span key={kind} className="cab-row">
            {Array.from({ length: 7 }, (_, i) => <Sprite key={i} name="entropy" scale={0.5} tint={woundTint(kind)} />)}
          </span>
        ))}
        {me && <span className="cab-hero"><HeroSprite hero={me.hero} team={me.team} scale={0.5} /></span>}
      </span>
      <span className="cab-scores">
        <b>CREW TOP 5</b>
        <span>NO SCORES YET</span>
      </span>
      <span className="cab-play">A · PLAY</span>
    </button>
  );
}

export function GamesOverlay({ xp, me, index, onPick }: {
  xp: XpStatus;
  me: Player | null;
  /** The cabinet under the cursor on the wide grid, and the page shown on the tall one. */
  index: number;
  /** A tap on a cabinet: the one under the cursor plays, another comes under it. */
  onPick: (i: number) => void;
}) {
  const { grid } = useScreen();
  const room = cabinets(xp);
  const at = Math.max(0, Math.min(index, room.length - 1));
  const tall = grid.name === 'tall';
  const shown = tall ? [at] : room.map((_, i) => i);
  const f = fleet(me?.team);
  return (
    <div className="games">
      <h2>GAME ROOM</h2>
      {me?.team && me.github_login
        ? <span className="j-badge" style={{ ['--fc' as string]: f.color }}>{badgeOf(me, xp)}</span>
        : <span className="j-badge" style={{ ['--fc' as string]: '#8a90d6' }}>VISITOR</span>}
      <XpHeader xp={xp} />
      {tall && <p className="games-page"><Hint k="◀ ▶">PAGE {at + 1}/{room.length}</Hint></p>}
      <div className="cabinets">
        {shown.map((i) => <CabinetView key={i} cabinet={room[i]} me={me} active={i === at} onPick={() => onPick(i)} />)}
      </div>
      <p className="hint games-foot">
        {!tall && <Hint k="◀ ▶">CHOOSE</Hint>} <Hint k="A">PLAY</Hint> <Hint k="B">MENU</Hint>
      </p>
    </div>
  );
}
