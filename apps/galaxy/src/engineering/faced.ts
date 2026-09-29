import type { People } from '../people/load';
import type { EngineeringValue, Ranked } from './tally';

// The face beside a login in the Engineering board's top-people lists (PRD 652 s3, in place of PRD
// 645's own faceOf), pure: each login is resolved through the workspace's people directory, so a
// member shows their hero, else their GitHub photo, and a login outside the workspace keeps its
// public GitHub photo. The login stays the name the list prints.

/** Every login the three lists show, once each. */
export function loginsShown(value: EngineeringValue): string[] {
  if (value.kind !== 'board') return [];
  const { opened, merged, reviews } = value.people;
  return [...new Set([...opened, ...merged, ...reviews].map((p) => p.login))];
}

/** The board with each person of the three lists given their face. */
export function withPeople(value: EngineeringValue, people: People): EngineeringValue {
  if (value.kind !== 'board') return value;
  const faced = (list: Ranked[]) => list.map((p) => ({ ...p, face: people.byLogin(p.login).face }));
  const { opened, merged, reviews } = value.people;
  return { ...value, people: { opened: faced(opened), merged: faced(merged), reviews: faced(reviews) } };
}
