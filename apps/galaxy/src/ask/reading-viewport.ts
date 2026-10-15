import type { Viewport } from 'next';
import { TOKENS } from './theme-tokens';

/**
 * The viewport of every section on the reading surface. One colour for the browser's bar, Omni's
 * ground: the metadata is static and cannot read the stored choice, and Omni is the default
 * (PRD 284). A person may zoom (bug 1826): the root layout's never-zoomed viewport is the Game Boy's,
 * and Next merges this over it key by key.
 */
export const READING_VIEWPORT = {
  themeColor: TOKENS.omni.ground,
  colorScheme: 'light dark',
  maximumScale: 5,
  userScalable: true,
} as const satisfies Viewport;
