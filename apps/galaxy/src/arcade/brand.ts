// Whose arcade it is: Omni Loop's, the house brand, or a workspace's. Its name gives the mark its
// letter (mark.ts) and the boot and the title their words; its theme is the colours the workspace
// overrides (theme.ts), which recolour the arcade, the mark and the heroes' stripes. The house brand
// also carries the product's crest (@omni/design's logo), which the boot draws in place of a letter.
// `brandLook` is where they meet.
import { OMNI_LOOP, type LogoForm } from '@omni/design';
import { markFor, type Mark } from './mark';
import { resolveTheme, type Theme } from './theme';

export interface Brand {
  /** The workspace's name, as it stores it: "Vertuoza". The screens show it upper-cased. */
  readonly name: string;
  /** The workspace's colour overrides, token to `#rrggbb`: only what it changes, `{}` for none. */
  readonly theme: Readonly<Record<string, string>>;
  /** The product's crest, for the house brand only: a workspace has none, and draws its letter. */
  readonly logo?: LogoForm;
}

/** The house brand: Omni Loop's own, signed out, in demo mode and in the single-file artifact. */
export const HOUSE_BRAND: Brand = { name: OMNI_LOOP.name, theme: {}, logo: OMNI_LOOP.logo };

/** The brand's name as the screens write it: "OMNI LOOP PRESENTS", "© 2026 ACME". */
export const brandWord = (brand: Brand) => brand.name.toUpperCase();

/**
 * How a brand looks: its theme over the defaults (an invalid entry dropped with a warning), its mark
 * in that theme's colours, and its crest, `null` for a workspace.
 */
export function brandLook(brand: Brand): { theme: Theme; mark: Mark; logo: LogoForm | null } {
  const theme = resolveTheme(brand.theme);
  return { theme, mark: markFor(brand.name, theme), logo: brand.logo ?? null };
}
