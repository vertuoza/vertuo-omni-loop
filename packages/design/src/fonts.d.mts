export type FontRole = 'display' | 'pixel' | 'body' | 'mono';
export type FontStyle = 'normal' | 'italic';

export interface FontFaceSpec {
  readonly family: string;
  readonly slug: string;
  readonly role: FontRole;
  readonly cuts: readonly { readonly weight: number; readonly style: FontStyle }[];
  readonly stack: string;
}

export interface FontFile {
  family: string;
  role: FontRole;
  weight: number;
  style: FontStyle;
  subset: string;
  unicodeRange: string;
  file: string;
}

export interface TypeStep {
  readonly role: FontRole;
  readonly face: string;
  readonly size: number;
  readonly lineHeight: number;
  readonly slant: number;
}

export type TypeStepName =
  | 'display-xl' | 'display-l' | 'display-m' | 'display-s'
  | 'pixel-l' | 'pixel-m' | 'pixel-s'
  | 'body-l' | 'body-m' | 'body-s'
  | 'mono';

export const SUBSETS: Readonly<Record<'latin' | 'latin-ext', string>>;
export const FACES: readonly FontFaceSpec[];
export const ROLES: Readonly<Record<FontRole, readonly string[]>>;
export const TYPE_SCALE: Readonly<Record<TypeStepName, TypeStep>>;
export function fontFiles(): FontFile[];
export function fontFaceCss(files: readonly FontFile[], url?: (file: string) => string): string;
export function fontsCss(): string;
