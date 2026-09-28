import { PressStart, SignUp } from '../poster/Poster';
import './OrderForm.css';

// The order form (PRD 261): JOIN THE LOOP!, moved here from the poster by PRD 285, over the disabled
// sign-up, PRESS START, the fine print and the Konami tip.
export function OrderForm() {
  return (
    <section className="home-spread" aria-labelledby="home-order">
      <div className="home-order">
        <h2 id="home-order" className="home-spread-head">Join <em>the loop!</em></h2>
        <p className="home-order-call">To join instantly: sign up with GitHub</p>
        <div className="home-order-row">
          <SignUp />
          <PressStart />
        </div>
        <p className="home-fine">Omni Loop runs on Claude Code. Invite-only while in beta.</p>
      </div>
      <p className="home-psst">PSST: <kbd><span className="home-glyph">↑ ↑ ↓ ↓ ← → ← →</span> B A</kbd> FLASHES CHEAT ACTIVATED! AND DROPS YOU IN THE GAME.</p>
    </section>
  );
}
