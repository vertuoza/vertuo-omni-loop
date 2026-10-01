// Omni Loop, the product brand: what the arcade is under when no workspace owns the screen (signed
// out, in demo mode, in the single-file artifact), and what the page's title, favicon and theme
// colour say. A workspace's own mark is its customer's brand, and the galaxy keeps it apart.
import type { LogoDrawing, LogoForm } from './logo.ts';
import { INK } from './palette.ts';

/** Omni Loop, the product brand: its name, tagline, logo form, favicon and theme colour. */
export const OMNI_LOOP: {
  readonly name: 'Omni Loop';
  readonly tagline: string;
  readonly logo: LogoForm;
  readonly icon: LogoDrawing;
  readonly themeColor: string;
} = Object.freeze({
  /** The product's name, as it is written in running text. The arcade upper-cases it. */
  name: 'Omni Loop',
  /** The line under the logo on the title screen. */
  tagline: 'Terraform the galaxy',
  /** The logo form the brand is drawn with (logo.mjs). */
  logo: 'full',
  /** The favicon: the mark, redrawn on its own 16×16 grid. */
  icon: 'favicon',
  /** The browser's theme colour: the void behind the arcade. */
  themeColor: INK.void,
});
