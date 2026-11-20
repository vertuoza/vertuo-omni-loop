'use client';
import { useEffect, useSyncExternalStore } from 'react';

// The name of the item a page shows, for the top bar's trail (omni-loop-20 s6): a PRD's or a fix's page
// renders <TrailItem name="PRD #216" />, and the bar's last crumb names it (`Work › PRDs › PRD #216`).
// The page sits under the bar, so it hands the name over through this one store, in the browser; the
// server renders the bar with the kind's noun (`PRD`), and the name replaces it once the page runs.

let current: string | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/** Sets the item's name, or clears it with null. */
function setTrailItem(name: string | null): void {
  if (name === current) return;
  current = name;
  for (const listener of listeners) listener();
}

/** The name the page set, null on the server and before any page set one. */
export function useTrailItem(): string | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

/** Names the page's item in the top bar's trail while the page is shown. */
export function TrailItem({ name }: { name: string }) {
  useEffect(() => {
    setTrailItem(name);
    return () => { setTrailItem(null); };
  }, [name]);
  return null;
}
