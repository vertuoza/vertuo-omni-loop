type Ctx = Pick<CanvasRenderingContext2D, 'fillStyle' | 'fillRect'> | Pick<OffscreenCanvasRenderingContext2D, 'fillStyle' | 'fillRect'>;

/** The logo's forms: OMNI LOOP, a big O leading MNI LOOP, and the O alone. */
export type LogoForm = 'full' | 'lockup' | 'mark';
/** Every drawing the logo module holds: the three forms and the favicon, drawn on its own 16×16 grid. */
export type LogoDrawing = LogoForm | 'favicon';

export const LOGO_FORMS: readonly LogoForm[];
export const LOGO_DRAWINGS: readonly LogoDrawing[];

/** A logo drawing as pixels, row by row, `null` for empty; `mono` is the navy-dark one-colour variant. */
export function logoPixels(form: LogoDrawing, o?: { mono?: boolean }): { readonly w: number; readonly h: number; readonly pixels: readonly (string | null)[] };
/** A logo drawing as a crisp SVG string, `scale` (a whole number) times its pixels; `title` names it for a screen reader. */
export function logoSvg(form: LogoDrawing, o?: { scale?: number; mono?: boolean; title?: string | null }): string;
/** Draws a logo drawing on a canvas with its top left at (`x`, `y`), at a whole-number `scale`; `reveal` (0 to 1) draws that share of its columns from the left. */
export function drawLogo(ctx: Ctx, form: LogoDrawing, x: number, y: number, o?: { scale?: number; mono?: boolean; reveal?: number }): void;
