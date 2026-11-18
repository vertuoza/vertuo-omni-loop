import type { ColourRole } from '@omni/design';
import type { ReactElement } from 'react';

/** A colour pair a part draws: a text or an edge role on the role it sits on. */
export type ContrastPair = {
  /** The role of the text, or of the edge with `edge`. */
  text: ColourRole;
  /** The role it is read on. */
  on: ColourRole;
  /** An edge that tells a control from what it sits on (WCAG 1.4.11): 3:1, not the 4.5:1 of text. */
  edge?: true;
};

/** The surfaces a part with no background of its own is read on. */
const SURFACES = ['canvas', 'surface', 'raised', 'sunken'] as const satisfies readonly ColourRole[];

/** `text` on each surface a page may put the part on. */
export function onSurfaces(text: ColourRole, { edge = false }: { edge?: boolean } = {}): ContrastPair[] {
  return SURFACES.map((on) => (edge ? { text, on, edge: true } : { text, on }));
}

/** What each component's `X.meta.ts` says about it: read by the tests and by the `/design` catalogue. */
export type ComponentMeta = {
  /** The component's name, as exported. */
  name: string;
  /** Each closed prop: the values it takes. */
  variants: Readonly<Record<string, readonly string[]>>;
  /** When to reach for it, in one or two sentences. */
  usage: string;
  /** What to do with it. */
  do: readonly string[];
  /** What never to do with it. */
  dont: readonly string[];
  /**
   * The colour pairs it draws: `base` for every variant, and `<prop>=<value>` for the pairs one
   * variant adds. Each is checked at WCAG AA in Omni, Light and Dark. A part that draws no colour of
   * its own (a layout) has none.
   */
  contrast: Readonly<Record<string, readonly ContrastPair[]>>;
  /** What the component does for a keyboard and a screen reader. */
  accessibility: readonly string[];
  /** The CSS classes of the app's old stylesheets this component replaces. */
  replaces: readonly string[];
  /** One example, as JSX. */
  example: string;
};

/** A part's specimen: it draws the part with one closed prop at one of its values, the rest at their defaults. */
export type Specimen = (prop: string, value: string) => ReactElement;

/** A registered part, as src/generated/catalogue.ts lists it. */
export type Part = { meta: ComponentMeta; specimen: Specimen };

/** The one of the closed values that is `value`: a specimen names a variant that exists, or fails. */
export function one<T extends string>(values: readonly T[], value: string): T {
  const found = values.find((v) => v === value);
  if (found === undefined) throw new Error(`${value} is not one of ${values.join(', ')}`);
  return found;
}
