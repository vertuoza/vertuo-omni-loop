import { spritePixels } from '@omni/design';
import { Fragment, type ReactNode } from 'react';
import { pixelSvg } from '../../design/pixel-svg';
import { LINGO } from '../lingo';
import { Svg } from '../poster/Poster';
import './StrategyGuide.css';

// The strategy guide (PRD 261, reworded by PRD 285): the loop's stages as a world map's levels, each
// naming the practice the loop builds in, with OmniMan running the path and the LOOP LINGO sidebar
// beside the map glossing the loop terms HOME uses.

/** OmniMan's pose on the strategy guide's path. */
export const RUN_POSE = 'omni-run' as const;

interface Stage {
  level: string;
  name: string;
  line: ReactNode;
  bonus?: true;
}

/** The loop's stages, as the strategy guide's levels. */
export const STAGES: readonly Stage[] = [
  { level: '1-1', name: 'SET UP', line: <><code>omni invade</code> reads your repository and writes its harness: how you test, build, review and release. You merge it as one pull request of docs.</> },
  { level: '1-2', name: 'BRAINSTORM', line: 'You and Claude turn an idea into a brief, the PRD, with a before/after page. A person approves it before any code exists.' },
  { level: '1-3', name: 'PLAN', line: 'The PRD is cut into thin slices, each with the files it may touch, grouped in waves that are built side by side.' },
  { level: '1-4', name: 'BUILD', line: 'One agent per slice, each on its own branch, test-first, each with its own pull request.' },
  { level: '1-5', name: 'OUTBOX', line: 'Every decision an agent took without asking is written down. You answer once, at the end.' },
  { level: '1-6', name: 'SHIP', line: 'The feature\'s pull request is ready once its checks pass. A person reviews and merges it, never an agent.' },
  { level: '★ BONUS', name: 'KNOWLEDGE', line: 'The decisions you settle land in the knowledge base, so the next loop knows more.', bonus: true },
];

export function StrategyGuide() {
  return (
    <section className="home-spread" aria-labelledby="home-guide">
      <h2 id="home-guide" className="home-spread-head">Strategy guide: <em>the loop, level by level</em></h2>
      <div className="home-guide">
        <ol className="home-map">
          {STAGES.map((s) => (
            <li key={s.level} className={s.bonus ? 'home-stage home-stage-bonus' : 'home-stage'}>
              <span className="home-stage-lv">{s.level.startsWith('★') ? <><span className="home-glyph">★</span>{s.level.slice(1)}</> : s.level}</span> <b>{s.name}</b> <span className="home-stage-line">{s.line}</span>
            </li>
          ))}
        </ol>
        <aside className="home-lingo" aria-labelledby="home-lingo">
          <h3 id="home-lingo" className="home-lingo-head">Loop lingo</h3>
          <dl>
            {LINGO.map((e) => (
              <Fragment key={e.term}>
                <dt>{e.term}</dt>
                <dd>{e.gloss}</dd>
              </Fragment>
            ))}
          </dl>
        </aside>
      </div>
      <div className="home-walker">
        <div className="home-runner" data-pose={RUN_POSE}>
          <Svg svg={pixelSvg(spritePixels(RUN_POSE, { frame: 0 }), { scale: 2, title: 'OmniMan running the path' })} />
        </div>
        <span>OMNIMAN RUNS THE PATH, ONE LEVEL AT A TIME</span>
      </div>
    </section>
  );
}
