/** What each component's `X.meta.ts` says about it: read by tests today, by the catalogue later. */
export type ComponentMeta = {
  /** The component's name, as exported. */
  name: string;
  /** Each closed prop: the values it takes. */
  variants: Readonly<Record<string, readonly string[]>>;
  /** What the component does for a keyboard and a screen reader. */
  accessibility: readonly string[];
  /** The CSS classes of the app's old stylesheets this component replaces. */
  replaces: readonly string[];
  /** One example, as JSX. */
  example: string;
};
