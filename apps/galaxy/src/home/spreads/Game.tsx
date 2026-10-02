import type { CSSProperties } from 'react';
import { spritePixels } from '@omni/design';
import { RULEBOOK } from 'vertuo-omni-plan/game/rulebook.ts';
import { pixelSvg } from '../../design/pixel-svg';
import { Svg } from '../poster/Poster';
import type { HighScores as Counts } from '../scores';
import { cardsOf, type Card } from './cards';
import { EXAMPLE_FLEETS } from './fleets';
import { FLIP_ATTR } from './flip';
import './Game.css';

// The game: build your fleet (PRD 971, s4; was Entropy you can see, PRD 285): three beats — create
// your fleet (HOME's own example fleets as trading cards, each with its mascot), ship value (how
// points come, every number read from the rulebook) and climb the leaderboard (the example fleets
// ranked, then the loop's real counts as the proof: THE LOOP BUILT THIS, PRD 261's high scores).
// Controls flips a card on a click.

// A card's art: its fleet's mascot. Every example fleet flies one (fleets.test.ts holds it).
const artOf = (c: Card) => pixelSvg(spritePixels(c.mascot!, { frame: 0 }), { scale: 2, title: `${c.label}'s mascot` });

/** The three counters, in order: each label and the count it shows. */
const scoreRows = (scores: Counts) => [
  ['FEATURES SHIPPED', scores.prdsShipped],
  ['SLICES MERGED', scores.slicesMerged],
  ['DECISIONS ADOPTED', scores.decisionsAdopted],
] as const;

const closes = Object.values(RULEBOOK.woundClose);

// A fleet's colour, as the variable its card and its leaderboard row are drawn in.
const inFleetColour = (color: string) => ({ '--fleet': color }) as CSSProperties; // ts-allow: React's style type has no custom properties

export function Game({ scores }: { scores: Counts }) {
  const ranked = [...EXAMPLE_FLEETS].sort((a, b) => b.points - a.points);
  return (
    <section className="home-spread" aria-labelledby="home-fleets">
      <h2 id="home-fleets" className="home-spread-head">The game: <em>build your fleet</em></h2>
      <p className="home-lead">Ship value to your customers, and score for your fleet while you do.</p>
      <ol className="home-game-beats">
        <li className="home-game-beat">
          <h3 className="home-game-beat-head">CREATE YOUR FLEET</h3>
          <p className="home-note">
            <span className="home-example">EXAMPLE</span> A fleet is a team with a name, a colour and a mascot.
          </p>
          <div className="home-cards">
            {cardsOf(EXAMPLE_FLEETS).map((c) => (
              <button
                key={c.name}
                type="button"
                className="home-card"
                aria-pressed="false"
                aria-label={`${c.label} trading card, flip for its rule`}
                style={inFleetColour(c.color)}
                {...{ [FLIP_ATTR]: '' }}
              >
                <span className="home-card-in">
                  <span className="home-card-front">
                    <Svg svg={artOf(c)} />
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
        </li>
        <li className="home-game-beat">
          <h3 className="home-game-beat-head">SHIP VALUE</h3>
          <p>
            A secured zone scores {RULEBOOK.zoneSecured}. A rescue scores {RULEBOOK.rescue}. Closing
            Entropy (an unanswered question, stuck work, a shipped bug) scores {Math.min(...closes)} to {Math.max(...closes)}, by
            its kind.
          </p>
        </li>
        <li className="home-game-beat">
          <h3 className="home-game-beat-head">CLIMB THE LEADERBOARD</h3>
          <p className="home-note"><span className="home-example">EXAMPLE</span> The fleets above, ranked by points.</p>
          <ol className="home-board">
            {ranked.map((f, i) => (
              <li key={f.name} style={inFleetColour(f.color)}>
                <span className="home-board-rank">{i + 1}</span> <span className="home-board-name">{f.label}</span>{' '}
                <b className="home-board-points">{f.points}</b>
              </li>
            ))}
          </ol>
          <div className="home-game-proof">
            <h4 className="home-game-proof-head">THE LOOP BUILT THIS</h4>
            <div className="home-scores">
              {scoreRows(scores).map(([label, value]) => (
                <div key={label} className="home-score"><span>{label}</span> <b>{value}</b></div>
              ))}
            </div>
            <p className="home-note">Counted from Omni Loop&apos;s own shipped work, each time this page is built.</p>
          </div>
        </li>
      </ol>
    </section>
  );
}
