# `@omni/design` — the Omni Loop design system

One library for how Omni Loop looks: the colour tokens, the fonts, the 16-bit crest logo, the
product brand, and the hand-placed pixel sprites with the planet renderer. The galaxy arcade, Ask
and the `/design` page all read it, so a colour, a face or a sprite is changed here once and every
screen follows.

- **Plain files.** ES modules, CSS, SVG strings and woff2 files. No React, no Next: the package can
  leave the monorepo as a library without a rewrite. It stays `private` for now.
- **One entry point.** `import { … } from '@omni/design'` gives every module below;
  `src/index.ts` re-exports each one. The modules are strict TypeScript, and their types are read
  from the source itself: there is no declaration file beside them.
- **Tokens from DTCG files.** Every token is written once, in the W3C DTCG 2025.10 files of
  `tokens/` (`*.tokens.json`); `tokens/build.ts` generates `tokens.css` and
  `src/tokens.generated.ts` from them.
- **Two stylesheets.** `@omni/design/tokens.css` (the colours, the scale and each theme's semantic
  roles, as custom properties) and
  `@omni/design/fonts.css` (the `@font-face` rules, and the type scale as `:root` custom
  properties). The woff2 files are served as `@omni/design/fonts/<file>`.

It was `@omni/sprites` (`packages/sprites`) until PRD 141. Nothing may import the old name:
`apps/galaxy/src/design-system.test.ts` fails if anything does, if a galaxy stylesheet declares its
own colour on `:root`, or if a galaxy page links Google Fonts.

## What each module exports

| Module | Exports | What it holds |
|---|---|---|
| `palette` | `PALETTE`, `INK` | The pixel palette, one character to one colour, so a sprite can be written as strings; and the named colours: the arcade's (`void`, `deep`, `navy`, `navyDark`, `white`, `plasma`, `plasmaDark`, `yellow`, `gold`, `red`, `cyan`, `green`…), the logo's ramp (`highlight`, `yellow`, `orange`, `ember`) and the print ad's accents (`magenta`, `adPurple`, `starfield`). |
| `tokens` | `COLOURS`, `ARCADE`, `cssName`, `SCALE`, `THEME_ROLES`, `THEME_ROLES_ANTI`, `ROLE_TEXT_PAIRS`, `ROLE_UI_PAIRS`, `ASK`, `ASK_ROLES`, `ASK_ANTI`, `ASK_TEXT_PAIRS`, `ASK_UI_PAIRS`, `tokensCss`, `contrast` | The tokens, named: every named colour by its CSS name (`COLOURS`, `navy-dark`: `INK` plus the arcade's own), the scale (`SCALE`: space, radius, type, weight, elevation, motion), each theme's semantic roles with the text and edge pairs each must pass, Ask's names kept as aliases of the roles (`ASK_ROLES`), and the writer of `tokens.css`. |
| `tokens.generated` | `TOKEN_COLOURS`, `TOKEN_SCALE`, `TOKEN_THEMES`, `TOKEN_THEMES_ANTI` | The DTCG files' tokens as `tokens/build.ts` writes them: never edited by hand. |
| `fonts` | `FACES`, `ROLES`, `TYPE_SCALE`, `SUBSETS`, `fontFiles`, `fontFaceCss`, `fontsCss` | The four font roles, their faces and files, the type scale, and the generator of `fonts.css`. |
| `logo` | `LOGO_FORMS`, `LOGO_DRAWINGS`, `logoPixels`, `logoSvg`, `drawLogo` | The 16-bit crest in its three forms and the favicon, each with a one-colour variant: as pixels, as a crisp SVG at any whole-number scale, and drawn on a canvas. |
| `brand` | `OMNI_LOOP` | The product brand: its name, its tagline, its logo form, its favicon and its theme colour. |
| `forge` | `forge`, `RAMPS`, `FLAT` | The sprite forge: material shapes finished with a 4-tone ramp lit from the top left and a coloured outline. |
| `sprites` | `SPRITE_DEFS`, `MASCOTS`, `WOUND_TINT`, `woundTint` | The cast and the icons, two frames each: OmniMan (32×48) and his poses `omni-point`, `omni-cheer`, `omni-run`; the hero bodies; the fleet mascots (32×32), listed in `MASCOTS`, the library a workspace's owner picks a fleet's mascot from; Entropy (24×24) recoloured per wound kind; the 16×16 icons (`flag`, `hammer`, `fire`, `lock`, `skull`, `beacon`, `coin`, `check`, `open`, `star`, `ship`) and the 8×8 `cursor`; the two pedestals of SELECT YOUR APP: `code-mark` (30×17), the Omni app's sober two-tone `</>`, cyan on slate, still in both frames, and `arcade-cabinet` (18×26), the Arcade's cabinet with its marquee, screen, joystick and buttons. |
| `heroes` | `HERO_PRESETS`, `heroLook`, `heroPose`, `OMNI_POSES`, `validHero`, `randomHero`, `rampFrom`, `fleetSprite` | A player's hero: the OmniMan body recoloured by ramp swaps (skin, hair, suit, cape), in any of OmniMan's poses; a fleet's mascot, or a hero in its colour. |
| `draw` | `spritePixels`, `spriteImage`, `drawSprite`, `spriteSize`, `posterPixels`, `posterImage`, `POSTER_MAX_SCALE`, `drawPlanet`, `planetTexture`, `drawSun`, `sunPixels`, `sunSize`, `SUN_FRAMES`, `drawStarfield`, `makeStarfield`, `makeNebula`, `rng`, `SURFACES` | Drawing at native resolution: sprites, sprites at poster scale (a whole number from 1 to 16, every pixel a block), the procedural planets and suns, the starfield and the nebulae. |

### Tokens

The files of `tokens/` hold every token, in the W3C DTCG 2025.10 format (a colour is sRGB
components with its hex beside them; an alias is `"{void}"`):

| File | Holds | In CSS |
|---|---|---|
| `palette.tokens.json` | The named colours: `INK` (whose sprites' copy stays in `src/palette.ts`; a test holds the two equal) and the arcade's own | `--void`, `--navy-dark`… on `:root` |
| `scale.tokens.json` | Space on a 4 px grid (`space-1` 4 px … `space-8` 64 px), radius (`radius-1` 4 px, `radius-2` 8 px, `radius-full`), seven UI type steps (`type-1` 12 px … `type-7` 32 px) and prose (17 px on 1.6), each a `-size` and a `-line`, weights 400 to 700, three elevations, two durations and one ease-out | `--space-1`, `--type-3-size`, `--weight-medium`, `--elevation-raised`, `--motion-ease-out`… on `:root` |
| `omni.tokens.json`, `light.tokens.json`, `dark.tokens.json` | Each theme's semantic roles, named by their job: `canvas`, `surface`, `raised`, `sunken`; `text-primary`, `-secondary`, `-tertiary`, `-on-accent`, `-on-signal`, `-on-highlight`; `border-subtle` (cards), `border-strong` (controls); `accent` and `accent-soft` (links, selection, focus); `signal` and `signal-soft` (the one thing to look at, once per view); `highlight` (the Recommended badge); `success`, `warning`, `danger`, `info` | `--color-<role>`, where the theme script marks the ask root (`data-ask-theme`), Omni by default |
| `<theme>.anti.tokens.json` | The roles the anti-loop mode remaps in that theme | the same names, under `data-ask-mode="anti"` |

Ask's names (`ASK`: `ground`, `ink`, `plasma`…) stay, each an alias of one role (`ASK_ROLES`) at the
colour it always had, so no stylesheet has to change. Change a token in a file, then:

```bash
pnpm --filter @omni/design tokens
```

`tokens/build.test.ts` fails while the committed `tokens.css` or `src/tokens.generated.ts` differs
from what the files generate, and the generator refuses a type it does not know, an alias to nothing,
a colour whose hex and components disagree, or a theme missing a role another has.
`src/tokens.test.ts` fails while any role's text pair misses WCAG AA (4.5:1) or any control's edge
3:1, in Omni, in Light, in Dark or in the anti-loop mode. A workspace's theme (the galaxy's
`src/arcade/theme.ts`) takes its defaults from `COLOURS` and overrides them on the arcade's root
element; it never writes on `:root`.

### Fonts

All four roles are under the SIL Open Font License, whose text sits beside each face in `fonts/`.
Every face ships the latin and latin-ext subsets.

| Role | Face | Used for |
|---|---|---|
| `display` | Anton, slanted 12° by the type scale | Ad headlines, and taglines beside the logo |
| `pixel` | Press Start 2P for labels and the HUD, Jersey 10 for longer game text | The game, its hints, its numbers |
| `body` | Atkinson Hyperlegible Next (400, 500, 600, 700, 400 italic) | Reading copy, Ask; 500 and 600 for controls, labels and headings |
| `mono` | JetBrains Mono (400, 600) | Code, commands |

Atkinson Hyperlegible Next draws its zero with a slash, its tabular zero too, and has no zero
without one: no font setting turns the slash off.

The type scale names each step as a role, a size, a line height and a slant: `display-xl` to
`display-s`, `pixel-l` to `pixel-s`, `body-l` to `body-s`, and `mono` (`TYPE_SCALE` in JS, and
custom properties in `fonts.css`). Change a face or a step in `src/fonts.ts`, then:

```bash
pnpm --filter @omni/design fonts
```

A page imports `@omni/design/fonts.css` and serves the faces from its own origin: no page links
Google Fonts. The galaxy's single-file artifact inlines the two pixel faces only; the display and
body roles fall back to system faces there, to keep the page small.

## The logo: the 16-bit crest

Pixel art, made by the sprites' rules. The O is a loop arrow: a ring broken at the top right, its
end sharpened into an arrowhead. M, N, I, L and P are a chunky 5×7 pixel face drawn at 2×. The
finish is the forge's: a 4-tone ramp lit from the top left (`highlight`, `yellow`, `orange`,
`ember`), a `navyDark` outline on every edge, and a two-pixel `plasmaDark` drop shadow.

| Drawing | Pixels at 1× | What it is |
|---|---|---|
| `full` | 122×18 | OMNI LOOP, every O the loop arrow. The brand's own form (`OMNI_LOOP.logo`) |
| `lockup` | 140×32 | A big O leading MNI LOOP |
| `mark` | 20×18 | The O alone |
| `favicon` | 16×16 | The mark, redrawn on its own 16×16 grid (`OMNI_LOOP.icon`) |

```js
import { logoSvg, drawLogo, OMNI_LOOP } from '@omni/design';

logoSvg('full', { scale: 3, title: OMNI_LOOP.name }); // an SVG 366×54, shape-rendering="crispEdges"
drawLogo(ctx, 'mark', 8, 8, { scale: 2 });            // on a canvas, top left at (8, 8)
logoSvg('lockup', { mono: true });                     // the one-colour variant
```

## Brand rules

**Two brand layers.** Omni Loop is the product's brand: it is what a page wears signed out, in demo
mode and in the single-file artifact, and what the page title, the favicon and `themeColor` say. A
workspace's mark belongs to its customer: a member of the Vertuoza workspace sees the V, and the
crest never replaces it inside a workspace.

**Which form, where.**

- `full` is the default: the boot, the title, a page header, anywhere the name has room to be read.
- `lockup` is for a poster or an ad, where the big O leads a headline set in the `display` role.
- `mark` is for a square space where the name is written nearby: an emblem, an avatar, a badge.
- `favicon` is for the browser tab and any other 16×16 spot. Never shrink the `mark` into it: the
  favicon is its own drawing, so that the ring's gap and the arrowhead survive at that size.

**Which variant, on which ground.**

- The full-colour crest sits on a dark ground: `void`, `deep`, `cab`, `starfield`, `adPurple`, or
  space art. Its `navyDark` outline and `plasmaDark` shadow are what separate it from the ground.
- The one-colour variant (`mono: true`, the silhouette in `navyDark`, without its shadow) sits on a
  light ground (`white`, `highlight`) or wherever a single ink is printed.
- Never recolour the crest, never draw it over a busy ground without a dark panel behind it, and
  never place the full-colour crest on a light ground.

**Whole-number scales only.** The crest, like every sprite, is drawn at 1×, 2×, 3×… and never
smoothed: no fractional scale, no CSS resize of the SVG to a size that is not a whole multiple of its
pixels, no `image-rendering` other than pixelated. `logoSvg` sets `shape-rendering="crispEdges"`.

**Minimum sizes.** No form is drawn below 1×, its own pixel size:

| Drawing | Smallest |
|---|---|
| `full` | 122×18 px |
| `lockup` | 140×32 px |
| `mark` | 20×18 px |
| `favicon` | 16×16 px, and whole multiples of it (32, 48) |

Below the `mark`'s 20 px, use the `favicon`; where even 16 px will not fit, write the name in the
`pixel` role instead of drawing the crest.

## Where it is shown

`/design` in the galaxy app renders the whole system straight from this package: every logo form
on dark and light grounds, every colour with its name and hex, every type-scale step, every sprite
in every frame, the heroes in every fleet's colours, the three poses at poster scale, and the
icons.

## Tests

`pnpm test` from the repository root runs them all, beside their modules: `tokens/build.test.ts`, `tokens.test.ts`,
`fonts.test.ts`, `logo.test.ts`, `brand.test.ts`, `sprites.test.ts`, `heroes.test.ts`,
`mascots.test.ts`, `personas.test.ts`, `sun.test.ts` and `index.test.ts`. `pnpm typecheck` checks
them with the modules.
