import { PLAY } from '../forward';
import { SIGN_UP_ATTR } from '../sign-up';
import { PRESS_START_ATTR } from '../start';
import { CREST_FORM, crestSvg, OMNI_POSE, omniSvg, planetSvgs, starfieldSvg } from './art';

// The poster above HOME's fold (PRD 261), drawn as a retro print ad: a text column in the ad's
// purple beside a starfield, the Star Fox split. Every picture is an SVG drawn on the server
// (art.ts), so the poster ships no script; the one client component on the page (Controls) makes
// every PRESS START start the game. Its styles are in home.css. PRD 285 put value first: the column
// says what the loop gives a team, AGENTS SHIP. YOU STEER., then its three promises.

/** The promise strip under the pitch, in its order. */
export const PROMISES = ['ONE FOLDER IN, ONE FOLDER OUT', 'EVERY DECISION WRITTEN DOWN', 'A PERSON ALWAYS MERGES'] as const;

/** A string of SVG markup, as an element's only child. */
export const Svg = ({ svg }: { svg: string }) => <span className="home-svg" dangerouslySetInnerHTML={{ __html: svg }} />;

/** SIGN UP WITH GITHUB (PRD 359): a plain button, marked for Controls, which starts the GitHub
 * sign-in on a click (sign-up.ts). HOME stays static: the page itself reaches no database. */
export function SignUp() {
  return (
    <button type="button" className="home-signup" aria-label="Sign up with GitHub" {...{ [SIGN_UP_ATTR]: '' }}>
      <b>SIGN UP WITH GITHUB</b>
    </button>
  );
}

/** PRESS START: a plain link to the game, which Controls turns into the start sound and the game. */
export function PressStart({ blink = false }: { blink?: boolean }) {
  return (
    <a className={blink ? 'home-start home-blink' : 'home-start'} href={PLAY} {...{ [PRESS_START_ATTR]: '' }}>PRESS START</a>
  );
}

export function Poster() {
  return (
    <section className="home-poster" aria-labelledby="home-headline">
      <div className="home-col">
        <p className="home-kicker">THE DELIVERY FRAMEWORK<br />FOR CODING AGENTS</p>
        <h1 id="home-headline" className="home-head">AGENTS SHIP.<br />YOU STEER.</h1>
        <div className="home-dots" role="presentation" />
        <p className="home-pitch">
          Describe the feature once. Coding agents plan it, build it test-first and open the pull
          requests. Your team owns the product and the rules, and sees every decision the agents took.
        </p>
        <ul className="home-promises">
          {PROMISES.map((promise) => (
            <li key={promise}><span className="home-glyph" aria-hidden="true">★</span> {promise}</li>
          ))}
        </ul>
        <p className="home-quote">“TO JOIN INSTANTLY,<br />SIGN UP WITH GITHUB!”</p>
        <div className="home-spokes">
          <div className="home-omni" data-pose={OMNI_POSE}><Svg svg={omniSvg()} /></div>
          <SignUp />
        </div>
      </div>
      <div className="home-sky">
        <div className="home-stars" aria-hidden="true" dangerouslySetInnerHTML={{ __html: starfieldSvg() }} />
        <div className="home-planet" role="img" aria-label="A pixel planet, green patches of secured ground spreading across it: the invasion">
          {planetSvgs().map((svg, i) => (
            <span key={i} className="home-planet-frame" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
          ))}
        </div>
        <div className="home-crest" data-logo={CREST_FORM}><Svg svg={crestSvg()} /></div>
        <PressStart blink />
      </div>
    </section>
  );
}
