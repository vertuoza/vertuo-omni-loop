import type { CSSProperties } from 'react';
import { heroLook, spritePixels } from '@omni/design';
import type { FleetRow } from '../../arcade/types';
import { pixelSvg } from '../../design/pixel-svg';
import { Svg } from '../poster/Poster';
import { cardsOf, type Card } from './cards';
import { FLIP_ATTR } from './flip';
import './Game.css';

// A card's art: the fleet's mascot, or a bare hero in its colour when it flies none (#963).
function artOf(c: Card): string {
  const { sprite, tint } = c.mascot ? { sprite: c.mascot, tint: null } : heroLook({ v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 0 }, c.color);
  return pixelSvg(spritePixels(sprite, { frame: 0, tint }), { scale: 2, title: `${c.label}'s mascot` });
}

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
            style={{ '--fleet': c.color } as CSSProperties} // ts-allow: React's style type has no custom properties
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
    </section>
  );
}
