import type { CSSProperties } from 'react';
import { spritePixels } from '@omni/design';
import type { FleetRow } from '../../arcade/types';
import { pixelSvg } from '../../design/pixel-svg';
import { PressStart, SignUp } from '../poster/Poster';
import type { HighScores } from '../scores';
import { cardsOf } from './cards';
import { FLIP_ATTR } from './flip';

// The magazine spreads under HOME's poster (PRD 261), in the ad's order: the strategy guide, the
// great stuff, the high scores, the fleets' trading cards and the order form. All server-drawn, like
// the poster: the one script on the page is Controls, which flips a card on a click. Styles in home.css.

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

/** PLUS ALL OF THIS GREAT STUFF!: each bullet a real feature, its name then what it does. */
export const GREAT_STUFF = [
  ['omni invade', 'reads a repository and writes its playbook.'],
  ['Never merges into main', ': a person always does.'],
  ['Ask mode', 'puts Claude\'s questions on a web page.'],
  ['The knowledge graph', 'reads the registers as one map.'],
  ['The galaxy', ': every PRD a planet, every team a fleet.'],
] as const;

const Svg = ({ svg }: { svg: string }) => <span className="home-svg" dangerouslySetInnerHTML={{ __html: svg }} />;

function StrategyGuide() {
  return (
    <section className="home-spread" aria-labelledby="home-guide">
      <h2 id="home-guide" className="home-spread-head">Strategy guide: <em>how the loop works</em></h2>
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

function GreatStuff() {
  return (
    <section className="home-spread" aria-labelledby="home-stuff">
      <h2 id="home-stuff" className="home-spread-head">Plus all of this <em>great stuff!</em></h2>
      <ul className="home-stuff">
        {GREAT_STUFF.map(([name, does]) => (
          <li key={name}><b>{name}</b>{does.startsWith(':') ? '' : ' '}{does}</li>
        ))}
      </ul>
    </section>
  );
}

function Scores({ scores }: { scores: HighScores }) {
  const rows = [['PRDS SHIPPED', scores.prdsShipped], ['SLICES MERGED', scores.slicesMerged], ['DECISIONS ADOPTED', scores.decisionsAdopted]] as const;
  return (
    <section className="home-spread" aria-labelledby="home-scores">
      <h2 id="home-scores" className="home-spread-head">High <em>scores</em></h2>
      <div className="home-scores">
        {rows.map(([label, value]) => (
          <div key={label} className="home-score"><span>{label}</span> <b>{value}</b></div>
        ))}
      </div>
      <p className="home-note">Counted from the loop&apos;s own shipped work, each time this page is built.</p>
    </section>
  );
}

function Fleets({ fleets }: { fleets: readonly FleetRow[] }) {
  return (
    <section className="home-spread" aria-labelledby="home-fleets">
      <h2 id="home-fleets" className="home-spread-head">Collect all <em>the fleets!</em></h2>
      <div className="home-cards">
        {cardsOf(fleets).map((c) => (
          <button
            key={c.name}
            type="button"
            className="home-card"
            aria-pressed="false"
            aria-label={`${c.label} trading card, flip for its rule`}
            style={{ '--fleet': c.color } as CSSProperties}
            {...{ [FLIP_ATTR]: '' }}
          >
            <span className="home-card-in">
              <span className="home-card-front">
                {c.mascot ? <Svg svg={pixelSvg(spritePixels(c.mascot, { frame: 0 }), { scale: 2, title: `${c.label}'s mascot` })} /> : null}
                <span className="home-card-name">{c.label}</span>
                <span className="home-card-motto">{c.motto}</span>
              </span>
              <span className="home-card-back">
                <span className="home-card-swatch" />
                <span className="home-card-name">{c.label}</span>
                <span className="home-card-rule">{c.rule}</span>
              </span>
            </span>
          </button>
        ))}
      </div>
      <p className="home-note">Hover, tap, Enter or Space flips a card.</p>
    </section>
  );
}

function OrderForm() {
  return (
    <section className="home-spread" aria-labelledby="home-order">
      <div className="home-order">
        <h2 id="home-order" className="home-spread-head">To join instantly: <em>sign up with GitHub</em></h2>
        <div className="home-order-row">
          <SignUp />
          <PressStart />
        </div>
        <p className="home-fine">Omni Loop runs on Claude Code. Invite-only while in beta.</p>
      </div>
      <p className="home-psst">PSST: <kbd><span className="home-glyph">↑ ↑ ↓ ↓ ← → ← →</span> B A</kbd> FLASHES CHEAT ACTIVATED! AND DROPS YOU IN THE GAME.</p>
    </section>
  );
}

export function Spreads({ scores, fleets }: { scores: HighScores; fleets: readonly FleetRow[] }) {
  return (
    <div className="home-spreads">
      <StrategyGuide />
      <GreatStuff />
      <Scores scores={scores} />
      <Fleets fleets={fleets} />
      <OrderForm />
    </div>
  );
}
