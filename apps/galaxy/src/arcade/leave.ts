// The confirm before the arcade is left for the app (PRD 238): OPEN THE APP?, over whatever scene is
// showing. It is an overlay, not a scene: the scene under it stays exactly as it was, and B gives it
// back. Its decisions are here, pure: what a press does while it is open, and whether a game is
// paused before it shows. leave.tsx draws it; ArcadeApp opens it through one function, from the
// menu's APP MODE row and from anything else that leaves for the app (the bodies' switch).
import { pause, type Game } from './games/invaders';
import { keyAction, type Action } from './keys';

/** The confirm's words, as the screen shows them. */
export const LEAVE = {
  title: 'OPEN THE APP?',
  line: 'QUESTIONS AND KNOWLEDGE, AS PAGES',
  yes: 'YES',
  no: 'NO',
} as const;

/** What a press does while the confirm is open: leave for the app, or close the confirm. */
export type LeaveMove = 'go' | 'stay';

/** A (or START) goes to the app, B stays in the game; every other action does nothing. */
export function leaveMove(action: Action): LeaveMove | null {
  if (action === 'a' || action === 'start') return 'go';
  if (action === 'b') return 'stay';
  return null;
}

/**
 * What a key does while the confirm is open, on every screen: the pad's keys only (keys.ts). On the
 * name screen, where letters type, the confirm takes them: A, Z, Space, K and Enter say yes; B, X,
 * Esc, J and Backspace say no; any other key types nothing.
 */
export function leaveKey(key: string): LeaveMove | null {
  const action = keyAction(key);
  return action ? leaveMove(action) : null;
}

/** Whether a game must be paused before the confirm shows: one running (in play, or on its ready screen). */
export function pauseFirst(game: Game | null): boolean {
  return Boolean(game && !game.paused && !game.over);
}

/**
 * The game as the confirm leaves it under itself: paused when it was running, so B comes back to
 * the pause and never to play; a paused game, a game over and no game at all as they are.
 */
export function openOver(game: Game | null): Game | null {
  return game && pauseFirst(game) ? pause(game) : game;
}
