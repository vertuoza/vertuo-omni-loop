import type { LogoDrawing, LogoForm } from './logo.mjs';

/** Omni Loop, the product brand: its name, tagline, logo form, favicon and theme colour. */
export const OMNI_LOOP: {
  readonly name: 'Omni Loop';
  readonly tagline: string;
  readonly logo: LogoForm;
  readonly icon: LogoDrawing;
  readonly themeColor: string;
};
