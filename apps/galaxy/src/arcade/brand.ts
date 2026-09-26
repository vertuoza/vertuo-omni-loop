// Whose arcade it is: a workspace's brand. Its name gives the mark its letter (mark.ts) and the boot
// and the title their words; its theme is the colours the workspace overrides, carried here and not
// applied yet.

export interface Brand {
  /** The workspace's name, as it stores it: "Vertuoza". The screens show it upper-cased. */
  readonly name: string;
  /** The workspace's colour overrides, token to `#rrggbb`: only what it changes, `{}` for none. */
  readonly theme: Readonly<Record<string, string>>;
}

/** The house brand: the arcade's own, signed out, in demo mode and in the single-file artifact. */
export const HOUSE_BRAND: Brand = { name: 'Vertuoza', theme: {} };

/** The brand's name as the screens write it: "VERTUOZA PRESENTS", "© 2026 VERTUOZA". */
export const brandWord = (brand: Brand) => brand.name.toUpperCase();
