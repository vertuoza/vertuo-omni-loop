// CSS custom properties as a React style. React's CSSProperties names no `--*` property, so a style
// that sets one is typed here, once, rather than cast at every element that sets one.
import type { CSSProperties } from 'react';

/** `vars`, each a custom property, as a style: the same object, typed as React takes it. */
export const cssVars = (vars: Readonly<Record<`--${string}`, string | number | null | undefined>>): CSSProperties =>
  vars as CSSProperties; // ts-allow: a custom property is a style React passes through as it is; CSSProperties only lacks its name
