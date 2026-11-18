import type { Config } from 'stylelint';

// The raw-value lint (PRD omni-loop-10): a stylesheet under the paths `pnpm lint` hands to stylelint
// (`STYLELINT_PATHS` in scripts/lint-repository.ts) writes every font size, space, radius, z-index,
// shadow and colour as a token (`var(--space-3)`), never as a number or a hex. Border widths, outlines and
// transitions are not tokens and stay free. Plain CSS on the DTCG tokens of @omni/design.

/** A value made only of custom-property reads, `0`, `auto` or `none`, space-separated. */
const TOKENS_ONLY = /^(var\(--[a-z0-9-]+\)|0|auto|none)( (var\(--[a-z0-9-]+\)|0|auto|none))*$/;
/** The same, plus the colour keywords that name no colour of their own. */
const COLOURS = /^(var\(--[a-z0-9-]+\)|transparent|currentcolor|inherit)$/;

const spacing = ['padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'padding-inline', 'padding-block',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'margin-inline', 'margin-block',
  'gap', 'row-gap', 'column-gap'];
const radii = ['border-radius', 'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius'];
const colours = ['color', 'background-color', 'background', 'border-color', 'outline-color', 'fill', 'stroke'];

/** The stylelint rules. */
const config: Config = {
  rules: {
    'declaration-property-value-allowed-list': {
      'font-size': [/^var\(--type-[a-z0-9-]+-size\)$/],
      ...Object.fromEntries(spacing.map((property) => [property, [TOKENS_ONLY]])),
      ...Object.fromEntries(radii.map((property) => [property, [TOKENS_ONLY, /^50%$/]])),
      'z-index': [/^var\(--layer-[a-z]+\)$/, /^auto$/, /^0$/],
      'box-shadow': [/^var\(--elevation-[a-z]+\)$/, /^none$/],
      ...Object.fromEntries(colours.map((property) => [property, [COLOURS]])),
    },
    // A gradient or a function that carries a colour inside another property is a raw value too.
    'color-no-hex': true,
    'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color'],
  },
};

export default config;
