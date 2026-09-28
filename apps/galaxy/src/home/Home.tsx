import { demoFleets } from '../data/load-galaxy';
import { Controls } from './Controls';
import { FORWARD_SCRIPT } from './forward';
import { Poster } from './poster/Poster';
import { countHighScores } from './scores';
import { Spreads } from './spreads/Spreads';
import './home.css';

// HOME, the Omni Loop front door at `/` (PRD 261): a static page, with no session, no Supabase and no
// work per request. Its first child is the forwarding of the arcade's old deep links, so a bookmark
// to `/#planet-12` is on its way to /play before anything paints. Then the poster above the fold,
// the magazine spreads under it (the high scores counted when the page is built, the demo world's
// invented fleets as trading cards: no workspace's own, PRD 400), and the page's one client
// component, Controls: Enter, the Konami code, every PRESS START and the cards' flips.
export function Home() {
  return (
    <main className="home">
      <script dangerouslySetInnerHTML={{ __html: FORWARD_SCRIPT }} />
      <Poster />
      <Spreads scores={countHighScores()} fleets={demoFleets()} />
      <Controls />
    </main>
  );
}
