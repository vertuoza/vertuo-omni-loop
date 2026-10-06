// CSS custom properties as a React style, typed here once for every element that sets one: React's
// CSSProperties takes a `--*` property as it is, so no cast is needed.
import type { CSSProperties } from 'react';

/** `vars`, each a custom property, as a style: the same object, typed as React takes it. */
export const cssVars = (vars: Readonly<Record<`--${string}`, string | number | null | undefined>>): CSSProperties =>
  vars;
