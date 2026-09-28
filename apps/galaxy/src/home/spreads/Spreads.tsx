import type { FleetRow } from '../../arcade/types';
import type { HighScores as Counts } from '../scores';
import { ForYou } from './ForYou';
import { Game } from './Game';
import { HighScores } from './HighScores';
import { InOut } from './InOut';
import { OrderForm } from './OrderForm';
import { SeeEverything } from './SeeEverything';
import { StrategyGuide } from './StrategyGuide';

// The magazine spreads under HOME's poster (PRD 261, value first since PRD 285), in the ad's order:
// what's in it for you, the strategy guide, you see everything, easy in and easy out, the high
// scores, the game and the order form. Each spread is its own component, with its own stylesheet and
// test beside it; this file only puts them in order. The styles every spread shares are in home.css.
// All server-drawn, like the poster: the one script on the page is Controls, which flips a card.
export function Spreads({ scores, fleets }: { scores: Counts; fleets: readonly FleetRow[] }) {
  return (
    <div className="home-spreads">
      <ForYou />
      <StrategyGuide />
      <SeeEverything />
      <InOut />
      <HighScores scores={scores} />
      <Game fleets={fleets} />
      <OrderForm />
    </div>
  );
}
