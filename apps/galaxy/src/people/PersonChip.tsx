import type { Face } from './face';
import type { Person } from './types';
import './people.css';

// A person, as every screen names them (PRD 652, design A · bare sprite): their face inline, with no
// frame, 24 px in a table and 18 px in a sentence, then their name. The face was decided by faceOf,
// so this only draws it and works in a client component too. The picture is decorative: a photo has
// an empty alt, a hero and an initial are hidden, and the initial is drawn by the stylesheet, so the
// chip's text is the name alone.

export type ChipSize = 'table' | 'inline';

function PersonFace({ face }: { face: Face }) {
  if (face.kind === 'hero') return <span className="person-face is-hero" aria-hidden="true" dangerouslySetInnerHTML={{ __html: face.svg }} />;
  if (face.kind === 'photo') return <img className="person-face is-photo" src={face.url} alt="" loading="lazy" decoding="async" />;
  return <span className="person-face is-initial" aria-hidden="true" data-initial={face.letter} />;
}

export function PersonChip({ person, size = 'table' }: { person: Pick<Person, 'name' | 'face'>; size?: ChipSize }) {
  return <span className={`person-chip is-${size}`}><PersonFace face={person.face} />{person.name}</span>;
}
