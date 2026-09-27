import { FORWARD_SCRIPT, PLAY } from './forward';

// HOME, the Omni Loop front door at `/` (PRD 261): a static page, with no session, no Supabase and no
// work per request. Its first child is the forwarding of the arcade's old deep links, so a bookmark
// to `/#planet-12` is on its way to /play before anything paints. The poster and the spreads come in
// later slices; this is the headline and the way into the game.
export function Home() {
  return (
    <main className="home">
      <script dangerouslySetInnerHTML={{ __html: FORWARD_SCRIPT }} />
      <h1>JOIN THE LOOP!</h1>
      <a href={PLAY}>PRESS START</a>
    </main>
  );
}
