import { Controls } from './Controls';
import { FORWARD_SCRIPT } from './forward';
import { Poster } from './poster/Poster';
import './home.css';

// HOME, the Omni Loop front door at `/` (PRD 261): a static page, with no session, no Supabase and no
// work per request. Its first child is the forwarding of the arcade's old deep links, so a bookmark
// to `/#planet-12` is on its way to /play before anything paints. Then the poster above the fold,
// and the page's one client component, Controls: Enter, the Konami code and every PRESS START.
export function Home() {
  return (
    <main className="home">
      <script dangerouslySetInnerHTML={{ __html: FORWARD_SCRIPT }} />
      <Poster />
      <Controls />
    </main>
  );
}
