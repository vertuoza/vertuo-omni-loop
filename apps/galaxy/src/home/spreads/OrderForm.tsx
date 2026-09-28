import { PressStart, SignUp } from '../poster/Poster';
import './OrderForm.css';

// GETTING STARTED: a plain link to the docs, in PRESS START's button style but without its start sound.
const DOCS = '/docs';

function GettingStarted() {
  return <a className="home-start" href={DOCS}>GETTING STARTED</a>;
}

// The order form (PRD 261): JOIN THE LOOP!, moved here from the poster by PRD 285, over the
// sign-up (enabled by PRD 359), PRESS START, GETTING STARTED (PRD 346), the fine print and the Konami tip.
export function OrderForm() {
  return (
    <section className="home-spread" aria-labelledby="home-order">
      <div className="home-order">
        <h2 id="home-order" className="home-spread-head">Join <em>the loop!</em></h2>
        <p className="home-order-call">To join instantly: sign up with GitHub</p>
        <div className="home-order-row">
          <SignUp />
          <PressStart />
          <GettingStarted />
        </div>
        <p className="home-fine">Omni Loop runs on Claude Code. Free while in beta: sign up with GitHub.</p>
      </div>
      <p className="home-psst">PSST: <kbd><span className="home-glyph">↑ ↑ ↓ ↓ ← → ← →</span> B A</kbd> FLASHES CHEAT ACTIVATED! AND DROPS YOU IN THE GAME.</p>
    </section>
  );
}
