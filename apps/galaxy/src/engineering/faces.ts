import { validHero, type Hero } from '@omni/design';
import type { EngineeringValue, Ranked } from './tally';

// The face beside a login in the Engineering board's top-people lists (PRD 645 s1), pure. The game
// stays a removable layer: the board reads players only to pick a face. A login that is a player in
// the workspace (their GitHub login, whatever the case) whose stored hero can be drawn gets that
// hero, in their fleet's colour when it is a hex (it goes into the drawing), in the hero's own
// colours otherwise. Anyone else gets their GitHub picture.

/** A player as the faces read returns them: their GitHub login, stored hero and fleet's colour. */
export interface FacePlayer { login: string; hero: unknown; color: string | null }

export type Face =
  | { kind: 'hero'; hero: Hero; color: string | undefined }
  | { kind: 'github'; src: string };

/** A fleet's colour, only when it is one. */
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** A login's GitHub picture, 56 px for a 28 px avatar on a dense screen. */
export const githubPicture = (login: string) => `https://github.com/${encodeURIComponent(login)}.png?size=56`;

export function faceOf(login: string, players: readonly FacePlayer[]): Face {
  const key = login.toLowerCase();
  const player = players.find((p) => p.login.toLowerCase() === key);
  if (!player || !validHero(player.hero)) return { kind: 'github', src: githubPicture(login) };
  return { kind: 'hero', hero: player.hero, color: player.color && HEX.test(player.color) ? player.color : undefined };
}

/** Every login the three lists show, once each. */
export function loginsShown(value: EngineeringValue): string[] {
  if (value.kind !== 'board') return [];
  const { opened, merged, reviews } = value.people;
  return [...new Set([...opened, ...merged, ...reviews].map((p) => p.login))];
}

/** The board with each person of the three lists given their face. */
export function withFaces(value: EngineeringValue, players: readonly FacePlayer[]): EngineeringValue {
  if (value.kind !== 'board') return value;
  const faced = (people: Ranked[]) => people.map((p) => ({ ...p, face: faceOf(p.login, players) }));
  const { opened, merged, reviews } = value.people;
  return { ...value, people: { opened: faced(opened), merged: faced(merged), reviews: faced(reviews) } };
}
