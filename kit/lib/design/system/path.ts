// PRD 1559, s1: `design.system` — the path of the repository's DESIGN.md, the design system every
// drawing and building skill reads. The key is optional, as `design.ignore` is: `parseConfig` leaves it
// unset when the file does not name it, and its default is applied here, where it is read.

/** The path read when the config names none: `DESIGN.md`, at the repository's root. */
export const DEFAULT_DESIGN_SYSTEM = 'DESIGN.md';

/** The path `design.system` holds, or the default when the config does not set it. */
export function designSystemPath(design: { readonly system?: string | undefined }): string {
  return design.system ?? DEFAULT_DESIGN_SYSTEM;
}
