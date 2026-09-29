import type { Face } from './face';
import type { Person } from './types';
import './people.css';

// A person, as every screen names them (PRD 652, design A · bare sprite): their face inline, with no
// frame, 24 px in a table and 18 px in a sentence, then their name. The face was decided by faceOf,
// so this only draws it and works in a client component too. The picture is decorative: a photo has
// an empty alt, a hero and an initial are hidden, and the initial is drawn by the stylesheet, so the
// chip's text is the name alone.
//
// PRD 698: a person with a login is a link to their profile, /app/people/<login>; with none, the chip
// stays a span. A chip drawn inside another link or button passes link={false}, so no page nests a
// link in a link. A linked chip's name sits in its own span, so hover and focus underline it and never
// the face; a plain chip's markup is the one of PRD 652.

export type ChipSize = 'table' | 'inline';

/** The profile of the member with this GitHub login. */
export const profileHref = (login: string) => `/app/people/${encodeURIComponent(login.toLowerCase())}`;

function PersonFace({ face }: { face: Face }) {
  if (face.kind === 'hero') return <span className="person-face is-hero" aria-hidden="true" dangerouslySetInnerHTML={{ __html: face.svg }} />;
  if (face.kind === 'photo') return <img className="person-face is-photo" src={face.url} alt="" loading="lazy" decoding="async" />;
  return <span className="person-face is-initial" aria-hidden="true" data-initial={face.letter} />;
}

export function PersonChip({ person, size = 'table', link = true }: { person: Pick<Person, 'name' | 'face' | 'login'>; size?: ChipSize; link?: boolean }) {
  const className = `person-chip is-${size}`;
  if (link && person.login) {
    return <a className={className} href={profileHref(person.login)}><PersonFace face={person.face} /><span className="person-chip-name">{person.name}</span></a>;
  }
  return <span className={className}><PersonFace face={person.face} />{person.name}</span>;
}
