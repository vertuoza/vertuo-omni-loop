import type { FleetRow } from '../../arcade/types';
import type { HighScores as Counts } from '../scores';
import { Customers } from './Customers';
import { Game } from './Game';
import { HighScores } from './HighScores';
import { OrderForm } from './OrderForm';
import { StrategyGuide } from './StrategyGuide';

// The magazine spreads under HOME's poster (PRD 261, trimmed by PRD 971), in the ad's order: the
// strategy guide, built for your customers, the high scores, the game and the order form. Each spread is its own component, with
// its own stylesheet and test beside it; this file only puts them in order. The styles every spread
// shares are in home.css. All server-drawn, like the poster: the one script on the page is Controls,
// which flips a card.
export function Spreads({ scores, fleets }: { scores: Counts; fleets: readonly FleetRow[] }) {
  return (
    <div className="home-spreads">
      <StrategyGuide />
      <Customers />
      <HighScores scores={scores} />
      <Game fleets={fleets} />
      <OrderForm />
    </div>
  );
}
