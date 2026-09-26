'use client';
// A key hint on screen, "[A] LINK GITHUB": the key to press, and a button that presses it for a
// mouse or a finger. Hints for keys a click can't stand for (▲▼, ◀▶, ⌫) stay text.
//
// A hint names the buttons the player has (`hintKey`): the keyboard's on a computer, the Game Boy's
// on the two bodies, where "[ENTER] DONE" reads "[START] DONE" and "[TYPE] OR" is dropped. Every
// scene group's hints go through here, so every screen follows the form.
import { createContext, useContext } from 'react';
import { hintAction, hintKey, type Action } from './keys';
import { useScreen } from './Screen';

/** How a click on a hint reaches the arcade: the same path as the key it shows. */
export const Press = createContext<((action: Action) => void) | null>(null);

// The key's label is 7px on the wide grid (arcade.css); the tall grid's smallest type is 8 grid px.
const TALL_KEY = { fontSize: 8 } as const;

export function Hint({ k, children }: { k: string; children?: React.ReactNode }) {
  const press = useContext(Press);
  const { form, grid } = useScreen();
  const shown = hintKey(k, form);
  if (shown === null) return null;
  const action = hintAction(shown);
  const key = <span className="j-key" style={grid.name === 'tall' ? TALL_KEY : undefined}>{shown}</span>;
  if (!press || !action) return <span>{key}{children}</span>;
  return (
    // No focus on click: Enter and Space keep meaning START and A, not "click this button again".
    <button type="button" className="j-hit" onMouseDown={(e) => e.preventDefault()} onClick={() => press(action)}>
      {key}{children}
    </button>
  );
}
