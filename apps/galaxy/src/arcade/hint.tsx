'use client';
// A key hint on screen, "[A] LINK GITHUB": the key to press, and a button that presses it for a
// mouse or a finger. Hints for keys a click can't stand for (▲▼, ◀▶, ⌫) stay text.
import { createContext, useContext } from 'react';
import { hintAction, type Action } from './keys';

/** How a click on a hint reaches the arcade: the same path as the key it shows. */
export const Press = createContext<((action: Action) => void) | null>(null);

export function Hint({ k, children }: { k: string; children?: React.ReactNode }) {
  const press = useContext(Press);
  const action = hintAction(k);
  const key = <span className="j-key">{k}</span>;
  if (!press || !action) return <span>{key}{children}</span>;
  return (
    // No focus on click: Enter and Space keep meaning START and A, not "click this button again".
    <button type="button" className="j-hit" onMouseDown={(e) => e.preventDefault()} onClick={() => press(action)}>
      {key}{children}
    </button>
  );
}
