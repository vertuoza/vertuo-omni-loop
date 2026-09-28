import { spritePixels } from '@omni/design';
import { pixelSvg } from '../../design/pixel-svg';
import { Svg } from '../poster/Poster';
import './StrategyGuide.css';

// The strategy guide (PRD 261, retitled by PRD 285): the loop's stages as a world map's levels, with
// OmniMan running the path.

/** OmniMan's pose on the strategy guide's path. */
export const RUN_POSE = 'omni-run' as const;

/** The loop's stages, as the strategy guide's levels. */
export const STAGES = [
  { level: '1-1', name: 'BRAINSTORM', line: 'You and Claude turn an idea into an approved PRD.' },
  { level: '1-2', name: 'PLAN', line: 'The PRD is cut into thin slices, grouped in waves.' },
  { level: '1-3', name: 'WAVES', line: 'One agent per slice, each in its own worktree, test-first, each with its own pull request.' },
  { level: '1-4', name: 'OUTBOX', line: 'Every decision taken without asking is written down; you answer once, at the end.' },
  { level: '1-5', name: 'SHIP', line: 'The feature pull request is ready, and a person merges it.' },
  { level: '★ BONUS', name: 'KNOWLEDGE', line: 'Merged decisions land in the knowledge base, so the next loop knows more.', bonus: true },
] as const;

export function StrategyGuide() {
  return (
    <section className="home-spread" aria-labelledby="home-guide">
      <h2 id="home-guide" className="home-spread-head">Strategy guide: <em>the loop, level by level</em></h2>
      <ol className="home-map">
        {STAGES.map((s) => (
          <li key={s.level} className={'bonus' in s ? 'home-stage home-stage-bonus' : 'home-stage'}>
            <span className="home-stage-lv">{s.level.startsWith('★') ? <><span className="home-glyph">★</span>{s.level.slice(1)}</> : s.level}</span> <b>{s.name}</b> <span className="home-stage-line">{s.line}</span>
          </li>
        ))}
      </ol>
      <div className="home-walker">
        <div className="home-runner" data-pose={RUN_POSE}>
          <Svg svg={pixelSvg(spritePixels(RUN_POSE, { frame: 0 }), { scale: 2, title: 'OmniMan running the path' })} />
        </div>
        <span>OMNIMAN RUNS THE PATH, ONE LEVEL AT A TIME</span>
      </div>
    </section>
  );
}
