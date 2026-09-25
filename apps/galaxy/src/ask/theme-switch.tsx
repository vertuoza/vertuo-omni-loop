'use client';
import { useEffect, useLayoutEffect, useState } from 'react';
import { CHOICE_ATTR, THEME_ATTR, THEME_CHOICES, THEME_KEY, readChoice, resolveTheme, storeChoice, type ThemeChoice } from './theme';

// The system / light / dark switch in the ask pages' header. The inline script (theme.ts) has
// already applied the stored choice before the first paint, and ask.css draws the pressed button
// from <html>'s attribute; this keeps the choice, re-applies it once React owns the page, and
// follows the system while the choice is system.

const LABELS: Record<ThemeChoice, string> = { system: 'System', light: 'Light', dark: 'Dark' };
const DARK = '(prefers-color-scheme: dark)';

function stored(): ThemeChoice {
  try {
    return readChoice(window.localStorage.getItem(THEME_KEY));
  } catch {
    return 'system';
  }
}

function apply(choice: ThemeChoice) {
  const root = document.documentElement;
  root.setAttribute(THEME_ATTR, resolveTheme(choice, window.matchMedia?.(DARK).matches ?? false));
  root.setAttribute(CHOICE_ATTR, choice);
}

export function ThemeSwitch() {
  const [choice, setChoice] = useState<ThemeChoice | null>(null);

  // Before paint: a soft navigation, or React's development remount, may have cleared <html>'s attributes.
  useLayoutEffect(() => {
    const now = stored();
    apply(now);
    setChoice(now);
  }, []);

  useEffect(() => {
    if (choice !== 'system' || !window.matchMedia) return;
    const media = window.matchMedia(DARK);
    const follow = () => apply('system');
    media.addEventListener('change', follow);
    return () => media.removeEventListener('change', follow);
  }, [choice]);

  const choose = (next: ThemeChoice) => {
    try {
      storeChoice(window.localStorage, next);
    } catch {
      /* no storage at all: the choice holds for this visit */
    }
    apply(next);
    setChoice(next);
  };

  return (
    <div className="ask-switch" role="group" aria-label="Theme">
      {THEME_CHOICES.map((c) => (
        <button key={c} type="button" data-choice={c} aria-pressed={choice === c} onClick={() => choose(c)}>
          {LABELS[c]}
        </button>
      ))}
    </div>
  );
}
