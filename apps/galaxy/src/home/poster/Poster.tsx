import { PLAY } from '../forward';
import { PRESS_START_ATTR } from '../start';
import { CREST_FORM, crestSvg, OMNI_POSE, omniSvg, planetSvgs, starfieldSvg } from './art';

// The poster above HOME's fold (PRD 261), drawn as a retro print ad: a text column in the ad's
// purple beside a starfield, the Star Fox split. Every picture is an SVG drawn on the server
// (art.ts), so the poster ships no script; the one client component on the page (Controls) makes
// every PRESS START start the game. Its styles are in home.css.

/** A string of SVG markup, as an element's only child. */
const Svg = ({ svg }: { svg: string }) => <span className="home-svg" dangerouslySetInnerHTML={{ __html: svg }} />;

/** The call to action this PRD only shows: signing up with GitHub is the next PRD's. It goes nowhere. */
export function SignUp() {
  return (
    <button type="button" className="home-signup" disabled aria-label="Sign up with GitHub, coming soon">
      <b>SIGN UP WITH GITHUB</b> <span className="home-signup-sep">·</span> COMING SOON
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
        <p className="home-kicker">GET WHOLE FEATURES SHIPPED<br />WHILE YOU SLEEP, WHEN YOU</p>
        <h1 id="home-headline" className="home-head">JOIN<br />THE<br />LOOP!</h1>
        <div className="home-dots" role="presentation" />
        <p className="home-pitch">
          Hand a PRD to the loop. Coding agents plan it, build it test-first, and open the pull
          requests. You answer their questions once, then review and merge.
        </p>
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
