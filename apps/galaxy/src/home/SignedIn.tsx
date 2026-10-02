import type { SignedInView } from './signed-in';
import { PLAY_HREF } from './start';

// The signed-in pill (PRD 1006): drawn by Controls, in the browser only, into each sign-up slot, where
// it takes the place of SIGN UP WITH GITHUB (home.css hides the button beside it). The visitor's face
// beside CONTINUE YOUR GAME, on a plain link to /play, which tells a returning player from a new
// member. The face is decorative: the link's name says whose game it is.

function Face({ face }: { face: SignedInView['face'] }) {
  if (face.kind === 'photo') return <img className="home-signed-in-face" src={face.url} alt="" width={28} height={28} />;
  if (face.kind === 'hero') return <span className="home-signed-in-face" aria-hidden="true" dangerouslySetInnerHTML={{ __html: face.svg }} />;
  return <span className="home-signed-in-face" aria-hidden="true">{face.letter}</span>;
}

export function SignedIn({ view }: { view: SignedInView }) {
  return (
    <a className="home-signed-in" href={PLAY_HREF} aria-label={`Continue your game as ${view.name}`}>
      <Face face={view.face} />
      <b>CONTINUE YOUR GAME ▶</b>
    </a>
  );
}
