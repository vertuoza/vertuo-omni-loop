import { Controls } from './Controls';
import { FORWARD_SCRIPT } from './forward';
import { Poster } from './poster/Poster';
import { countHighScores } from './scores';
import { Spreads } from './spreads/Spreads';
import './home.css';

// HOME, the Omni Loop front door at `/` (PRD 261): a static page, with no session, no Supabase and no
// work per request. Its first child is the forwarding of the arcade's old deep links, so a bookmark
// to `/#planet-12` is on its way to /play before anything paints. Then the poster above the fold,
// the magazine spreads under it (the game deals HOME's own example fleets, never the demo galaxy's
// nor a workspace's, and proves itself with the high scores counted when the page is built, PRD 971).
// The page ships two client components: Controls (Enter, the Konami code, every PRESS START and the
// cards' flips) and, inside the poster, PosterPlanet, which turns the planet (PRD 394).
export function Home() {
  return (
    <main className="home">
      <script dangerouslySetInnerHTML={{ __html: FORWARD_SCRIPT }} />
      <Poster />
      <Spreads scores={countHighScores()} />
      <Controls />
    </main>
  );
}
