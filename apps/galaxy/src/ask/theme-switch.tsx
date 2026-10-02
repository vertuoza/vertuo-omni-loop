'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import { CHOICE_ATTR, THEME_ATTR, THEME_CHOICES, THEME_KEY, readChoice, storeChoice, type ThemeChoice } from './theme';

// The Omni / light / dark switch in the ask pages' header. The inline script (theme.ts) has already
// applied the stored choice to the ask root before the first paint, and ask.css draws the pressed
// button from that root's attribute; this keeps the choice and re-applies it once React owns the
// page. The choice is the theme: nothing here follows the system's preference.

const LABELS: Record<ThemeChoice, string> = { omni: 'Omni', light: 'Light', dark: 'Dark' };

function stored(): ThemeChoice {
  try {
    return readChoice(window.localStorage.getItem(THEME_KEY));
  } catch {
    return readChoice(null);
  }
}

function apply(root: Element | null | undefined, choice: ThemeChoice) {
  if (!root) return;
  root.setAttribute(THEME_ATTR, choice);
  root.setAttribute(CHOICE_ATTR, choice);
}

export function ThemeSwitch() {
  const [choice, setChoice] = useState<ThemeChoice | null>(null);
  const self = useRef<HTMLDivElement>(null);
  const root = () => self.current?.closest('.ask');

  // Before paint: after a soft navigation the inline script has not run.
  useLayoutEffect(() => {
    const now = stored();
    apply(root(), now);
    setChoice(now);
  }, []);

  const choose = (next: ThemeChoice) => {
    try {
      storeChoice(window.localStorage, next);
    } catch {
      /* no storage at all: the choice holds for this visit */
    }
    apply(root(), next);
    setChoice(next);
  };

  return (
    <div ref={self} className="ask-switch" role="group" aria-label="Theme">
      {THEME_CHOICES.map((c) => (
        <button key={c} type="button" data-choice={c} aria-pressed={choice === c} onClick={() => {
          choose(c);
        }}>
          {LABELS[c]}
        </button>
      ))}
    </div>
  );
}
