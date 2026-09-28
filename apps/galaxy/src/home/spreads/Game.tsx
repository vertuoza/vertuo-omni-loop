import type { CSSProperties } from 'react';
import { spritePixels } from '@omni/design';
import type { FleetRow } from '../../arcade/types';
import { pixelSvg } from '../../design/pixel-svg';
import { Svg } from '../poster/Poster';
import { cardsOf } from './cards';
import { FLIP_ATTR } from './flip';
import './Game.css';

// The game: Entropy you can see (PRD 285, was COLLECT ALL THE FLEETS! in PRD 261): why the game
// exists, then the demo world's invented fleets as trading cards. Controls flips a card on a click.
export function Game({ fleets }: { fleets: readonly FleetRow[] }) {
  return (
    <section className="home-spread" aria-labelledby="home-fleets">
      <h2 id="home-fleets" className="home-spread-head">The game: <em>Entropy you can see</em></h2>
      <p className="home-lead">
        Every feature is a planet your teams terraform together. Unanswered questions, stuck work and
        shipped bugs are Entropy: they cost the owning fleet points until someone closes them.
      </p>
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
